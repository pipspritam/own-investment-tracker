import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { useInvestment } from '../context/InvestmentContext';
import { CategoryVisibility } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function CategorySettingsModal({ visible, onClose }: Props) {
  const { categoryVisibility, toggleCategoryVisibility, updateCategoryVisibility } =
    useInvestment();

  const handleShowAll = () => {
    updateCategoryVisibility({
      mutualfunds: true,
      stocks: true,
      ppf: true,
      epf: true,
    });
  };

  const categories: Array<{
    key: keyof CategoryVisibility;
    title: string;
    subtitle: string;
    icon: string;
    color: string;
  }> = [
    {
      key: 'mutualfunds',
      title: 'Mutual Funds',
      subtitle: 'AMFI Schemes & SIP Real-time Tracking',
      icon: '📈',
      color: '#3B82F6',
    },
    {
      key: 'stocks',
      title: 'Indian Stocks',
      subtitle: 'NSE / BSE Equities & Dividends',
      icon: '💹',
      color: '#10B981',
    },
    {
      key: 'ppf',
      title: 'Public Provident Fund (PPF)',
      subtitle: 'Sovereign 15-Yr Fixed Deposit',
      icon: '🏦',
      color: '#F59E0B',
    },
    {
      key: 'epf',
      title: "Employees' Provident Fund (EPF)",
      subtitle: 'EPFO Guaranteed Retirement Asset',
      icon: '🏛️',
      color: '#8B5CF6',
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Category Visibility</Text>
              <Text style={styles.modalSubtitle}>Manage visible categories in dashboard & tabs</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Explanatory Banner */}
            <View style={styles.infoBanner}>
              <Text style={styles.infoIcon}>💡</Text>
              <Text style={styles.infoText}>
                Turning off a category removes it from your dashboard breakdown, portfolio totals, and bottom tabs. Your recorded transactions and passbook data remain safely saved.
              </Text>
            </View>

            {/* List of Category Rows */}
            <View style={styles.categoryList}>
              {categories.map((cat) => {
                const isEnabled = categoryVisibility[cat.key];
                return (
                  <View key={cat.key} style={styles.categoryRow}>
                    <View style={styles.rowLeft}>
                      <View
                        style={[
                          styles.iconContainer,
                          { backgroundColor: `${cat.color}20`, borderColor: cat.color },
                        ]}
                      >
                        <Text style={styles.categoryIcon}>{cat.icon}</Text>
                      </View>
                      <View style={styles.categoryTextGroup}>
                        <Text style={styles.categoryTitle}>{cat.title}</Text>
                        <Text style={styles.categorySubtitle}>{cat.subtitle}</Text>
                      </View>
                    </View>

                    <Switch
                      value={isEnabled}
                      onValueChange={() => toggleCategoryVisibility(cat.key)}
                      trackColor={{ false: '#334155', true: cat.color }}
                      thumbColor="#F8FAFC"
                      ios_backgroundColor="#334155"
                    />
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.showAllBtn}
              onPress={handleShowAll}
              activeOpacity={0.7}
            >
              <Text style={styles.showAllBtnText}>Show All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    maxHeight: '85%',
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
  categoryList: {
    gap: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryTextGroup: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  categorySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  showAllBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  showAllBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94A3B8',
  },
  doneBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
});
