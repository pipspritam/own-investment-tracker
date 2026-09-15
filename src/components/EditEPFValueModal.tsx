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
} from 'react-native';
import { EPFAccount } from '../types';
import { formatINR, formatPercentage } from '../utils/currency';

interface Props {
  visible: boolean;
  account: EPFAccount | null;
  totalInvested: number;
  onClose: () => void;
  onSave: (currentValue: number, uan?: string, companyName?: string) => void;
}

export default function EditEPFValueModal({
  visible,
  account,
  totalInvested,
  onClose,
  onSave,
}: Props) {
  const [currentValue, setCurrentValue] = useState('');
  const [uan, setUan] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    if (account) {
      setCurrentValue(account.current_value ? account.current_value.toString() : '');
      setUan(account.uan || '');
      setCompanyName(account.company_name || '');
    }
  }, [account]);

  const parsedValue = parseFloat(currentValue) || 0;
  const projectedReturn = parsedValue - totalInvested;
  const projectedReturnPct = totalInvested > 0 ? (projectedReturn / totalInvested) * 100 : 0;
  const isProfit = projectedReturn >= 0;

  const handleSave = () => {
    const val = parseFloat(currentValue);
    if (isNaN(val) || val < 0) {
      Alert.alert('Invalid Balance', 'Please enter a valid current balance (0 or higher).');
      return;
    }

    onSave(val, uan.trim() || undefined, companyName.trim() || undefined);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Update EPF Valuation</Text>
              <Text style={styles.modalSubtitle}>From your EPFO portal or UMANG passbook</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
            {/* Current Value Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CURRENT EPF BALANCE (₹) *</Text>
              <TextInput
                style={[styles.textInput, styles.highlightInput]}
                value={currentValue}
                onChangeText={setCurrentValue}
                placeholder="e.g. 249444"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                autoFocus
              />
              <Text style={styles.inputHelperText}>
                Enter the latest total balance (Employee + Employer share + Interest) from EPFO passbook.
              </Text>
            </View>

            {/* Live Projected Return Preview Card */}
            <View style={styles.previewCard}>
              <Text style={styles.previewHeader}>VALUATION SUMMARY PREVIEW</Text>
              
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Auto-calculated Invested:</Text>
                <Text style={styles.previewValue}>{formatINR(totalInvested)}</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>New Balance (Current Value):</Text>
                <Text style={[styles.previewValue, { color: '#8B5CF6' }]}>
                  {formatINR(parsedValue)}
                </Text>
              </View>

              <View style={styles.previewDivider} />

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total Accrued Interest / Gain:</Text>
                <Text
                  style={[
                    styles.previewValue,
                    { color: isProfit ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {formatINR(projectedReturn, { showSign: true })}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Absolute Return %:</Text>
                <Text
                  style={[
                    styles.previewValue,
                    { color: isProfit ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {formatPercentage(projectedReturnPct)}
                </Text>
              </View>
            </View>

            {/* Optional Account Details */}
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionHeader}>ACCOUNT DETAILS (OPTIONAL)</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>UAN (UNIVERSAL ACCOUNT NUMBER)</Text>
              <TextInput
                style={styles.textInput}
                value={uan}
                onChangeText={setUan}
                placeholder="e.g. 101234567890"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMPLOYER / ESTABLISHMENT NAME</Text>
              <TextInput
                style={styles.textInput}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="e.g. Current Employer Ltd."
                placeholderTextColor="#64748B"
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveBtnText}>Update Balance</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formScroll: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#F8FAFC',
  },
  highlightInput: {
    borderColor: '#8B5CF6',
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  inputHelperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  previewCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 6,
    marginBottom: 16,
  },
  previewHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  previewLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 8,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginTop: 8,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  footerRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94A3B8',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
