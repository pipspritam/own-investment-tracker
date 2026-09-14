import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { MFFund, MFTransaction } from '../types';
import { formatINR, formatUnits, formatLastUpdated } from '../utils/currency';
import { calculateXIRR, formatXIRR } from '../utils/xirr';
import { fetchFundDetails } from '../services/mfapi';
import FundSearchDropdown, { SelectedFundInfo } from './FundSearchDropdown';

interface Props {
  fund: MFFund | null;
  transactions?: MFTransaction[];
  visible: boolean;
  onClose: () => void;
  onSave: (
    fundId: number,
    data: {
      current_value: number;
      scheme_code?: string;
      current_nav?: number;
      nav_date?: string;
      name?: string;
      folio_number?: string;
    }
  ) => void;
}

export default function EditFundValueModal({
  fund,
  transactions = [],
  visible,
  onClose,
  onSave,
}: Props) {
  const [currentValue, setCurrentValue] = useState('');
  const [schemeCode, setSchemeCode] = useState('');
  const [name, setName] = useState('');
  const [folio, setFolio] = useState('');
  const [currentNav, setCurrentNav] = useState<number | null>(null);
  const [navDate, setNavDate] = useState<string | null>(null);
  const [isFetchingNav, setIsFetchingNav] = useState(false);

  useEffect(() => {
    if (fund) {
      setCurrentValue(fund.current_value > 0 ? fund.current_value.toString() : '');
      setSchemeCode(fund.scheme_code || '');
      setName(fund.name);
      setFolio(fund.folio_number || '');
      setCurrentNav(fund.current_nav || null);
      setNavDate(fund.nav_date || null);
    }
  }, [fund]);

  const fundTransactions = useMemo(() => {
    if (!fund) return [];
    return transactions.filter((t) => t.fund_id === fund.id);
  }, [fund, transactions]);

  const totalUnits = fund?.total_units || 0;

  // Auto-calculated value from units * NAV
  const calculatedFromNav = useMemo(() => {
    if (currentNav && currentNav > 0 && totalUnits > 0) {
      return Math.round(totalUnits * currentNav * 100) / 100;
    }
    return null;
  }, [currentNav, totalUnits]);

  // Preview XIRR based on current typed value
  const previewXIRR = useMemo(() => {
    const val = parseFloat(currentValue);
    if (isNaN(val) || val <= 0 || fundTransactions.length === 0) return null;
    const flows = fundTransactions.map((t) => ({
      amount: t.type === 'BUY' ? -t.amount : t.amount,
      date: t.date,
    }));
    flows.push({
      amount: val,
      date: new Date().toISOString().split('T')[0],
    });
    return calculateXIRR(flows);
  }, [currentValue, fundTransactions]);

  if (!fund) return null;

  const handleSelectFund = (info: SelectedFundInfo) => {
    setSchemeCode(info.schemeCode.toString());
    setName(info.schemeName);
    if (info.latestNav) {
      setCurrentNav(info.latestNav);
      setNavDate(info.navDate || null);
      if (totalUnits > 0) {
        const autoVal = Math.round(totalUnits * info.latestNav * 100) / 100;
        setCurrentValue(autoVal.toString());
      }
    }
  };

  const handleFetchNAV = async () => {
    const code = schemeCode.trim();
    if (!code) {
      Alert.alert('Scheme Code Required', 'Please enter an AMFI Scheme Code (e.g. 147946 for Bandhan Small Cap).');
      return;
    }

    setIsFetchingNav(true);
    try {
      const details = await fetchFundDetails(code);
      if (details) {
        setCurrentNav(details.latestNav);
        setNavDate(details.navDate);

        // Auto calculate new value if units exist
        if (totalUnits > 0) {
          const autoVal = Math.round(totalUnits * details.latestNav * 100) / 100;
          setCurrentValue(autoVal.toString());
        }
      } else {
        Alert.alert('Not Found', `Unable to find mutual fund with scheme code ${code} on MFAPI.in.`);
      }
    } catch {
      Alert.alert('Network Error', 'Failed to fetch latest NAV from MFAPI.in.');
    } finally {
      setIsFetchingNav(false);
    }
  };

  const handleApplyCalculated = () => {
    if (calculatedFromNav !== null) {
      setCurrentValue(calculatedFromNav.toString());
    }
  };

  const handleSave = () => {
    const val = parseFloat(currentValue);
    if (isNaN(val) || val < 0) {
      Alert.alert('Invalid Value', 'Please enter a valid current valuation.');
      return;
    }

    onSave(fund.id, {
      current_value: val,
      scheme_code: schemeCode.trim() || undefined,
      current_nav: currentNav || undefined,
      nav_date: navDate || undefined,
      name: name.trim() || fund.name,
      folio_number: folio.trim(),
    });
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Fund Details & Valuation</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Fund Name */}
            <Text style={styles.label}>Fund Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              placeholderTextColor="#64748B"
              onChangeText={setName}
            />

            {/* Folio */}
            <Text style={styles.label}>Folio Number</Text>
            <TextInput
              style={styles.input}
              value={folio}
              placeholder="Folio number"
              placeholderTextColor="#64748B"
              onChangeText={setFolio}
            />

            {/* AMFI Scheme Search & Select */}
            <FundSearchDropdown
              onSelect={handleSelectFund}
              selectedFund={
                schemeCode
                  ? {
                      schemeCode: parseInt(schemeCode, 10) || 0,
                      schemeName: name,
                      latestNav: currentNav || undefined,
                      navDate: navDate || undefined,
                    }
                  : null
              }
              onClear={() => {
                setSchemeCode('');
                setCurrentNav(null);
                setNavDate(null);
              }}
              label="AMFI Mutual Fund Link (Search & Select)"
            />

            {/* AMFI Scheme Code with Fetch Button */}
            <Text style={styles.label}>AMFI Scheme Code (MFAPI.in)</Text>
            <View style={styles.schemeRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginVertical: 0 }]}
                placeholder="e.g. 147946"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={schemeCode}
                onChangeText={setSchemeCode}
              />
              <TouchableOpacity
                style={[styles.fetchBtn, isFetchingNav && { opacity: 0.6 }]}
                onPress={handleFetchNAV}
                disabled={isFetchingNav}
                activeOpacity={0.8}
              >
                {isFetchingNav ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.fetchBtnText}>⚡ Fetch NAV</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* NAV & Calculation Info Box */}
            <View style={styles.investedInfoBox}>
              <View style={styles.infoRow}>
                <View>
                  <Text style={styles.infoLabel}>Total Units</Text>
                  <Text style={styles.infoValue}>{formatUnits(totalUnits)} units</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.infoLabel}>Latest AMFI NAV</Text>
                  <Text style={styles.infoValue}>
                    {currentNav ? `₹${currentNav.toFixed(3)}` : 'Not fetched'}
                  </Text>
                </View>
              </View>

              {navDate ? (
                <Text style={styles.navDateSub}>NAV Date: {navDate}</Text>
              ) : null}

              {calculatedFromNav !== null && (
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={handleApplyCalculated}
                  activeOpacity={0.8}
                >
                  <Text style={styles.applyBtnText}>
                    ⚡ Apply NAV Value: {formatINR(calculatedFromNav)}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Current Market Value */}
            <Text style={styles.label}>Current Market Value (₹) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="Enter current value"
              placeholderTextColor="#64748B"
              value={currentValue}
              onChangeText={setCurrentValue}
            />

            {/* Live XIRR preview */}
            {previewXIRR !== null && (
              <View style={styles.xirrPreviewBox}>
                <Text style={styles.xirrPreviewLabel}>Estimated XIRR:</Text>
                <Text
                  style={[
                    styles.xirrPreviewValue,
                    { color: previewXIRR >= 0 ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {formatXIRR(previewXIRR)}
                </Text>
              </View>
            )}

            <Text style={styles.lastUpdatedText}>
              Last updated: {formatLastUpdated(fund.updated_at)}
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  closeIcon: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '700',
  },
  scroll: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  schemeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  fetchBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 11,
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
  investedInfoBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F1F5F9',
    marginTop: 2,
  },
  navDateSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  applyBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    marginTop: 10,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#60A5FA',
    fontWeight: '700',
    fontSize: 12,
  },
  xirrPreviewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  xirrPreviewLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  xirrPreviewValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  lastUpdatedText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
