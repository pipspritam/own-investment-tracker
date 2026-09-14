import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AssetAllocation } from '../types';

interface Props {
  asset: AssetAllocation | null;
  visible: boolean;
  onClose: () => void;
  onSave: (currentVal: number, investedVal?: number) => void;
}

export default function EditAssetModal({ asset, visible, onClose, onSave }: Props) {
  const [currentValue, setCurrentValue] = useState('');
  const [investedValue, setInvestedValue] = useState('');

  useEffect(() => {
    if (asset) {
      setCurrentValue(asset.current_value.toString());
      setInvestedValue(asset.invested_amount.toString());
    }
  }, [asset]);

  if (!asset) return null;

  const handleSave = () => {
    const cur = parseFloat(currentValue);
    const inv = parseFloat(investedValue);
    if (!isNaN(cur) && cur >= 0) {
      onSave(cur, isNaN(inv) ? undefined : Math.max(0, inv));
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Update Valuation</Text>
          <Text style={styles.subtitle}>{asset.asset_type}</Text>

          <Text style={styles.label}>Current Valuation (₹)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={currentValue}
            placeholderTextColor="#64748B"
            onChangeText={setCurrentValue}
          />

          <Text style={styles.label}>Invested Amount (₹)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={investedValue}
            placeholderTextColor="#64748B"
            onChangeText={setInvestedValue}
          />

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
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 22,
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
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
    paddingVertical: 11,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
