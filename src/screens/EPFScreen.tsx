import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInvestment } from '../context/InvestmentContext';
import { formatINR, formatPercentage, formatLastUpdated } from '../utils/currency';
import { calculateXIRR, formatXIRR, CashFlow } from '../utils/xirr';
import AddEPFTransactionModal from '../components/AddEPFTransactionModal';
import EditEPFTransactionModal from '../components/EditEPFTransactionModal';
import EditEPFValueModal from '../components/EditEPFValueModal';
import { EPFTransaction } from '../types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function EPFScreen() {
  const {
    epfAccount,
    epfTransactions,
    assets,
    updateEPFValue,
    addNewEPFTransaction,
    editEPFTransaction,
    deleteEPFTransaction,
  } = useInvestment();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editValueModalVisible, setEditValueModalVisible] = useState(false);
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<EPFTransaction | null>(null);

  // Derive EPF stats from asset_allocations or epfAccount
  const epfAsset = assets.find((a) => a.asset_type === 'EPF');
  const totalInvested = epfAsset?.invested_amount ?? (epfAccount?.total_invested ?? 0);
  const currentValue = epfAsset?.current_value ?? (epfAccount?.current_value ?? 0);
  const absoluteGain = currentValue - totalInvested;
  const returnPct = totalInvested > 0 ? (absoluteGain / totalInvested) * 100 : 0;
  const isProfit = absoluteGain >= 0;

  // Calculate EPF XIRR: Contributions are cash outflow (-), Withdrawals/Advances are cash inflow (+), current valuation is +currentValue
  const epfXIRR = useMemo(() => {
    if (epfTransactions.length === 0 || currentValue <= 0) return null;
    const flows: CashFlow[] = epfTransactions.map((t) => ({
      amount: t.type === 'INVEST' ? -t.amount : t.amount,
      date: t.date,
    }));
    flows.push({
      amount: currentValue,
      date: new Date().toISOString().split('T')[0],
    });
    return calculateXIRR(flows);
  }, [epfTransactions, currentValue]);

  // Group transactions by Month and Year (e.g. "September 2026")
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: EPFTransaction[] } = {};

    epfTransactions.forEach((tx) => {
      let groupKey = 'Unknown Date';
      if (tx.date) {
        const parts = tx.date.split('-');
        if (parts.length === 3) {
          const year = parts[0];
          const monthIndex = parseInt(parts[1], 10) - 1;
          if (monthIndex >= 0 && monthIndex < 12) {
            groupKey = `${MONTH_NAMES[monthIndex]} ${year}`;
          }
        }
      }
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(tx);
    });

    return Object.keys(groups).map((monthYear) => ({
      monthYear,
      data: groups[monthYear],
    }));
  }, [epfTransactions]);

  const renderTransactionItem = (tx: EPFTransaction) => {
    const isInvest = tx.type === 'INVEST';
    return (
      <TouchableOpacity
        key={tx.id}
        style={styles.txCard}
        onPress={() => setSelectedTxForEdit(tx)}
        activeOpacity={0.75}
      >
        <View style={styles.txRow}>
          <View style={styles.txLeftCol}>
            <View style={styles.txBadgeRow}>
              <View
                style={[
                  styles.txTypeBadge,
                  isInvest ? styles.investBadge : styles.withdrawBadge,
                ]}
              >
                <Text
                  style={[
                    styles.txTypeText,
                    isInvest ? styles.investText : styles.withdrawText,
                  ]}
                >
                  {isInvest ? '+ Contribution' : '- Withdrawal'}
                </Text>
              </View>
              <Text style={styles.txDate}>{tx.date}</Text>
            </View>
            {tx.notes && tx.notes.trim() !== '' && (
              <Text style={styles.txNotes} numberOfLines={1}>
                {tx.notes}
              </Text>
            )}
          </View>

          <View style={styles.txRightCol}>
            <Text
              style={[
                styles.txAmount,
                isInvest ? styles.investAmount : styles.withdrawAmount,
              ]}
            >
              {isInvest ? '+' : '-'}{formatINR(tx.amount)}
            </Text>
            <Text style={styles.txEditHint}>Tap to edit ✎</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Image
            source={require('../../assets/ownwealth-logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.headerTitle}>Employees' Provident Fund</Text>
            <Text style={styles.headerSubtitle}>EPFO Guaranteed Retirement Asset</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>+ Add Txn</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* EPF Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeaderRow}>
                <View style={styles.violetTag}>
                  <Text style={styles.violetTagText}>RETIREMENT 80C ASSET</Text>
                </View>
                {epfXIRR !== null && (
                  <View
                    style={[
                      styles.headerXirrBadge,
                      {
                        backgroundColor:
                          epfXIRR >= 0
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                      },
                    ]}
                  >
                    <Text style={styles.headerXirrLabel}>EPF XIRR: </Text>
                    <Text
                      style={[
                        styles.headerXirrValue,
                        { color: epfXIRR >= 0 ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {formatXIRR(epfXIRR)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Current Value + Edit Button */}
              <View style={styles.balanceContainer}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.balanceLabel}>CURRENT EPFO PASSBOOK BALANCE</Text>
                  <Text style={styles.balanceBigValue}>{formatINR(currentValue)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editValueBtn}
                  onPress={() => setEditValueModalVisible(true)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.editValueBtnText}>✏️ Edit Value</Text>
                </TouchableOpacity>
              </View>

              {/* Account details info line */}
              {(epfAccount?.uan || epfAccount?.company_name || epfAccount?.updated_at) && (
                <View style={styles.accountInfoRow}>
                  {epfAccount?.uan ? (
                    <Text style={styles.accountInfoText}>
                      🏛️ UAN: {epfAccount.uan}
                      {epfAccount.company_name ? ` • ${epfAccount.company_name}` : ''}
                    </Text>
                  ) : epfAccount?.company_name ? (
                    <Text style={styles.accountInfoText}>
                      🏛️ {epfAccount.company_name}
                    </Text>
                  ) : null}
                  {epfAccount?.updated_at ? (
                    <Text style={styles.accountUpdatedText}>
                      Updated {formatLastUpdated(epfAccount.updated_at)}
                    </Text>
                  ) : null}
                </View>
              )}

              <View style={styles.divider} />

              {/* Stats Row: Auto-calculated Invested vs Gain */}
              <View style={styles.statsRow}>
                <View>
                  <Text style={styles.subLabel}>Calculated Invested</Text>
                  <Text style={styles.subValue}>{formatINR(totalInvested)}</Text>
                  <Text style={styles.subNote}>
                    {epfTransactions.length} {epfTransactions.length === 1 ? 'transaction' : 'transactions'}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.subLabel}>Accrued Interest / Gain</Text>
                  <View style={styles.returnsRow}>
                    <Text
                      style={[
                        styles.returnValue,
                        { color: isProfit ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {formatINR(absoluteGain, { showSign: true })}
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
                        {formatPercentage(returnPct)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Passbook History Title */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Passbook History</Text>
              <Text style={styles.sectionSubtitle}>
                {epfTransactions.length} recorded {epfTransactions.length === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
          </View>
        }
        data={groupedTransactions}
        keyExtractor={(item) => item.monthYear}
        renderItem={({ item }) => (
          <View style={styles.groupContainer}>
            <View style={styles.monthHeaderRow}>
              <Text style={styles.monthHeaderText}>{item.monthYear}</Text>
              <Text style={styles.monthCountText}>{item.data.length} txns</Text>
            </View>
            {item.data.map(renderTransactionItem)}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏛️</Text>
            <Text style={styles.emptyTitle}>No EPF Transactions Yet</Text>
            <Text style={styles.emptySubtitle}>
              Log your monthly EPF contributions or advances. Your total invested will be calculated automatically!
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => setAddModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyAddBtnText}>+ Add First Contribution</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add Transaction Modal */}
      <AddEPFTransactionModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSave={(tx) => {
          addNewEPFTransaction(tx);
        }}
      />

      {/* Edit Transaction Modal */}
      <EditEPFTransactionModal
        visible={!!selectedTxForEdit}
        transaction={selectedTxForEdit}
        onClose={() => setSelectedTxForEdit(null)}
        onSave={(tx) => {
          editEPFTransaction(tx);
        }}
        onDelete={(id) => {
          deleteEPFTransaction(id);
        }}
      />

      {/* Edit EPF Value Modal */}
      <EditEPFValueModal
        visible={editValueModalVisible}
        account={epfAccount}
        totalInvested={totalInvested}
        onClose={() => setEditValueModalVisible(false)}
        onSave={(newVal, uan, company) => {
          updateEPFValue(newVal, uan, company);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8B5CF6',
    marginTop: 2,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 40,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  violetTag: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  violetTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8B5CF6',
    letterSpacing: 0.5,
  },
  headerXirrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  headerXirrLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  headerXirrValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  balanceBigValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  editValueBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editValueBtnText: {
    color: '#8B5CF6',
    fontSize: 13,
    fontWeight: '700',
  },
  accountInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  accountInfoText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  accountUpdatedText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  subValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  subNote: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  returnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  returnValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  groupContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  monthHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthCountText: {
    fontSize: 11,
    color: '#64748B',
  },
  txCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txLeftCol: {
    flex: 1,
    marginRight: 10,
  },
  txBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  txTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  investBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  withdrawBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  txTypeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  investText: {
    color: '#10B981',
  },
  withdrawText: {
    color: '#EF4444',
  },
  txDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  txNotes: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  txRightCol: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  investAmount: {
    color: '#10B981',
  },
  withdrawAmount: {
    color: '#EF4444',
  },
  txEditHint: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyAddBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
