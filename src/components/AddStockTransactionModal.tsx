import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Stock } from '../types';
import { formatINR } from '../utils/currency';
import { normalizeDate } from '../utils/csvParser';
import StockSearchDropdown, { SelectedStockInfo } from './StockSearchDropdown';
import { fetchStockPrice } from '../services/stockPrice';
import DatePickerInput from './DatePickerInput';

interface Props {
  visible: boolean;
  stocks: Stock[];
  onClose: () => void;
  onSaveTransaction: (tx: {
    stock_id: number;
    date: string;
    type: 'BUY' | 'SELL' | 'DIVIDEND';
    price: number;
    quantity: number;
    amount: number;
  }) => void;
  onCreateStock: (
    name: string,
    symbol?: string,
    currentValue?: number,
    currentPrice?: number
  ) => number;
}

export default function AddStockTransactionModal({
  visible,
  stocks,
  onClose,
  onSaveTransaction,
  onCreateStock,
}: Props) {
  const hasExistingStocks = stocks.length > 0;

  // Stock selection mode: 'existing' vs 'new'
  const [stockMode, setStockMode] = useState<'existing' | 'new'>(
    hasExistingStocks ? 'existing' : 'new'
  );
  const [selectedStockId, setSelectedStockId] = useState<number>(stocks[0]?.id || 0);
  const [stockSearchQuery, setStockSearchQuery] = useState('');

  // New stock fields
  const [selectedStockInfo, setSelectedStockInfo] = useState<SelectedStockInfo | null>(null);
  const [newStockName, setNewStockName] = useState('');
  const [newStockSymbol, setNewStockSymbol] = useState('');
  const [newStockCurrentValue, setNewStockCurrentValue] = useState('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [fetchedCmp, setFetchedCmp] = useState<number | null>(null);

  const handleSelectFromDropdown = async (info: SelectedStockInfo) => {
    setSelectedStockInfo(info);
    setNewStockName(info.name);
    setNewStockSymbol(info.symbol);
    setFetchedCmp(null);

    // Auto-fetch CMP if symbol is available
    if (info.symbol) {
      setIsFetchingPrice(true);
      try {
        const quote = await fetchStockPrice(info.symbol);
        if (quote && quote.price > 0) {
          setFetchedCmp(quote.price);
          setPrice(quote.price.toString());
        }
      } catch (err) {
        console.warn('Failed to fetch CMP for symbol:', info.symbol, err);
      } finally {
        setIsFetchingPrice(false);
      }
    }
  };

  const handleClearDropdown = () => {
    setSelectedStockInfo(null);
    setNewStockName('');
    setNewStockSymbol('');
    setFetchedCmp(null);
  };

  // Transaction fields
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'BUY' | 'SELL' | 'DIVIDEND'>('BUY');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    if (!hasExistingStocks) {
      setStockMode('new');
    } else if (!stocks.some((s) => s.id === selectedStockId)) {
      setSelectedStockId(stocks[0].id);
    }
  }, [hasExistingStocks, stocks, selectedStockId]);

  // Filter existing stocks if search query entered
  const filteredExistingStocks = useMemo(() => {
    if (!stockSearchQuery.trim()) return stocks;
    const q = stockSearchQuery.toLowerCase().trim();
    return stocks.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.symbol && s.symbol.toLowerCase().includes(q))
    );
  }, [stocks, stockSearchQuery]);

  // Auto-calculated investment amount: Price * Quantity
  const parsedPrice = parseFloat(price);
  const parsedQuantity = parseFloat(quantity);
  const autoAmount = useMemo(() => {
    if (!isNaN(parsedPrice) && !isNaN(parsedQuantity) && parsedPrice > 0 && parsedQuantity > 0) {
      return Math.round(parsedPrice * parsedQuantity * 100) / 100;
    }
    return 0;
  }, [parsedPrice, parsedQuantity]);

  const handleSave = () => {
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert(
        type === 'DIVIDEND' ? 'Invalid Dividend' : 'Invalid Price',
        type === 'DIVIDEND'
          ? 'Please enter a valid dividend amount per share greater than 0.'
          : 'Please enter a valid stock price greater than 0.'
      );
      return;
    }

    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid number of shares / stocks.');
      return;
    }

    let targetStockId = selectedStockId;

    if (stockMode === 'new' || !hasExistingStocks) {
      if (!newStockName.trim()) {
        Alert.alert('Missing Stock Name', 'Please enter the stock name (e.g. Reliance Industries).');
        return;
      }

      // Check if stock with this name already exists
      const existing = stocks.find(
        (s) => s.name.toLowerCase().trim() === newStockName.toLowerCase().trim()
      );
      if (existing) {
        targetStockId = existing.id;
      } else {
        const parsedCurVal = parseFloat(newStockCurrentValue);
        // Default initial current value to buy amount if not explicitly provided
        let initialVal = 0;
        if (!isNaN(parsedCurVal) && parsedCurVal >= 0) {
          initialVal = parsedCurVal;
        } else if (type === 'BUY') {
          initialVal = autoAmount;
        }

        targetStockId = onCreateStock(
          newStockName.trim(),
          newStockSymbol.trim().toUpperCase() || undefined,
          initialVal,
          fetchedCmp || (type === 'BUY' ? parsedPrice : 0)
        );
      }
    }

    if (!targetStockId) {
      Alert.alert('Error', 'Unable to create or select stock.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const cleanDate = date.trim() ? normalizeDate(date.trim()) || date.trim() : todayStr;

    onSaveTransaction({
      stock_id: targetStockId,
      date: cleanDate,
      type,
      price: parsedPrice,
      quantity: parsedQuantity,
      amount: autoAmount,
    });

    // Reset fields
    setSelectedStockInfo(null);
    setPrice('');
    setQuantity('');
    setNewStockName('');
    setNewStockSymbol('');
    setNewStockCurrentValue('');
    setStockSearchQuery('');
    if (stocks.length > 0) {
      setStockMode('existing');
    }
    onClose();
  };

  const selectedStock = stocks.find((s) => s.id === selectedStockId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />

          {/* Modal Header */}
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>+ Add Stock Transaction</Text>
              <Text style={styles.subtitle}>Log equity buy, sell & dividend orders</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Stock Selection Mode: 2 Types (Already Exists vs New Stock) */}
            <Text style={styles.inputLabel}>Stock Selection (2 Types)</Text>
            <View style={styles.stockTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.stockTypeBtn,
                  stockMode === 'existing' && styles.stockTypeBtnActive,
                  !hasExistingStocks && styles.stockTypeBtnDisabled,
                ]}
                onPress={() => {
                  if (hasExistingStocks) setStockMode('existing');
                }}
                disabled={!hasExistingStocks}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.stockTypeBtnText,
                    stockMode === 'existing' && styles.stockTypeBtnTextActive,
                    !hasExistingStocks && styles.stockTypeBtnTextDisabled,
                  ]}
                >
                  🏢 Already Exists ({stocks.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.stockTypeBtn,
                  stockMode === 'new' && styles.stockTypeBtnActive,
                ]}
                onPress={() => setStockMode('new')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.stockTypeBtnText,
                    stockMode === 'new' && styles.stockTypeBtnTextActive,
                  ]}
                >
                  ✨ + New Stock
                </Text>
              </TouchableOpacity>
            </View>

            {/* Mode 1: Choose from Already Existing Stocks */}
            {stockMode === 'existing' && hasExistingStocks && (
              <View style={styles.existingBox}>
                {stocks.length > 3 && (
                  <TextInput
                    style={[styles.input, styles.searchInput]}
                    placeholder="🔍 Search existing stock by name or symbol..."
                    placeholderTextColor="#64748B"
                    value={stockSearchQuery}
                    onChangeText={setStockSearchQuery}
                  />
                )}

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.pillsScroll}
                  contentContainerStyle={{ paddingVertical: 4 }}
                >
                  {filteredExistingStocks.map((s) => {
                    const isSelected = selectedStockId === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.pill, isSelected && styles.pillSelected]}
                        onPress={() => {
                          setSelectedStockId(s.id);
                          if (s.current_price && s.current_price > 0 && !price) {
                            setPrice(s.current_price.toString());
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                          {s.name}
                        </Text>
                        {s.symbol ? (
                          <Text
                            style={[
                              styles.pillSymbol,
                              isSelected && styles.pillSymbolSelected,
                            ]}
                          >
                            {s.symbol}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {selectedStock && (
                  <View style={styles.selectedStockInfo}>
                    <Text style={styles.selectedStockInfoText}>
                      Selected: <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{selectedStock.name}</Text>
                      {selectedStock.symbol ? ` (${selectedStock.symbol})` : ''} • Currently holding {selectedStock.total_quantity || 0} shares
                    </Text>
                    {selectedStock.current_price && selectedStock.current_price > 0 ? (
                      <Text style={styles.selectedStockCmpText}>
                        CMP: ₹{selectedStock.current_price.toFixed(2)}
                        {selectedStock.day_change_pct !== undefined && selectedStock.day_change_pct !== null ? (
                          <Text style={{ color: selectedStock.day_change_pct >= 0 ? '#10B981' : '#EF4444' }}>
                            {selectedStock.day_change_pct >= 0 ? ' (+' : ' ('}
                            {selectedStock.day_change_pct.toFixed(2)}%)
                          </Text>
                        ) : null}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            )}

            {/* Mode 2: Create New Stock */}
            {stockMode === 'new' && (
              <View style={styles.newStockBox}>
                {/* Searchable Listed Companies Dropdown (NSE / BSE) */}
                <StockSearchDropdown
                  onSelect={handleSelectFromDropdown}
                  selectedStock={selectedStockInfo}
                  onClear={handleClearDropdown}
                  label="Search & Select Listed Company (NSE / BSE)"
                />

                {/* If no stock was selected via dropdown, allow typing manually */}
                {!selectedStockInfo && (
                  <View style={{ marginTop: 6 }}>
                    <Text style={[styles.subInputLabel, { color: '#94A3B8', fontSize: 11 }]}>
                      Or enter custom company & symbol manually:
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Stock Name * (e.g. Reliance Industries)"
                      placeholderTextColor="#64748B"
                      value={newStockName}
                      onChangeText={setNewStockName}
                    />

                    <TextInput
                      style={styles.input}
                      placeholder="Stock Symbol / Ticker (e.g. RELIANCE)"
                      placeholderTextColor="#64748B"
                      autoCapitalize="characters"
                      value={newStockSymbol}
                      onChangeText={setNewStockSymbol}
                    />
                  </View>
                )}

                <Text style={styles.subInputLabel}>Initial Current Market Value (₹) (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Leave empty to auto-use total buy value"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={newStockCurrentValue}
                  onChangeText={setNewStockCurrentValue}
                />
                <Text style={styles.helperText}>
                  ℹ️ You can also update the current value anytime by tapping ✏️ Edit Value on the holding card.
                </Text>
              </View>
            )}

            {/* Transaction Type: BUY vs SELL vs DIVIDEND */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Transaction Type</Text>
            <View style={styles.segmentContainer}>
              <TouchableOpacity
                style={[styles.segmentBtn, type === 'BUY' && styles.buySegmentActive]}
                onPress={() => setType('BUY')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, type === 'BUY' && styles.segmentTextActive]}>
                  BUY
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, type === 'SELL' && styles.sellSegmentActive]}
                onPress={() => setType('SELL')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, type === 'SELL' && styles.segmentTextActive]}>
                  SELL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, type === 'DIVIDEND' && styles.dividendSegmentActive]}
                onPress={() => {
                  setType('DIVIDEND');
                  // Auto-fill quantity with current held shares if available and not set
                  if (selectedStock && selectedStock.total_quantity && selectedStock.total_quantity > 0 && !quantity) {
                    setQuantity(selectedStock.total_quantity.toString());
                  }
                  // Clear price if it was CMP from buy
                  if (price && (price === selectedStock?.current_price?.toString() || price === fetchedCmp?.toString())) {
                    setPrice('');
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, type === 'DIVIDEND' && styles.segmentTextActive]}>
                  💰 DIVIDEND
                </Text>
              </TouchableOpacity>
            </View>

            {/* Inputs: Price & Quantity */}
            <View style={styles.twoColumnRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={styles.priceLabelRow}>
                  <Text style={styles.inputLabel}>
                    {type === 'BUY'
                      ? 'Buy Price (₹) *'
                      : type === 'SELL'
                      ? 'Sale Price (₹) *'
                      : 'Div / Share (₹) *'}
                  </Text>
                  {isFetchingPrice && type !== 'DIVIDEND' && (
                    <Text style={styles.fetchingCmpText}>Fetching CMP...</Text>
                  )}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={type === 'DIVIDEND' ? 'e.g. 10.50' : 'e.g. 2450.50'}
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
                {/* Helper chip to quickly set/reset to live CMP (BUY / SELL only) */}
                {type !== 'DIVIDEND' &&
                stockMode === 'existing' &&
                selectedStock?.current_price &&
                selectedStock.current_price > 0 &&
                price !== selectedStock.current_price.toString() ? (
                  <TouchableOpacity
                    style={styles.cmpHelperChip}
                    onPress={() => setPrice(selectedStock.current_price!.toString())}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cmpHelperText}>
                      ⚡ Use CMP ₹{selectedStock.current_price.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ) : type !== 'DIVIDEND' && fetchedCmp !== null && price !== fetchedCmp.toString() ? (
                  <TouchableOpacity
                    style={styles.cmpHelperChip}
                    onPress={() => setPrice(fetchedCmp.toString())}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cmpHelperText}>
                      ⚡ Use CMP ₹{fetchedCmp.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.inputLabel}>
                    {type === 'DIVIDEND' ? 'Eligible Shares *' : 'Number of Stock *'}
                  </Text>
                  {type === 'DIVIDEND' &&
                  selectedStock &&
                  selectedStock.total_quantity !== undefined &&
                  selectedStock.total_quantity > 0 &&
                  quantity !== selectedStock.total_quantity.toString() ? (
                    <TouchableOpacity
                      onPress={() => setQuantity(selectedStock.total_quantity!.toString())}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.useAllSharesText}>
                        All ({selectedStock.total_quantity})
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={
                    type === 'DIVIDEND' && selectedStock?.total_quantity
                      ? `${selectedStock.total_quantity}`
                      : 'e.g. 10'
                  }
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />
              </View>
            </View>

            {/* Auto-Calculated Value Banner */}
            <View
              style={[
                styles.autoCalcBanner,
                type === 'DIVIDEND' && styles.autoCalcBannerDividend,
              ]}
            >
              <View style={styles.autoCalcTopRow}>
                <Text
                  style={[
                    styles.autoCalcLabel,
                    type === 'DIVIDEND' && styles.autoCalcLabelDividend,
                  ]}
                >
                  ⚡ {type === 'BUY'
                    ? 'AUTO-CALCULATED INVESTMENT VALUE'
                    : type === 'SELL'
                    ? 'AUTO-CALCULATED SALE VALUE'
                    : 'AUTO-CALCULATED DIVIDEND PAYOUT'}
                </Text>
                <Text style={styles.autoCalcFormula}>
                  {parsedPrice > 0 && parsedQuantity > 0
                    ? `${parsedQuantity} shares × ₹${parsedPrice.toFixed(2)}`
                    : 'Price × Number of Stock'}
                </Text>
              </View>
              <Text
                style={[
                  styles.autoCalcAmount,
                  {
                    color:
                      type === 'BUY'
                        ? '#10B981'
                        : type === 'SELL'
                        ? '#EF4444'
                        : '#A78BFA',
                  },
                ]}
              >
                {formatINR(autoAmount)}
              </Text>
              {type === 'DIVIDEND' && (
                <Text style={styles.dividendNote}>
                  ℹ️ This dividend payout is subtracted from this stock's invested amount (cash returned).
                </Text>
              )}
            </View>

            {/* Date with Input and Picker */}
            <DatePickerInput
              label="Transaction Date (YYYY-MM-DD)"
              value={date}
              onChangeDate={setDate}
            />

            {/* Save Button */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>
                {type === 'BUY'
                  ? 'Save Buy Order'
                  : type === 'SELL'
                  ? 'Save Sell Order'
                  : 'Record Dividend Payout'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeIcon: {
    fontSize: 18,
    color: '#94A3B8',
    padding: 4,
  },
  scroll: {
    marginBottom: 8,
  },
  stockTypeContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stockTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  stockTypeBtnActive: {
    backgroundColor: '#3B82F6',
  },
  stockTypeBtnDisabled: {
    opacity: 0.4,
  },
  stockTypeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  stockTypeBtnTextActive: {
    color: '#FFFFFF',
  },
  stockTypeBtnTextDisabled: {
    color: '#64748B',
  },
  existingBox: {
    marginBottom: 12,
  },
  searchInput: {
    fontSize: 13,
    paddingVertical: 10,
    marginBottom: 8,
  },
  pillsScroll: {
    marginBottom: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderColor: '#3B82F6',
  },
  pillText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  pillTextSelected: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  pillSymbol: {
    fontSize: 10,
    color: '#64748B',
    marginLeft: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillSymbolSelected: {
    color: '#93C5FD',
    backgroundColor: '#1D4ED8',
  },
  selectedStockInfo: {
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
  },
  selectedStockInfoText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  selectedStockCmpText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 3,
  },
  priceLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fetchingCmpText: {
    fontSize: 10,
    color: '#60A5FA',
    fontStyle: 'italic',
  },
  cmpHelperChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: -4,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  cmpHelperText: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '700',
  },
  newStockBox: {
    backgroundColor: '#0F172A',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
    marginBottom: 10,
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginTop: -4,
    marginBottom: 4,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buySegmentActive: {
    backgroundColor: '#3B82F6',
  },
  sellSegmentActive: {
    backgroundColor: '#EF4444',
  },
  dividendSegmentActive: {
    backgroundColor: '#8B5CF6',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  useAllSharesText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
  },
  twoColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  autoCalcBanner: {
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  autoCalcBannerDividend: {
    borderColor: '#8B5CF6',
  },
  autoCalcLabelDividend: {
    color: '#A78BFA',
  },
  dividendNote: {
    fontSize: 11,
    color: '#A78BFA',
    marginTop: 6,
    fontWeight: '500',
  },
  autoCalcTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  autoCalcLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  autoCalcFormula: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  autoCalcAmount: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  saveBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
