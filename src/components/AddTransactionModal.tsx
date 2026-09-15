import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { MFFund } from '../types';
import { fetchFundDetails } from '../services/mfapi';
import FundSearchDropdown, { SelectedFundInfo } from './FundSearchDropdown';
import BulkOrderImport from './BulkOrderImport';
import { normalizeDate } from '../utils/csvParser';

interface Props {
  visible: boolean;
  funds: MFFund[];
  onClose: () => void;
  onSaveTransaction: (tx: {
    fund_id: number;
    date: string;
    type: 'BUY' | 'SELL';
    amount: number;
    nav?: number;
    units?: number;
  }) => void;
  onSaveBatchTransactions?: (
    fundId: number,
    orders: Array<{
      date: string;
      type: 'BUY' | 'SELL';
      amount: number;
      nav?: number;
      units?: number;
    }>
  ) => void;
  onCreateFund: (
    name: string,
    folio: string,
    currentValue?: number,
    schemeCode?: string,
    currentNav?: number,
    navDate?: string
  ) => number;
}

export default function AddTransactionModal({
  visible,
  funds,
  onClose,
  onSaveTransaction,
  onSaveBatchTransactions,
  onCreateFund,
}: Props) {
  const hasExistingFunds = funds.length > 0;
  const [orderMode, setOrderMode] = useState<'single' | 'bulk'>('single');
  const [selectedFundId, setSelectedFundId] = useState<number>(funds[0]?.id || 0);
  const [isCreatingFund, setIsCreatingFund] = useState(!hasExistingFunds);

  // New Fund form fields
  const [selectedFundInfo, setSelectedFundInfo] = useState<SelectedFundInfo | null>(null);
  const [newFundSchemeCode, setNewFundSchemeCode] = useState('');
  const [newFundName, setNewFundName] = useState('');
  const [newFundFolio, setNewFundFolio] = useState('');
  const [newFundCurrentValue, setNewFundCurrentValue] = useState('');
  const [isFetchingScheme, setIsFetchingScheme] = useState(false);
  const [fetchedNav, setFetchedNav] = useState<number | null>(null);
  const [fetchedNavDate, setFetchedNavDate] = useState<string | null>(null);

  const handleSelectFromDropdown = (info: SelectedFundInfo) => {
    setSelectedFundInfo(info);
    setNewFundSchemeCode(info.schemeCode.toString());
    setNewFundName(info.schemeName);
    if (info.latestNav) {
      setFetchedNav(info.latestNav);
      setFetchedNavDate(info.navDate || null);
      setNav(info.latestNav.toString());

      const amt = parseFloat(amount);
      if (!isNaN(amt) && amt > 0 && info.latestNav > 0) {
        setUnits((amt / info.latestNav).toFixed(3));
      }
    }
  };

  const handleClearDropdown = () => {
    setSelectedFundInfo(null);
    setNewFundSchemeCode('');
    setNewFundName('');
    setFetchedNav(null);
    setFetchedNavDate(null);
  };

  // Transaction form fields
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [nav, setNav] = useState('');
  const [units, setUnits] = useState('');

  useEffect(() => {
    if (funds.length === 0) {
      setIsCreatingFund(true);
    } else {
      if (!selectedFundId || !funds.some((f) => f.id === selectedFundId)) {
        setSelectedFundId(funds[0].id);
      }
    }
  }, [funds, selectedFundId]);

  const handleFetchScheme = async (codeToFetch?: string) => {
    const code = (codeToFetch || newFundSchemeCode).trim();
    if (!code) {
      Alert.alert('Scheme Code Required', 'Please enter an AMFI Scheme Code (e.g. 147946 for Bandhan Small Cap).');
      return;
    }

    setIsFetchingScheme(true);
    try {
      const details = await fetchFundDetails(code);
      if (details) {
        setNewFundName(details.schemeName);
        setFetchedNav(details.latestNav);
        setFetchedNavDate(details.navDate);
        setNav(details.latestNav.toString());

        const amt = parseFloat(amount);
        if (!isNaN(amt) && amt > 0 && details.latestNav > 0) {
          setUnits((amt / details.latestNav).toFixed(3));
        }
      } else {
        Alert.alert(
          'Scheme Not Found',
          `Could not find details for Scheme Code "${code}". Please check the code on MFAPI.in or enter the fund name manually.`
        );
      }
    } catch {
      Alert.alert('Network Error', 'Unable to fetch NAV data. Please check your internet connection.');
    } finally {
      setIsFetchingScheme(false);
    }
  };

  const handleAmountChange = (text: string) => {
    setAmount(text);
    const amt = parseFloat(text);
    const n = parseFloat(nav);
    if (!isNaN(amt) && !isNaN(n) && n > 0) {
      setUnits((amt / n).toFixed(3));
    }
  };

  const handleNavChange = (text: string) => {
    setNav(text);
    const amt = parseFloat(amount);
    const n = parseFloat(text);
    if (!isNaN(amt) && !isNaN(n) && n > 0) {
      setUnits((amt / n).toFixed(3));
    }
  };

  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    let targetFundId = selectedFundId;

    if (isCreatingFund || funds.length === 0) {
      if (!newFundName.trim()) {
        Alert.alert('Missing Fund Name', 'Please enter the name of the mutual fund or fetch it via Scheme Code.');
        return;
      }
      const initialVal = parseFloat(newFundCurrentValue);
      const parsedNav = parseFloat(nav);
      const parsedUnits = parseFloat(units);

      // Auto-calculate initial current value if units and nav are available
      let fundCurrentVal = 0;
      if (!isNaN(initialVal) && initialVal >= 0) {
        fundCurrentVal = initialVal;
      } else if (!isNaN(parsedUnits) && !isNaN(parsedNav) && parsedUnits > 0 && parsedNav > 0) {
        fundCurrentVal = Math.round(parsedUnits * parsedNav * 100) / 100;
      } else if (type === 'BUY') {
        fundCurrentVal = parsedAmount;
      }

      targetFundId = onCreateFund(
        newFundName.trim(),
        newFundFolio.trim(),
        fundCurrentVal,
        newFundSchemeCode.trim() || undefined,
        fetchedNav || (nav ? parseFloat(nav) : undefined),
        fetchedNavDate || undefined
      );
    }

    if (!targetFundId) {
      Alert.alert('Error', 'Unable to create or select fund.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const cleanDate = date.trim() ? normalizeDate(date.trim()) || date.trim() : todayStr;

    onSaveTransaction({
      fund_id: targetFundId,
      date: cleanDate,
      type,
      amount: parsedAmount,
      nav: nav ? parseFloat(nav) : undefined,
      units: units ? parseFloat(units) : undefined,
    });

    // Reset state
    setSelectedFundInfo(null);
    setAmount('');
    setNav('');
    setUnits('');
    setNewFundSchemeCode('');
    setNewFundName('');
    setNewFundFolio('');
    setNewFundCurrentValue('');
    setFetchedNav(null);
    setFetchedNavDate(null);
    if (funds.length > 0) {
      setIsCreatingFund(false);
    }
    onClose();
  };

  const handleImportBatchOrders = (
    orders: Array<{
      date: string;
      type: 'BUY' | 'SELL';
      amount: number;
      nav?: number;
      units?: number;
    }>
  ) => {
    let targetFundId = selectedFundId;

    if (isCreatingFund || funds.length === 0) {
      if (!newFundName.trim()) {
        Alert.alert(
          'Missing Fund Name',
          'Please select a mutual fund from the dropdown or enter its name before importing orders.'
        );
        return;
      }

      // Calculate initial fund valuation from total units * latest NAV
      let totalUnits = 0;
      orders.forEach((o) => {
        const u = o.units || (o.nav && o.nav > 0 ? o.amount / o.nav : 0);
        if (o.type === 'BUY') totalUnits += u;
        else totalUnits -= u;
      });
      totalUnits = Math.max(0, totalUnits);

      const navToUse = fetchedNav || (orders[0]?.nav ?? 0);
      const initialValue =
        totalUnits > 0 && navToUse > 0 ? Math.round(totalUnits * navToUse * 100) / 100 : 0;

      targetFundId = onCreateFund(
        newFundName.trim(),
        newFundFolio.trim(),
        initialValue,
        newFundSchemeCode.trim() || undefined,
        fetchedNav || undefined,
        fetchedNavDate || undefined
      );
    }

    if (!targetFundId) {
      Alert.alert('Error', 'Unable to create or select fund for batch import.');
      return;
    }

    if (onSaveBatchTransactions) {
      onSaveBatchTransactions(targetFundId, orders);
    } else {
      orders.forEach((o) => {
        onSaveTransaction({
          fund_id: targetFundId,
          ...o,
        });
      });
    }

    Alert.alert(
      'Import Successful',
      `Successfully imported ${orders.length} order(s) for "${newFundName || funds.find((f) => f.id === targetFundId)?.name}".`
    );

    // Reset and close
    handleClearDropdown();
    setNewFundFolio('');
    setAmount('');
    setNav('');
    setUnits('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>+ Add MF Transaction</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Mode Switcher: Single Order vs Bulk CSV Import */}
            <View style={styles.orderModeContainer}>
              <TouchableOpacity
                style={[styles.orderModeBtn, orderMode === 'single' && styles.orderModeBtnActive]}
                onPress={() => setOrderMode('single')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.orderModeBtnText,
                    orderMode === 'single' && styles.orderModeBtnTextActive,
                  ]}
                >
                  📝 Single Order
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.orderModeBtn, orderMode === 'bulk' && styles.orderModeBtnActive]}
                onPress={() => setOrderMode('bulk')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.orderModeBtnText,
                    orderMode === 'bulk' && styles.orderModeBtnTextActive,
                  ]}
                >
                  📂 Bulk Orders (CSV)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Fund Selector Header */}
            <View style={styles.fundHeaderRow}>
              <Text style={styles.inputLabel}>Mutual Fund</Text>
              {hasExistingFunds && (
                <TouchableOpacity
                  onPress={() => setIsCreatingFund(!isCreatingFund)}
                  style={styles.toggleFundBtn}
                >
                  <Text style={styles.toggleFundBtnText}>
                    {isCreatingFund ? '← Choose Existing' : '+ New Fund'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {!isCreatingFund && hasExistingFunds ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.fundPills}
                contentContainerStyle={{ paddingRight: 10 }}
              >
                {funds.map((f) => {
                  const isSelected = selectedFundId === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.fundPill, isSelected && styles.fundPillSelected]}
                      onPress={() => {
                        setSelectedFundId(f.id);
                        if (f.current_nav && f.current_nav > 0) {
                          setNav(f.current_nav.toString());
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.fundPillText, isSelected && styles.fundPillTextSelected]}
                        numberOfLines={1}
                      >
                        {f.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.newFundBox}>
                {/* Available Fund Search Dropdown with Auto AMFI Selection */}
                <FundSearchDropdown
                  onSelect={handleSelectFromDropdown}
                  selectedFund={selectedFundInfo}
                  onClear={handleClearDropdown}
                  label="Search & Select Mutual Fund (AMFI Dropdown)"
                />

                {/* Folio */}
                <Text style={styles.subInputLabel}>Folio Number (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Folio Number (e.g. 101/2345678)"
                  placeholderTextColor="#64748B"
                  value={newFundFolio}
                  onChangeText={setNewFundFolio}
                />

                {/* If no fund was selected via dropdown, allow typing manually or entering AMFI code */}
                {!selectedFundInfo && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.subInputLabel, { color: '#94A3B8', fontSize: 11 }]}>
                      Or enter AMFI code manually:
                    </Text>
                    <View style={styles.schemeInputRow}>
                      <TextInput
                        style={[styles.input, styles.schemeInput]}
                        placeholder="e.g. 147946"
                        placeholderTextColor="#64748B"
                        keyboardType="numeric"
                        value={newFundSchemeCode}
                        onChangeText={setNewFundSchemeCode}
                      />
                      <TouchableOpacity
                        style={[styles.fetchBtn, isFetchingScheme && { opacity: 0.6 }]}
                        onPress={() => handleFetchScheme()}
                        disabled={isFetchingScheme}
                        activeOpacity={0.8}
                      >
                        {isFetchingScheme ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.fetchBtnText}>⚡ Fetch NAV</Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.subInputLabel, { marginTop: 8 }]}>Fund Name *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Fund Name (e.g. Bandhan Small Cap Fund)"
                      placeholderTextColor="#64748B"
                      value={newFundName}
                      onChangeText={setNewFundName}
                    />
                  </View>
                )}

                {fetchedNav && !selectedFundInfo ? (
                  <View style={styles.fetchedNavPill}>
                    <Text style={styles.fetchedNavText}>
                      ✓ AMFI NAV: ₹{fetchedNav.toFixed(3)} ({fetchedNavDate})
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Bulk Order CSV Import Mode */}
            {orderMode === 'bulk' ? (
              <BulkOrderImport
                onImportOrders={handleImportBatchOrders}
                onCancel={onClose}
              />
            ) : (
              /* Single Order Entry Form */
              <>
                {/* Type Segmented Control */}
                <View style={styles.segmentContainer}>
                  <TouchableOpacity
                    style={[styles.segment, type === 'BUY' && styles.segmentActiveBuy]}
                    onPress={() => setType('BUY')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, type === 'BUY' && styles.segmentTextActive]}>
                      Buy / SIP
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segment, type === 'SELL' && styles.segmentActiveSell]}
                    onPress={() => setType('SELL')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, type === 'SELL' && styles.segmentTextActive]}>
                      Redeem / Sell
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Transaction Amount */}
                <Text style={styles.inputLabel}>Transaction Amount (₹) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 5000"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={handleAmountChange}
                />

                {/* Date */}
                <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  placeholderTextColor="#64748B"
                  onChangeText={setDate}
                />

                {/* Purchase NAV & Units */}
                <View style={styles.rowInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.inputLabel}>Purchase NAV</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 57.63"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      value={nav}
                      onChangeText={handleNavChange}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.inputLabel}>Units (Auto-calculated)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Calculated"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      value={units}
                      onChangeText={setUnits}
                    />
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          {/* Action Buttons (Only for single order mode) */}
          {orderMode === 'single' && (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
                <Text style={styles.saveText}>Save Transaction</Text>
              </TouchableOpacity>
            </View>
          )}
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
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  closeIcon: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '700',
    padding: 4,
  },
  scroll: {
    marginBottom: 16,
  },
  orderModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  orderModeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  orderModeBtnActive: {
    backgroundColor: '#3B82F6',
  },
  orderModeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  orderModeBtnTextActive: {
    color: '#FFFFFF',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActiveBuy: {
    backgroundColor: '#3B82F6',
  },
  segmentActiveSell: {
    backgroundColor: '#EF4444',
  },
  segmentText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 14,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  fundHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 10,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  toggleFundBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  toggleFundBtnText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
  },
  fundPills: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  fundPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
    maxWidth: 220,
  },
  fundPillSelected: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  fundPillText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  fundPillTextSelected: {
    color: '#60A5FA',
    fontWeight: '700',
  },
  newFundBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  schemeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  schemeInput: {
    flex: 1,
    marginVertical: 0,
  },
  fetchBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 105,
  },
  fetchBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  fetchedNavPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  fetchedNavText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    marginTop: 6,
    marginBottom: 10,
  },
  rowInputs: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cancelText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
