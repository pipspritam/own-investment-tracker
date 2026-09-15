import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  searchLocalStocks,
  searchLiveIndianStocks,
} from '../services/stockSearch';
import { POPULAR_INDIAN_STOCKS, ListedStockItem } from '../data/indianStocks';

export interface SelectedStockInfo {
  symbol: string;
  name: string;
  exchange?: string;
  sector?: string;
}

interface Props {
  onSelect: (stock: SelectedStockInfo) => void;
  selectedStock?: SelectedStockInfo | null;
  onClear?: () => void;
  label?: string;
}

export default function StockSearchDropdown({
  onSelect,
  selectedStock,
  onClear,
  label = 'Search Listed Companies (NSE / BSE)',
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ListedStockItem[]>([]);
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search logic: Instant local + debounced live
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setIsOpen(false);
      setIsSearchingLive(false);
      return;
    }

    // 1. Instant local search (0ms)
    const localMatches = searchLocalStocks(trimmed, 15);
    setResults(localMatches);
    setIsOpen(true);

    // 2. Debounced live search if query >= 2 chars
    if (trimmed.length >= 2) {
      setIsSearchingLive(true);
      debounceTimer.current = setTimeout(async () => {
        try {
          const liveMatches = await searchLiveIndianStocks(trimmed);
          if (liveMatches.length > 0) {
            setResults((prev) => {
              const existingSymbols = new Set(prev.map((s) => s.symbol.toUpperCase()));
              const merged = [...prev];
              for (const item of liveMatches) {
                if (!existingSymbols.has(item.symbol.toUpperCase())) {
                  merged.push(item);
                  existingSymbols.add(item.symbol.toUpperCase());
                }
              }
              return merged;
            });
          }
        } catch (err) {
          // Ignore live search error, local results already shown
        } finally {
          setIsSearchingLive(false);
        }
      }, 300);
    } else {
      setIsSearchingLive(false);
    }

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const handleSelectStock = (stock: ListedStockItem) => {
    onSelect({
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchange || 'NSE',
      sector: stock.sector,
    });
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (onClear) onClear();
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      {/* When a stock is already selected, display the verified card */}
      {selectedStock && selectedStock.name ? (
        <View style={styles.selectedCard}>
          <View style={styles.selectedHeader}>
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>
                ✓ {selectedStock.exchange || 'NSE'}: {selectedStock.symbol}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClear} style={styles.changeBtn}>
              <Text style={styles.changeBtnText}>Change Stock ✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.selectedName} numberOfLines={2}>
            {selectedStock.name}
          </Text>

          {selectedStock.sector ? (
            <Text style={styles.selectedSectorText}>Sector: {selectedStock.sector}</Text>
          ) : null}
        </View>
      ) : (
        /* Stock Search Input & Dropdown */
        <View style={styles.searchContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.input}
              placeholder="Type company or ticker (e.g. Tata, Reliance, INFY)..."
              placeholderTextColor="#64748B"
              value={query}
              onChangeText={setQuery}
              onFocus={() => {
                if (query.trim().length > 0) setIsOpen(true);
              }}
              autoCapitalize="characters"
            />
            {isSearchingLive && (
              <ActivityIndicator size="small" color="#3B82F6" style={styles.inputSpinner} />
            )}
            {query.length > 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Popular Stocks Quick-Pick (Shown when not actively showing search results) */}
          {!isOpen && (
            <View style={styles.popularSection}>
              <Text style={styles.popularTitle}>POPULAR STOCKS:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.popularPills}
              >
                {POPULAR_INDIAN_STOCKS.map((stock) => (
                  <TouchableOpacity
                    key={stock.symbol}
                    style={styles.popularPill}
                    onPress={() => handleSelectStock(stock)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.popularPillSymbol}>{stock.symbol}</Text>
                    <Text style={styles.popularPillName} numberOfLines={1}>
                      {stock.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Dropdown Results List */}
          {isOpen && (
            <View style={styles.dropdown}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownCount}>
                  {results.length} listed {results.length === 1 ? 'company' : 'companies'} found
                </Text>
                {isSearchingLive && (
                  <Text style={styles.dropdownSearching}>• Searching live NSE/BSE...</Text>
                )}
                <TouchableOpacity onPress={() => setIsOpen(false)}>
                  <Text style={styles.dropdownClose}>Close ✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.dropdownScroll}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {results.length === 0 ? (
                  <View style={styles.noResultsBox}>
                    <Text style={styles.noResultsText}>
                      No listed companies found matching "{query}".
                    </Text>
                    <Text style={styles.noResultsSub}>
                      You can type your company name manually in the fields below.
                    </Text>
                  </View>
                ) : (
                  results.map((item) => (
                    <TouchableOpacity
                      key={`${item.symbol}-${item.exchange || 'NSE'}`}
                      style={styles.resultItem}
                      onPress={() => handleSelectStock(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.resultMain}>
                        <View style={styles.resultTopRow}>
                          <View style={styles.resultSymbolBadge}>
                            <Text style={styles.resultSymbol}>{item.symbol}</Text>
                          </View>
                          <Text style={styles.resultExchange}>{item.exchange || 'NSE'}</Text>
                          {item.sector ? (
                            <Text style={styles.resultSector} numberOfLines={1}>
                              • {item.sector}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.resultName} numberOfLines={2}>
                          {item.name}
                        </Text>
                      </View>
                      <Text style={styles.selectArrow}>➔</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  changeBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  changeBtnText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '600',
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 20,
  },
  selectedSectorText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  searchContainer: {
    position: 'relative',
    zIndex: 50,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    color: '#F8FAFC',
    fontSize: 14,
  },
  inputSpinner: {
    marginLeft: 6,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },
  clearBtnText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  popularSection: {
    marginTop: 8,
  },
  popularTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  popularPills: {
    gap: 6,
  },
  popularPill: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  popularPillSymbol: {
    fontSize: 12,
    fontWeight: '800',
    color: '#60A5FA',
  },
  popularPillName: {
    fontSize: 11,
    color: '#94A3B8',
  },
  dropdown: {
    marginTop: 6,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    maxHeight: 240,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#1E293B',
  },
  dropdownCount: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  dropdownSearching: {
    fontSize: 11,
    color: '#60A5FA',
    fontStyle: 'italic',
  },
  dropdownClose: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '700',
  },
  dropdownScroll: {
    maxHeight: 190,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  resultMain: {
    flex: 1,
    paddingRight: 10,
  },
  resultTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    flexWrap: 'wrap',
    gap: 6,
  },
  resultSymbolBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  resultSymbol: {
    fontSize: 12,
    fontWeight: '800',
    color: '#60A5FA',
  },
  resultExchange: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
  },
  resultSector: {
    fontSize: 10,
    color: '#64748B',
  },
  resultName: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '500',
  },
  selectArrow: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '700',
  },
  noResultsBox: {
    padding: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 13,
    color: '#F8FAFC',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 4,
  },
  noResultsSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
});
