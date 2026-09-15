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
import { StockTransaction } from '../types';
import { formatINR } from '../utils/currency';
import { normalizeDate } from '../utils/csvParser';

interface Props {
  transaction: StockTransaction | null;
  visible: boolean;
  onClose: () => void;
  onSave: (tx: {
    id: number;
    date: string;
    type: 'BUY' | 'SELL' | 'DIVIDEND';
    price: number;
    quantity: number;
    amount: number;
  }) => void;
  onDelete?: (id: number) => void;
}

export default function EditStockTransactionModal({
  transaction,
  visible,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [type, setType] = useState<'BUY' | 'SELL' | 'DIVIDEND'>('BUY');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setPrice(transaction.price.toString());
      setQuantity(transaction.quantity.toString());
      setDate(transaction.date);
    }
  }, [transaction]);

  const parsedPrice = parseFloat(price);
  const parsedQuantity = parseFloat(quantity);
  const autoAmount = useMemo(() => {
    if (!isNaN(parsedPrice) && !isNaN(parsedQuantity) && parsedPrice > 0 && parsedQuantity > 0) {
      return Math.round(parsedPrice * parsedQuantity * 100) / 100;
    }
    return 0;
  }, [parsedPrice, parsedQuantity]);

  if (!transaction) return null;

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
      Alert.alert(
        'Invalid Quantity',
        type === 'DIVIDEND'
          ? 'Please enter a valid number of eligible shares.'
          : 'Please enter a valid number of shares.'
      );
      return;
    }

    const cleanDate = date.trim() ? normalizeDate(date.trim()) || date.trim() : transaction.date;

    onSave({
      id: transaction.id,
      date: cleanDate,
      type,
      price: parsedPrice,
      quantity: parsedQuantity,
      amount: autoAmount,
    });
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete this ${transaction.type} transaction of ${transaction.quantity} shares of "${transaction.stock_name}"?\n\nThis will automatically recalculate your invested balance and portfolio totals.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (onDelete) onDelete(transaction.id);
            onClose();
          },
        },
      ]
    );
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
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.title}>Edit Stock Order</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {transaction.stock_name} {transaction.stock_symbol ? `(${transaction.stock_symbol})` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Transaction Type Segment */}
            <Text style={styles.inputLabel}>Transaction Type</Text>
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
                onPress={() => setType('DIVIDEND')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, type === 'DIVIDEND' && styles.segmentTextActive]}>
                  💰 DIVIDEND
                </Text>
              </TouchableOpacity>
            </View>

            {/* Price & Quantity */}
            <View style={styles.twoColumnRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>
                  {type === 'BUY'
                    ? 'Buy Price (₹/share)'
                    : type === 'SELL'
                    ? 'Sale Price (₹/share)'
                    : 'Div / Share (₹)'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={type === 'DIVIDEND' ? 'e.g. 10.50' : 'Price'}
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>
                  {type === 'DIVIDEND' ? 'Eligible Shares' : 'Number of Stock (Shares)'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Shares"
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
                    : 'Price × Shares'}
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

            {/* Date */}
            <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#64748B"
              value={date}
              onChangeText={setDate}
            />

            {/* Save & Delete Buttons */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>

            {onDelete && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteBtnText}>🗑️ Delete Order</Text>
              </TouchableOpacity>
            )}
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
    maxHeight: '85%',
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
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
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
  twoColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    marginBottom: 12,
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
    marginTop: 6,
    marginBottom: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
});
