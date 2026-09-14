import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { parseCSVOrders, getSampleCSVTemplate, ParsedCSVOrder } from '../utils/csvParser';
import { formatINR, formatUnits } from '../utils/currency';

interface Props {
  onImportOrders: (
    orders: Array<{
      date: string;
      type: 'BUY' | 'SELL';
      amount: number;
      nav?: number;
      units?: number;
    }>
  ) => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export default function BulkOrderImport({ onImportOrders, onCancel, isSaving = false }: Props) {
  const [activeMode, setActiveMode] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedOrders, setParsedOrders] = useState<ParsedCSVOrder[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [totalInvested, setTotalInvested] = useState(0);
  const [totalUnits, setTotalUnits] = useState(0);
  const [isReadingFile, setIsReadingFile] = useState(false);

  const handleProcessText = (rawText: string, sourceName?: string) => {
    if (!rawText.trim()) {
      setParsedOrders([]);
      setParseErrors([]);
      setTotalInvested(0);
      setTotalUnits(0);
      return;
    }

    const result = parseCSVOrders(rawText);
    setParsedOrders(result.orders);
    setParseErrors(result.errors);
    setTotalInvested(result.totalInvested);
    setTotalUnits(result.totalUnits);
    if (sourceName) setFileName(sourceName);
  };

  const handlePickFile = async () => {
    setIsReadingFile(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'text/plain',
          'application/csv',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileAsset = result.assets[0];
        setFileName(fileAsset.name);

        // Fetch file content uniformly on React Native
        const response = await fetch(fileAsset.uri);
        const text = await response.text();
        setPastedText(text);
        handleProcessText(text, fileAsset.name);
      }
    } catch (err) {
      console.error('Error picking document:', err);
      Alert.alert('File Error', 'Could not read selected file. Please ensure it is a valid CSV.');
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleInsertSample = () => {
    const sample = getSampleCSVTemplate();
    setPastedText(sample);
    setFileName('sample_template.csv');
    handleProcessText(sample, 'sample_template.csv');
  };

  const handleResetData = () => {
    if (parsedOrders.length > 3) {
      Alert.alert(
        'Reset Loaded Orders?',
        `Are you sure you want to clear all ${parsedOrders.length} loaded order(s) and reset?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear All',
            style: 'destructive',
            onPress: () => {
              setPastedText('');
              setFileName(null);
              setParsedOrders([]);
              setParseErrors([]);
              setTotalInvested(0);
              setTotalUnits(0);
            },
          },
        ]
      );
    } else {
      setPastedText('');
      setFileName(null);
      setParsedOrders([]);
      setParseErrors([]);
      setTotalInvested(0);
      setTotalUnits(0);
    }
  };

  const handleDeleteRow = (id: string) => {
    const updated = parsedOrders.filter((o) => o.id !== id);
    setParsedOrders(updated);

    // Recalculate totals
    let newInvested = 0;
    let newUnits = 0;
    updated.forEach((o) => {
      if (o.isValid) {
        if (o.type === 'BUY') {
          newInvested += o.amount;
          if (o.units) newUnits += o.units;
        } else {
          newInvested -= o.amount;
          if (o.units) newUnits -= o.units;
        }
      }
    });
    setTotalInvested(Math.max(0, Math.round(newInvested * 100) / 100));
    setTotalUnits(Math.max(0, Math.round(newUnits * 1000) / 1000));
  };

  const handleConfirmImport = () => {
    const validOrders = parsedOrders.filter((o) => o.isValid);
    if (validOrders.length === 0) {
      Alert.alert(
        'No Valid Orders',
        'Please upload or paste a CSV file containing at least one valid order.'
      );
      return;
    }

    onImportOrders(
      validOrders.map((o) => ({
        date: o.date,
        type: o.type,
        amount: o.amount,
        nav: o.nav,
        units: o.units,
      }))
    );
  };

  const validCount = parsedOrders.filter((o) => o.isValid).length;

  return (
    <View style={styles.container}>
      {/* Mode Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeMode === 'upload' && styles.tabBtnActive]}
          onPress={() => setActiveMode('upload')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeMode === 'upload' && styles.tabBtnTextActive]}>
            📁 Upload CSV File
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeMode === 'paste' && styles.tabBtnActive]}
          onPress={() => setActiveMode('paste')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeMode === 'paste' && styles.tabBtnTextActive]}>
            📋 Paste CSV Text
          </Text>
        </TouchableOpacity>
      </View>

      {/* Upload Mode */}
      {activeMode === 'upload' && (
        <View style={styles.uploadBox}>
          <TouchableOpacity
            style={styles.pickFileBtn}
            onPress={handlePickFile}
            disabled={isReadingFile}
            activeOpacity={0.8}
          >
            {isReadingFile ? (
              <ActivityIndicator size="small" color="#60A5FA" />
            ) : (
              <>
                <Text style={styles.pickFileIcon}>📄</Text>
                <Text style={styles.pickFileTitle}>
                  {fileName ? `File: ${fileName}` : 'Choose CSV File from Device'}
                </Text>
                <Text style={styles.pickFileSub}>
                  Expected columns: Date, Type (BUY/SELL), NAV, Unit, Total Amount
                </Text>
              </>
            )}
          </TouchableOpacity>

          {fileName && (
            <View style={styles.fileSelectedBox}>
              <View style={styles.fileSelectedInfo}>
                <Text style={styles.fileSelectedIcon}>✓</Text>
                <Text style={styles.fileSelectedName} numberOfLines={1}>
                  {fileName}
                </Text>
              </View>
              <TouchableOpacity onPress={handleResetData} style={styles.clearFileBtn}>
                <Text style={styles.clearFileBtnText}>✕ Clear File</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.helperRow}>
            <Text style={styles.helperText}>Need a test template?</Text>
            <TouchableOpacity onPress={handleInsertSample}>
              <Text style={styles.helperLink}>Insert Sample Data ⚡</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Paste Mode */}
      {activeMode === 'paste' && (
        <View style={styles.pasteBox}>
          <View style={styles.pasteHeader}>
            <Text style={styles.pasteLabel}>CSV Content (Header + Rows)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {pastedText.length > 0 && (
                <TouchableOpacity onPress={handleResetData}>
                  <Text style={styles.clearTextLink}>Clear ✕</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleInsertSample}>
                <Text style={styles.helperLink}>Insert Sample ⚡</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TextInput
            style={styles.pasteInput}
            multiline
            numberOfLines={6}
            placeholder={`date,type,nav,unit,total amount\n2024-01-15,BUY,45.20,110.619,5000\n2024-02-15,BUY,46.50,107.526,5000`}
            placeholderTextColor="#64748B"
            value={pastedText}
            onChangeText={(txt) => {
              setPastedText(txt);
              handleProcessText(txt);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      {/* Format Notice */}
      <View style={styles.formatNotice}>
        <Text style={styles.formatNoticeTitle}>CSV Header Format:</Text>
        <Text style={styles.formatNoticeCode}>date, type, nav, unit, total amount</Text>
        <Text style={styles.formatNoticeDesc}>
          • Date can be YYYY-MM-DD or DD-MM-YYYY{'\n'}
          • Type can be BUY or SELL (SIP, Redemption supported){'\n'}
          • Missing units are auto-calculated from Amount / NAV
        </Text>
      </View>

      {/* Parse Errors if any */}
      {parseErrors.length > 0 && (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxTitle}>⚠️ Issues detected ({parseErrors.length}):</Text>
          {parseErrors.slice(0, 3).map((err, i) => (
            <Text key={i} style={styles.errorItem}>
              • {err}
            </Text>
          ))}
          {parseErrors.length > 3 && (
            <Text style={styles.errorItem}>...and {parseErrors.length - 3} more</Text>
          )}
        </View>
      )}

      {/* Parsed Orders Preview */}
      {parsedOrders.length > 0 && (
        <View style={styles.previewSection}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>
              Parsed Orders ({validCount} Valid / {parsedOrders.length} Total)
            </Text>
            <TouchableOpacity onPress={handleResetData} style={styles.resetHeaderBtn}>
              <Text style={styles.resetHeaderBtnText}>🔄 Clear / Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Aggregate Stats Summary */}
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Invested</Text>
              <Text style={styles.summaryVal}>{formatINR(totalInvested)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Units</Text>
              <Text style={styles.summaryVal}>{formatUnits(totalUnits)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Orders</Text>
              <Text style={styles.summaryVal}>{validCount}</Text>
            </View>
          </View>

          {/* Orders List */}
          <View style={styles.ordersList}>
            {parsedOrders.map((order, idx) => (
              <View
                key={order.id}
                style={[styles.orderRow, !order.isValid && styles.orderRowInvalid]}
              >
                <View style={styles.orderLeft}>
                  <View style={styles.orderBadgeRow}>
                    <Text style={styles.orderIndex}>#{idx + 1}</Text>
                    <View
                      style={[
                        styles.orderTypeBadge,
                        {
                          backgroundColor:
                            order.type === 'BUY'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(239, 68, 68, 0.2)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.orderTypeText,
                          { color: order.type === 'BUY' ? '#10B981' : '#EF4444' },
                        ]}
                      >
                        {order.type}
                      </Text>
                    </View>
                    <Text style={styles.orderDate}>{order.date}</Text>
                  </View>

                  <View style={styles.orderDetailsRow}>
                    <Text style={styles.orderDetailText}>
                      Amount: <Text style={styles.orderDetailVal}>{formatINR(order.amount)}</Text>
                    </Text>
                    {order.nav ? (
                      <Text style={styles.orderDetailText}>
                        NAV: <Text style={styles.orderDetailVal}>₹{order.nav.toFixed(2)}</Text>
                      </Text>
                    ) : null}
                    {order.units ? (
                      <Text style={styles.orderDetailText}>
                        Units: <Text style={styles.orderDetailVal}>{order.units.toFixed(3)}</Text>
                      </Text>
                    ) : null}
                  </View>

                  {order.error ? (
                    <Text style={styles.orderErrorText}>{order.error}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={() => handleDeleteRow(order.id)}
                  style={styles.deleteRowBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteRowText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Action Row: Reset & Import Buttons */}
          <View style={styles.bottomActionRow}>
            <TouchableOpacity
              style={styles.resetActionBtn}
              onPress={handleResetData}
              activeOpacity={0.8}
            >
              <Text style={styles.resetActionBtnText}>🔄 Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.importSubmitBtn, isSaving && { opacity: 0.6 }]}
              onPress={handleConfirmImport}
              disabled={isSaving || validCount === 0}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.importSubmitBtnText}>
                  🚀 Import {validCount} Order{validCount > 1 ? 's' : ''}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#3B82F6',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  uploadBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
  },
  pickFileBtn: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  pickFileIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  pickFileTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 4,
  },
  pickFileSub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
  },
  helperLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60A5FA',
  },
  pasteBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
  },
  pasteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pasteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  pasteInput: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    color: '#F8FAFC',
    fontSize: 12,
    fontFamily: 'monospace',
    minHeight: 110,
    textAlignVertical: 'top',
  },
  formatNotice: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  formatNoticeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60A5FA',
    marginBottom: 2,
  },
  formatNoticeCode: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
    fontFamily: 'monospace',
  },
  formatNoticeDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 10,
    marginTop: 10,
  },
  errorBoxTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 4,
  },
  errorItem: {
    fontSize: 11,
    color: '#FCA5A5',
  },
  previewSection: {
    marginTop: 14,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 2,
  },
  ordersList: {
    gap: 6,
    marginBottom: 12,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  orderRowInvalid: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  orderLeft: {
    flex: 1,
  },
  orderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  orderIndex: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  orderTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  orderTypeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  orderDate: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  orderDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderDetailText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  orderDetailVal: {
    fontWeight: '700',
    color: '#F8FAFC',
  },
  orderErrorText: {
    fontSize: 10,
    color: '#EF4444',
    marginTop: 2,
  },
  deleteRowBtn: {
    padding: 6,
    marginLeft: 6,
  },
  deleteRowText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: 'bold',
  },
  fileSelectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  fileSelectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  fileSelectedIcon: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: 'bold',
    marginRight: 6,
  },
  fileSelectedName: {
    fontSize: 12,
    color: '#F8FAFC',
    fontWeight: '600',
    flex: 1,
  },
  clearFileBtn: {
    backgroundColor: '#334155',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  clearFileBtnText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '700',
  },
  clearTextLink: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '700',
  },
  resetHeaderBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  resetHeaderBtnText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '700',
  },
  bottomActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resetActionBtn: {
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  resetActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  importSubmitBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  importSubmitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
