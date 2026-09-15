import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { normalizeDate } from '../utils/csvParser';

export interface DatePickerInputProps {
  label?: string;
  value: string; // YYYY-MM-DD
  onChangeDate: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const DAYS_OF_WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export default function DatePickerInput({
  label = 'Date (YYYY-MM-DD)',
  value,
  onChangeDate,
  placeholder = 'YYYY-MM-DD',
  disabled = false,
}: DatePickerInputProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);

  // Parse currently set date or default to today
  const today = useMemo(() => new Date(), []);
  const todayISO = useMemo(() => today.toISOString().split('T')[0], [today]);

  // Working state inside the calendar picker
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(value || todayISO);

  // Synchronize internal picker view whenever modal opens or value changes
  useEffect(() => {
    if (value) {
      const normalized = normalizeDate(value);
      if (normalized) {
        const parts = normalized.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          if (!isNaN(y) && !isNaN(m)) {
            setViewYear(y);
            setViewMonth(m);
            setSelectedDateStr(normalized);
            return;
          }
        }
      }
    }
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDateStr(value || todayISO);
  }, [value, modalVisible, today, todayISO]);

  const handleOpenPicker = () => {
    if (disabled) return;
    setShowYearSelector(false);
    setModalVisible(true);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Quick shortcut handlers
  const handleSelectToday = () => {
    const d = new Date();
    const iso = d.toISOString().split('T')[0];
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDateStr(iso);
  };

  const handleSelectYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const iso = d.toISOString().split('T')[0];
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDateStr(iso);
  };

  const handleSelectStartOfMonth = () => {
    const d = new Date(viewYear, viewMonth, 1);
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
    setSelectedDateStr(iso);
  };

  // Build days grid for current viewMonth/viewYear
  const calendarGrid = useMemo(() => {
    // Days in current month
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // First day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    // Convert to Monday = 0, ..., Sunday = 6
    const startDayIndex = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    // Days in previous month for leading padding
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      day: number;
      isCurrentMonth: boolean;
      dateStr: string;
    }> = [];

    // Leading padding days from previous month
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
      cells.push({ day: prevDay, isCurrentMonth: false, dateStr });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, isCurrentMonth: true, dateStr });
    }

    // Trailing padding days to fill 35 or 42 cells
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
        const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
        const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        cells.push({ day: i, isCurrentMonth: false, dateStr });
      }
    }

    return cells;
  }, [viewYear, viewMonth]);

  // Year options for quick year selection
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear - 15; y <= currentYear + 1; y++) {
      years.push(y);
    }
    return years.reverse();
  }, []);

  const handleApply = () => {
    if (selectedDateStr) {
      const normalized = normalizeDate(selectedDateStr) || selectedDateStr;
      onChangeDate(normalized);
    }
    setModalVisible(false);
  };

  const formattedDisplay = useMemo(() => {
    if (!selectedDateStr) return '';
    try {
      const parts = selectedDateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return `${d} ${SHORT_MONTH_NAMES[m]} ${y}`;
        }
      }
    } catch {
      // Fallback to raw string
    }
    return selectedDateStr;
  }, [selectedDateStr]);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}

      {/* Row containing Text Input and Calendar Picker Button */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor="#64748B"
          value={value}
          onChangeText={onChangeDate}
          editable={!disabled}
        />
        <TouchableOpacity
          style={styles.calendarBtn}
          onPress={handleOpenPicker}
          activeOpacity={0.75}
          disabled={disabled}
        >
          <Text style={styles.calendarIcon}>📅</Text>
          <Text style={styles.calendarBtnText}>Pick</Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Calendar Modal */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            {/* Header with Title & Formatted Date */}
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>Select Date</Text>
                <Text style={styles.pickerSelectedDisplay}>{formattedDisplay || selectedDateStr}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Presets Row */}
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={[styles.presetChip, selectedDateStr === todayISO && styles.presetChipActive]}
                onPress={handleSelectToday}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    selectedDateStr === todayISO && styles.presetChipTextActive,
                  ]}
                >
                  ⚡ Today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={handleSelectYesterday}
                activeOpacity={0.7}
              >
                <Text style={styles.presetChipText}>Yesterday</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={handleSelectStartOfMonth}
                activeOpacity={0.7}
              >
                <Text style={styles.presetChipText}>1st of Month</Text>
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigation Header */}
            <View style={styles.navHeader}>
              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={handlePrevMonth}
                activeOpacity={0.7}
              >
                <Text style={styles.navArrowText}>◀</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navMonthYearBtn}
                onPress={() => setShowYearSelector((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.navMonthYearText}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </Text>
                <Text style={styles.navDropdownIndicator}>
                  {showYearSelector ? ' ▲' : ' ▼'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={handleNextMonth}
                activeOpacity={0.7}
              >
                <Text style={styles.navArrowText}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Year Selector Mode */}
            {showYearSelector ? (
              <View style={styles.yearSelectorContainer}>
                <Text style={styles.yearSelectorHint}>Select Year:</Text>
                <ScrollView
                  style={{ maxHeight: 240 }}
                  contentContainerStyle={styles.yearGrid}
                  showsVerticalScrollIndicator={false}
                >
                  {yearOptions.map((y) => {
                    const isSelected = y === viewYear;
                    return (
                      <TouchableOpacity
                        key={y}
                        style={[styles.yearChip, isSelected && styles.yearChipSelected]}
                        onPress={() => {
                          setViewYear(y);
                          setShowYearSelector(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.yearChipText,
                            isSelected && styles.yearChipTextSelected,
                          ]}
                        >
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              /* Calendar Days Grid */
              <View style={styles.calendarContainer}>
                {/* Days of week header */}
                <View style={styles.dayNamesRow}>
                  {DAYS_OF_WEEK.map((d) => (
                    <Text key={d} style={styles.dayNameText}>
                      {d}
                    </Text>
                  ))}
                </View>

                {/* Day numbers grid */}
                <View style={styles.daysGrid}>
                  {calendarGrid.map((item, idx) => {
                    const isSelected = item.dateStr === selectedDateStr;
                    const isToday = item.dateStr === todayISO;

                    return (
                      <TouchableOpacity
                        key={`${item.dateStr}-${idx}`}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                          !isSelected && isToday && styles.dayCellToday,
                        ]}
                        onPress={() => {
                          setSelectedDateStr(item.dateStr);
                          if (!item.isCurrentMonth) {
                            const parts = item.dateStr.split('-');
                            setViewYear(parseInt(parts[0], 10));
                            setViewMonth(parseInt(parts[1], 10) - 1);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dayCellText,
                            !item.isCurrentMonth && styles.dayCellTextOtherMonth,
                            isSelected && styles.dayCellTextSelected,
                            !isSelected && isToday && styles.dayCellTextToday,
                          ]}
                        >
                          {item.day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.75}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={handleApply}
                activeOpacity={0.85}
              >
                <Text style={styles.applyBtnText}>Apply Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
  },
  calendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: '#38BDF8',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    height: '100%',
    justifyContent: 'center',
  },
  calendarIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  calendarBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },

  // Modal overlay & card
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerSelectedDisplay: {
    fontSize: 18,
    fontWeight: '800',
    color: '#38BDF8',
    marginTop: 2,
  },
  closeIcon: {
    fontSize: 18,
    color: '#94A3B8',
    padding: 4,
  },

  // Presets
  presetsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  presetChip: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  presetChipActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  presetChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },

  // Month / Year Nav
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  navArrowBtn: {
    padding: 8,
  },
  navArrowText: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: 'bold',
  },
  navMonthYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  navMonthYearText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  navDropdownIndicator: {
    fontSize: 10,
    color: '#38BDF8',
  },

  // Calendar days grid
  calendarContainer: {
    marginBottom: 16,
  },
  dayNamesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayNameText: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 3,
  },
  dayCellSelected: {
    backgroundColor: '#38BDF8',
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  dayCellText: {
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  dayCellTextOtherMonth: {
    color: '#475569',
  },
  dayCellTextSelected: {
    color: '#0F172A',
    fontWeight: '800',
  },
  dayCellTextToday: {
    color: '#38BDF8',
    fontWeight: '700',
  },

  // Year selector
  yearSelectorContainer: {
    marginBottom: 16,
  },
  yearSelectorHint: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 8,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  yearChip: {
    width: '30%',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  yearChipSelected: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  yearChipText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  yearChipTextSelected: {
    color: '#38BDF8',
    fontWeight: '700',
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 1,
    backgroundColor: '#38BDF8',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginLeft: 8,
  },
  applyBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
});

