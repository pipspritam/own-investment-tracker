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
import { MFTransaction } from '../types';

interface Props {
  transaction: MFTransaction | null;
  visible: boolean;
  onClose: () => void;
  onSave: (tx: {
    id: number;
    date: string;
    type: 'BUY' | 'SELL';
    amount: number;
    nav?: number;
    units?: number;
  }) => void;
}

export default function EditTransactionModal({
  transaction,
  visible,
  onClose,
  onSave,
}: Props) {
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [nav, setNav] = useState('');
  const [units, setUnits] = useState('');

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(transaction.amount.toString());
      setDate(transaction.date);
      setNav(transaction.nav !== undefined && transaction.nav !== null ? transaction.nav.toString() : '');
      setUnits(transaction.units !== undefined && transaction.units !== null ? transaction.units.toString() : '');
    }
  }, [transaction]);

  if (!transaction) return null;

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

    onSave({
      id: transaction.id,
      date: date.trim() || transaction.date,
      type,
      amount: parsedAmount,
      nav: nav ? parseFloat(nav) : undefined,
      units: units ? parseFloat(units) : undefined,
    });
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
            <View>
              <Text style={styles.title}>Edit Transaction</Text>
              <Text style={styles.fundSubtitle} numberOfLines={1}>
                {transaction.fund_name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
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

            {/* Amount */}
            <Text style={styles.inputLabel}>Transaction Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="e.g. 5000"
              placeholderTextColor="#64748B"
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

            {/* NAV & Units */}
            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>NAV (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 74.80"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={nav}
                  onChangeText={handleNavChange}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>Units (Optional)</Text>
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
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveText}>Save Changes</Text>
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
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
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
  fundSubtitle: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '700',
    marginTop: 2,
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
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
  },
  rowInputs: {
    flexDirection: 'row',
    marginBottom: 6,
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
