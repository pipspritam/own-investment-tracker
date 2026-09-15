import React, { useState } from 'react';
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
import { formatINR } from '../utils/currency';
import { normalizeDate } from '../utils/csvParser';
import DatePickerInput from './DatePickerInput';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (tx: {
    date: string;
    type: 'INVEST' | 'WITHDRAW';
    amount: number;
    notes?: string;
  }) => void;
}

export default function AddPPFTransactionModal({
  visible,
  onClose,
  onSave,
}: Props) {
  const [type, setType] = useState<'INVEST' | 'WITHDRAW'>('INVEST');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setType('INVEST');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    const normDate = normalizeDate(date);
    if (!normDate) {
      Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD or DD/MM/YYYY format.');
      return;
    }

    onSave({
      date: normDate,
      type,
      amount: parsedAmount,
      notes: notes.trim() || undefined,
    });

    handleClose();
  };

  const parsedAmount = parseFloat(amount);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Record PPF Transaction</Text>
              <Text style={styles.modalSubtitle}>Deposit or withdrawal entry</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
            {/* Transaction Type Segmented Toggle */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>TRANSACTION TYPE</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, type === 'INVEST' && styles.typeBtnInvestActive]}
                  onPress={() => setType('INVEST')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      type === 'INVEST' && styles.typeBtnTextActive,
                    ]}
                  >
                    + Deposit (Invest)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeBtn, type === 'WITHDRAW' && styles.typeBtnWithdrawActive]}
                  onPress={() => setType('WITHDRAW')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      type === 'WITHDRAW' && styles.typeBtnTextActive,
                    ]}
                  >
                    - Withdrawal
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Amount */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>AMOUNT (₹) *</Text>
              <TextInput
                style={styles.textInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="e.g. 50000 or 150000"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
              />
              {!isNaN(parsedAmount) && parsedAmount > 0 && (
                <Text style={styles.amountHelperText}>
                  {type === 'INVEST' ? 'Deposit' : 'Withdrawal'}: {formatINR(parsedAmount)}
                </Text>
              )}
            </View>

            {/* Date Input with DatePicker */}
            <View style={styles.fieldGroup}>
              <DatePickerInput
                label="TRANSACTION DATE *"
                value={date}
                onChangeDate={setDate}
                placeholder="YYYY-MM-DD"
              />
            </View>

            {/* Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>REMARKS / NOTES (OPTIONAL)</Text>
              <TextInput
                style={styles.textInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. FY 2024-25 80C deposit, annual interest, etc."
                placeholderTextColor="#64748B"
              />
            </View>

            {/* Explanatory Banner */}
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerIcon}>💡</Text>
              <Text style={styles.infoBannerText}>
                Total Invested will automatically be calculated as sum of Deposits minus Withdrawals. Current balance is updated manually from your passbook.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveBtnText}>Save Transaction</Text>
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
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  typeBtnInvestActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
  },
  typeBtnWithdrawActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  typeBtnTextActive: {
    color: '#F8FAFC',
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
  amountHelperText: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 6,
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    marginTop: 4,
  },
  infoBannerIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
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
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
});
