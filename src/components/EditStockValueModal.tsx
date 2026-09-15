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
  Alert,
  ScrollView,
} from 'react-native';
import { Stock, StockTransaction } from '../types';
import { formatINR, formatPercentage, formatLastUpdated } from '../utils/currency';
import { calculateXIRR, formatXIRR } from '../utils/xirr';

interface Props {
  stock: Stock | null;
  transactions?: StockTransaction[];
  visible: boolean;
  onClose: () => void;
  onSave: (
    stockId: number,
    data: {
      current_value: number;
      name?: string;
      symbol?: string;
    }
  ) => void;
}

export default function EditStockValueModal({
  stock,
  transactions = [],
  visible,
  onClose,
  onSave,
}: Props) {
  const [currentValue, setCurrentValue] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');

  useEffect(() => {
    if (stock) {
      setCurrentValue(stock.current_value > 0 ? stock.current_value.toString() : '');
      setName(stock.name);
      setSymbol(stock.symbol || '');
    }
  }, [stock]);

  const stockTransactions = useMemo(() => {
    if (!stock) return [];
    return transactions.filter((t) => t.stock_id === stock.id);
  }, [stock, transactions]);

  const totalInvested = stock?.total_invested || 0;
  const totalQuantity = stock?.total_quantity || 0;
  const avgPrice = totalQuantity > 0 && totalInvested > 0 ? totalInvested / totalQuantity : 0;

  // Live preview metrics based on typed current value
  const previewVal = parseFloat(currentValue);
  const isValidVal = !isNaN(previewVal) && previewVal >= 0;
  const previewGain = isValidVal ? previewVal - totalInvested : 0;
  const previewReturnPct = isValidVal && totalInvested > 0 ? (previewGain / totalInvested) * 100 : 0;
  const isProfit = previewGain >= 0;

  // Live preview XIRR based on typed current value
  const previewXIRR = useMemo(() => {
    if (!isValidVal || previewVal <= 0 || stockTransactions.length === 0) return null;
    const flows = stockTransactions.map((t) => ({
      amount: t.type === 'BUY' ? -t.amount : t.amount,
      date: t.date,
    }));
    flows.push({
      amount: previewVal,
      date: new Date().toISOString().split('T')[0],
    });
    return calculateXIRR(flows);
  }, [isValidVal, previewVal, stockTransactions]);

  if (!stock) return null;

  const handleSave = () => {
    const val = parseFloat(currentValue);
    if (isNaN(val) || val < 0) {
      Alert.alert('Invalid Value', 'Please enter a valid current valuation (0 or greater).');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Missing Name', 'Stock name cannot be empty.');
      return;
    }

    onSave(stock.id, {
      current_value: val,
      name: name.trim(),
      symbol: symbol.trim().toUpperCase() || undefined,
    });
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
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.title}>Update Stock Valuation</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {stock.name} {stock.symbol ? `(${stock.symbol})` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Holdings Summary Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoCell}>
                  <Text style={styles.infoLabel}>CALCULATED INVESTED</Text>
                  <Text style={styles.infoValue}>{formatINR(totalInvested)}</Text>
                </View>
                <View style={[styles.infoCell, { alignItems: 'flex-end' }]}>
                  <Text style={styles.infoLabel}>SHARES HELD</Text>
                  <Text style={styles.infoValue}>
                    {totalQuantity} {totalQuantity === 1 ? 'share' : 'shares'}
                  </Text>
                </View>
              </View>

              {avgPrice > 0 && (
                <View style={[styles.infoRow, { marginTop: 8 }]}>
                  <Text style={styles.avgPriceText}>
                    Avg Cost Basis: <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>₹{avgPrice.toFixed(2)}</Text> / share
                  </Text>
                  <Text style={styles.lastUpdatedText}>
                    Last updated: {stock.updated_at ? formatLastUpdated(stock.updated_at) : 'Never'}
                  </Text>
                </View>
              )}
            </View>

            {/* Live CMP Quick Apply Banner */}
            {stock.current_price !== undefined && stock.current_price > 0 && totalQuantity > 0 && (
              <TouchableOpacity
                style={styles.liveCmpBanner}
                onPress={() => {
                  const liveVal = Math.round(totalQuantity * stock.current_price! * 100) / 100;
                  setCurrentValue(liveVal.toString());
                }}
                activeOpacity={0.8}
              >
                <View style={styles.liveCmpHeader}>
                  <Text style={styles.liveCmpTitle}>⚡ LIVE CMP VALUE</Text>
                  <Text style={styles.liveCmpTap}>Tap to Apply</Text>
                </View>
                <Text style={styles.liveCmpAmount}>
                  {formatINR(totalQuantity * stock.current_price)}
                </Text>
                <Text style={styles.liveCmpSub}>
                  {totalQuantity} shares × ₹{stock.current_price.toFixed(2)} CMP
                </Text>
              </TouchableOpacity>
            )}

            {/* Current Market Value Input (User puts this) */}
            <Text style={styles.inputLabel}>Current Market Value (₹) *</Text>
            <TextInput
              style={[styles.input, styles.valuationInput]}
              placeholder="e.g. 28000"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={currentValue}
              onChangeText={setCurrentValue}
              autoFocus
            />

            {/* Real-time Returns & XIRR Live Preview */}
            {isValidVal && (
              <View style={styles.previewCard}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Estimated Total Return:</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={[
                        styles.previewVal,
                        { color: isProfit ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {formatINR(previewGain, { showSign: true })}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: isProfit
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: isProfit ? '#10B981' : '#EF4444' },
                        ]}
                      >
                        {formatPercentage(previewReturnPct)}
                      </Text>
                    </View>
                  </View>
                </View>

                {previewXIRR !== null && (
                  <View style={[styles.previewRow, { marginTop: 6 }]}>
                    <Text style={styles.previewLabel}>Estimated Stock XIRR:</Text>
                    <Text
                      style={[
                        styles.previewVal,
                        { color: previewXIRR >= 0 ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {formatXIRR(previewXIRR)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Editable Details (Name & Symbol) */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Stock Details</Text>
            <Text style={styles.subInputLabel}>Stock Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Stock Name"
              placeholderTextColor="#64748B"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.subInputLabel}>Stock Symbol / Ticker</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. RELIANCE, TCS"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              value={symbol}
              onChangeText={setSymbol}
            />

            {/* Save Button */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Save Valuation</Text>
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
  infoCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoCell: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  avgPriceText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  lastUpdatedText: {
    fontSize: 11,
    color: '#64748B',
  },
  liveCmpBanner: {
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  liveCmpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveCmpTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  liveCmpTap: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '700',
  },
  liveCmpAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    marginVertical: 2,
  },
  liveCmpSub: {
    fontSize: 11,
    color: '#94A3B8',
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
    marginBottom: 4,
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
  valuationInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B82F6',
    borderColor: '#3B82F6',
  },
  previewCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  previewVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
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
