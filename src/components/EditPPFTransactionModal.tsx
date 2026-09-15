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
import { PPFTransaction } from '../types';
import { formatINR } from '../utils/currency';
import { normalizeDate } from '../utils/csvParser';
import DatePickerInput from './DatePickerInput';

interface Props {
  transaction: PPFTransaction | null;
  visible: boolean;
  onClose: () => void;
  onSave: (tx: {
    id: number;
    date: string;
    type: 'INVEST' | 'WITHDRAW';
    amount: number;
    notes?: string;
  }) => void;
  onDelete?: (id: number) => void;
}

export default function EditPPFTransactionModal({
  transaction,
  visible,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [type, setType] = useState<'INVEST' | 'WITHDRAW'>('INVEST');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(transaction.amount.toString());
      setDate(transaction.date);
      setNotes(transaction.notes || '');
    }
  }, [transaction]);

  const handleSave = () => {
    if (!transaction) return;

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
      id: transaction.id,
      date: normDate,
      type,
      amount: parsedAmount,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  const handleDelete = () => {
    if (!transaction || !onDelete) return;

    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete this ${transaction.type === 'INVEST' ? 'Deposit' : 'Withdrawal'} of ${formatINR(transaction.amount)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(transaction.id);
            onClose();
          },
        },
      ]
    );
  };

  const parsedAmount = parseFloat(amount);

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
              <Text style={styles.modalTitle}>Edit PPF Transaction</Text>
              <Text style={styles.modalSubtitle}>Modify passbook entry</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
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
                placeholder="e.g. 50000"
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
                placeholder="e.g. FY 2024-25 80C deposit"
                placeholderTextColor="#64748B"
              />
            </View>

            {/* Delete Option */}
            {onDelete && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteButtonText}>🗑 Delete Transaction</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveBtnText}>Update</Text>
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
  deleteButton: {
    marginTop: 10,
    marginBottom: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
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
