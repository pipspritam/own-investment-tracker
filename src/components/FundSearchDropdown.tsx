import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { searchFunds, fetchFundDetails, MFAPISearchResult } from '../services/mfapi';

export interface SelectedFundInfo {
  schemeCode: number;
  schemeName: string;
  latestNav?: number;
  navDate?: string;
}

interface Props {
  onSelect: (fund: SelectedFundInfo) => void;
  selectedFund?: SelectedFundInfo | null;
  onClear?: () => void;
  label?: string;
}

// Popular mutual funds in India for 1-tap quick selection
const POPULAR_FUNDS: Array<{ schemeCode: number; name: string; tag: string }> = [
  { schemeCode: 147946, name: 'BANDHAN Small Cap Fund - Direct - Growth', tag: 'Small Cap' },
  { schemeCode: 122639, name: 'Parag Parikh Flexi Cap Fund - Direct - Growth', tag: 'Flexi Cap' },
  { schemeCode: 120828, name: 'Quant Small Cap Fund - Direct - Growth', tag: 'Small Cap' },
  { schemeCode: 118778, name: 'Nippon India Small Cap Fund - Direct - Growth', tag: 'Small Cap' },
  { schemeCode: 120594, name: 'ICICI Prudential Technology Fund - Direct - Growth', tag: 'Sector' },
  { schemeCode: 125354, name: 'Axis Small Cap Fund - Direct - Growth', tag: 'Small Cap' },
];

export default function FundSearchDropdown({
  onSelect,
  selectedFund,
  onClear,
  label = 'Search Available Mutual Funds (AMFI)',
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MFAPISearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showPopular, setShowPopular] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search-as-you-type
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const found = await searchFunds(trimmed);
        setResults(found);
        setIsOpen(true);
      } catch (err) {
        console.error('Error during fund search:', err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const handleSelectScheme = async (schemeCode: number, schemeName: string) => {
    setIsFetchingDetails(true);
    setIsOpen(false);
    setShowPopular(false);
    setQuery('');

    try {
      const details = await fetchFundDetails(schemeCode);
      onSelect({
        schemeCode,
        schemeName: details?.schemeName || schemeName,
        latestNav: details?.latestNav,
        navDate: details?.navDate,
      });
    } catch {
      onSelect({
        schemeCode,
        schemeName,
      });
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setShowPopular(false);
    if (onClear) onClear();
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      {/* When a fund is already selected, display the verified card */}
      {selectedFund && selectedFund.schemeCode ? (
        <View style={styles.selectedCard}>
          <View style={styles.selectedHeader}>
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>✓ AMFI Scheme #{selectedFund.schemeCode}</Text>
            </View>
            <TouchableOpacity onPress={handleClear} style={styles.changeBtn}>
              <Text style={styles.changeBtnText}>Change Fund ✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.selectedName} numberOfLines={2}>
            {selectedFund.schemeName}
          </Text>

          {selectedFund.latestNav ? (
            <View style={styles.selectedNavRow}>
              <Text style={styles.selectedNavLabel}>Latest AMFI NAV: </Text>
              <Text style={styles.selectedNavVal}>
                ₹{selectedFund.latestNav.toFixed(3)}
              </Text>
              {selectedFund.navDate ? (
                <Text style={styles.selectedNavDate}> ({selectedFund.navDate})</Text>
              ) : null}
            </View>
          ) : isFetchingDetails ? (
            <View style={styles.fetchingNavRow}>
              <ActivityIndicator size="small" color="#60A5FA" />
              <Text style={styles.fetchingNavText}>Fetching latest NAV...</Text>
            </View>
          ) : null}
        </View>
      ) : (
        /* Fund Search Input */
        <View style={styles.searchContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.input}
              placeholder="Type fund name or AMFI code (e.g. Parag Parikh, 147946)..."
              placeholderTextColor="#64748B"
              value={query}
              onChangeText={setQuery}
              onFocus={() => {
                if (results.length > 0) setIsOpen(true);
                else if (!query) setShowPopular(true);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isSearching ? (
              <ActivityIndicator size="small" color="#3B82F6" style={styles.rightIcon} />
            ) : query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.rightIcon}>
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Quick Popular Picks (shown when search is empty or focused) */}
          {showPopular && !query && (
            <View style={styles.popularBox}>
              <View style={styles.popularTitleRow}>
                <Text style={styles.popularTitle}>Popular Funds (1-Tap Select):</Text>
                <TouchableOpacity onPress={() => setShowPopular(false)}>
                  <Text style={styles.hidePopularText}>Hide</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.popularList}>
                {POPULAR_FUNDS.map((item) => (
                  <TouchableOpacity
                    key={item.schemeCode}
                    style={styles.popularChip}
                    onPress={() => handleSelectScheme(item.schemeCode, item.name)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.popularChipText} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.popularCodeBadge}>
                      <Text style={styles.popularCodeText}>#{item.schemeCode}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Search Results Dropdown */}
          {isOpen && results.length > 0 && (
            <View style={styles.dropdown}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownCount}>
                  Found {results.length} AMFI matching fund(s):
                </Text>
                <TouchableOpacity onPress={() => setIsOpen(false)}>
                  <Text style={styles.closeDropdownText}>Close</Text>
                </TouchableOpacity>
              </View>

              {results.map((item) => {
                const isDirect = item.schemeName.toLowerCase().includes('direct');
                return (
                  <TouchableOpacity
                    key={item.schemeCode}
                    style={styles.dropdownItem}
                    onPress={() => handleSelectScheme(item.schemeCode, item.schemeName)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemMain}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.schemeName}
                      </Text>
                      <View style={styles.itemMeta}>
                        <View style={styles.codePill}>
                          <Text style={styles.codePillText}>AMFI #{item.schemeCode}</Text>
                        </View>
                        {isDirect && (
                          <View style={styles.directPill}>
                            <Text style={styles.directPillText}>Direct Plan</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.selectArrow}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {isOpen && query.length >= 2 && !isSearching && results.length === 0 && (
            <View style={styles.noResultsBox}>
              <Text style={styles.noResultsText}>
                No mutual funds found matching "{query}".
              </Text>
              <Text style={styles.noResultsHint}>
                Try searching with fewer words (e.g. "Bandhan", "Quant", "HDFC").
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  searchContainer: {
    position: 'relative',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    paddingHorizontal: 12,
    minHeight: 46,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#F8FAFC',
    paddingVertical: 10,
  },
  rightIcon: {
    padding: 6,
  },
  clearText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: 'bold',
  },
  selectedCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    padding: 14,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  changeBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: '#334155',
    borderRadius: 6,
  },
  changeBtnText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 6,
  },
  selectedNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  selectedNavLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  selectedNavVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },
  selectedNavDate: {
    fontSize: 12,
    color: '#64748B',
  },
  fetchingNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  fetchingNavText: {
    fontSize: 12,
    color: '#60A5FA',
    marginLeft: 6,
  },
  popularBox: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    marginTop: 6,
  },
  popularTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  popularTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  hidePopularText: {
    fontSize: 11,
    color: '#60A5FA',
  },
  popularList: {
    gap: 6,
  },
  popularChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  popularChipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
    marginRight: 8,
  },
  popularCodeBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularCodeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60A5FA',
  },
  dropdown: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  dropdownCount: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  closeDropdownText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '600',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  itemMain: {
    flex: 1,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 18,
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codePill: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60A5FA',
  },
  directPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  directPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  selectArrow: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: 'bold',
  },
  noResultsBox: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noResultsText: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '600',
    marginBottom: 2,
  },
  noResultsHint: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
