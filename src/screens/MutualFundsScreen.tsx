import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInvestment } from '../context/InvestmentContext';
import { formatINR, formatPercentage, formatUnits, formatLastUpdated } from '../utils/currency';
import { calculateXIRR, formatXIRR } from '../utils/xirr';
import AddTransactionModal from '../components/AddTransactionModal';
import EditFundValueModal from '../components/EditFundValueModal';
import EditTransactionModal from '../components/EditTransactionModal';
import { MFFund, MFTransaction } from '../types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function MutualFundsScreen() {
  const {
    funds,
    transactions,
    assets,
    addNewTransaction,
    addBatchTransactions,
    addNewFund,
    updateFundDetails,
    isRefreshingNAVs,
    editTransaction,
    deleteTransaction,
  } = useInvestment();

  const [activeTab, setActiveTab] = useState<'Holdings' | 'History'>('Holdings');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFundForEdit, setSelectedFundForEdit] = useState<MFFund | null>(null);
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<MFTransaction | null>(null);

  // Derive MF Total Stats from the Mutual Fund asset entry
  const mfAsset = assets.find((a) => a.asset_type === 'Mutual Fund');
  const totalInvested = mfAsset?.invested_amount || 0;
  const currentValue = mfAsset?.current_value || 0;
  const absoluteGain = currentValue - totalInvested;
  const returnPct = totalInvested > 0 ? (absoluteGain / totalInvested) * 100 : 0;
  const isProfit = absoluteGain >= 0;

  // Calculate Overall Portfolio Mutual Fund XIRR
  const portfolioXIRR = useMemo(() => {
    if (transactions.length === 0 || currentValue <= 0) return null;
    const cashFlows = transactions.map((t) => ({
      amount: t.type === 'BUY' ? -t.amount : t.amount,
      date: t.date,
    }));
    cashFlows.push({
      amount: currentValue,
      date: new Date().toISOString().split('T')[0],
    });
    return calculateXIRR(cashFlows);
  }, [transactions, currentValue]);

  // Calculate XIRR per individual fund holding
  const fundXIRRMap = useMemo(() => {
    const map: { [fundId: number]: number | null } = {};
    const today = new Date().toISOString().split('T')[0];

    funds.forEach((fund) => {
      const fundTxns = transactions.filter((t) => t.fund_id === fund.id);
      const curVal = fund.current_value || 0;

      if (fundTxns.length === 0 || curVal <= 0) {
        map[fund.id] = null;
        return;
      }

      const flows = fundTxns.map((t) => ({
        amount: t.type === 'BUY' ? -t.amount : t.amount,
        date: t.date,
      }));

      flows.push({
        amount: curVal,
        date: today,
      });

      map[fund.id] = calculateXIRR(flows);
    });

    return map;
  }, [funds, transactions]);

  // Group transactions by Month and Year (e.g. "September 2026")
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: MFTransaction[] } = {};

    transactions.forEach((tx) => {
      let groupKey = 'Recent Transactions';
      if (tx.date) {
        const parts = tx.date.split('-');
        if (parts.length >= 2) {
          const year = parseInt(parts[0], 10);
          const monthIndex = parseInt(parts[1], 10) - 1;
          const monthName = MONTH_NAMES[monthIndex] || 'Unknown';
          groupKey = `${monthName} ${year}`;
        }
      }
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(tx);
    });

    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [transactions]);

  const handleDeleteTransaction = (tx: MFTransaction) => {
    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete this ${tx.type} transaction of ${formatINR(tx.amount)} for "${tx.fund_name}"?\n\nThis will automatically recalculate your invested balance, units, and XIRR.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTransaction(tx.id),
        },
      ]
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
            <Text style={styles.headerTitle}>Mutual Funds</Text>
            <Text style={styles.headerSubtitle}>SIP & AMFI Real-time Tracking</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>+ Add Txn</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* MF Header Card with XIRR */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeaderRow}>
            <Text style={styles.cardLabel}>MUTUAL FUNDS PORTFOLIO</Text>
            {portfolioXIRR !== null && (
              <View
                style={[
                  styles.headerXirrBadge,
                  {
                    backgroundColor:
                      portfolioXIRR >= 0
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                  },
                ]}
              >
                <Text style={styles.headerXirrLabel}>PORTFOLIO XIRR: </Text>
                <Text
                  style={[
                    styles.headerXirrValue,
                    { color: portfolioXIRR >= 0 ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {formatXIRR(portfolioXIRR)}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.cardBigValue}>{formatINR(currentValue)}</Text>

          <View style={styles.divider} />

          <View style={styles.statsRow}>
            <View>
              <Text style={styles.subLabel}>Calculated Invested</Text>
              <Text style={styles.subValue}>{formatINR(totalInvested)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.subLabel}>Total Gain / Return</Text>
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

        {/* Sub-tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Holdings' && styles.activeTabButton]}
            onPress={() => setActiveTab('Holdings')}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.tabText, activeTab === 'Holdings' && styles.activeTabText]}
            >
              Holdings ({funds.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'History' && styles.activeTabButton]}
            onPress={() => setActiveTab('History')}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.tabText, activeTab === 'History' && styles.activeTabText]}
            >
              Order History ({transactions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1: Holdings List */}
        {activeTab === 'Holdings' && (
          <FlatList
            data={funds}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏦</Text>
                <Text style={styles.emptyTitle}>No Mutual Funds Added</Text>
                <Text style={styles.emptySubtitle}>
                  You have not added any mutual funds yet. Tap below to log your first SIP or transaction with its AMFI Scheme Code.
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => setModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyButtonText}>+ Add First Fund / Transaction</Text>
                </TouchableOpacity>
              </View>
            )}
            renderItem={({ item }) => {
              const fundInvested = item.total_invested || 0;
              const fundCurrent = item.current_value || 0;
              const fundGain = fundCurrent - fundInvested;
              const fundReturnPct = fundInvested > 0 ? (fundGain / fundInvested) * 100 : 0;
              const isFundProfit = fundGain >= 0;
              const xirr = fundXIRRMap[item.id] ?? null;
              const isXirrProfit = xirr !== null && xirr >= 0;

              return (
                <View style={styles.fundCard}>
                  <View style={styles.fundHeader}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.fundName}>{item.name}</Text>
                      <View style={styles.fundSubHeaderRow}>
                        <Text style={styles.folioText}>
                          Folio: {item.folio_number || 'N/A'}
                        </Text>
                        {item.scheme_code ? (
                          <Text style={styles.schemeTag}>
                            • AMFI: {item.scheme_code}
                          </Text>
                        ) : null}
                      </View>
                      {item.current_nav ? (
                        <Text style={styles.navSubText}>
                          NAV: ₹{item.current_nav.toFixed(3)} {item.nav_date ? `(${item.nav_date})` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.editValueBtn}
                      onPress={() => setSelectedFundForEdit(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editValueBtnText}>✏️ Edit Value</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.fundDivider} />

                  {/* 2x2 Clean Metrics Grid */}
                  <View style={styles.metricsRow}>
                    <View style={styles.metricCell}>
                      <Text style={styles.metricCellLabel}>Invested Amount</Text>
                      <Text style={styles.metricCellValue}>
                        {formatINR(fundInvested)}
                      </Text>
                      <Text style={styles.metricCellSub}>
                        {item.transaction_count || 0} transaction{item.transaction_count === 1 ? '' : 's'}
                      </Text>
                    </View>

                    <View style={styles.metricCell}>
                      <Text style={styles.metricCellLabel}>Total Units</Text>
                      <Text style={styles.metricCellValue}>
                        {formatUnits(item.total_units)}
                      </Text>
                      <Text style={styles.metricCellSub}>units owned</Text>
                    </View>
                  </View>

                  <View style={[styles.metricsRow, { marginTop: 12 }]}>
                    <View style={styles.metricCell}>
                      <Text style={styles.metricCellLabel}>Current Market Value</Text>
                      <Text style={styles.metricCellValue}>
                        {formatINR(fundCurrent)}
                      </Text>
                      <Text style={styles.lastUpdatedSub}>
                        {item.updated_at ? formatLastUpdated(item.updated_at) : 'Tap ✏️ to update'}
                      </Text>
                    </View>

                    <View style={styles.metricCell}>
                      <Text style={styles.metricCellLabel}>Total Returns</Text>
                      <Text
                        style={[
                          styles.metricCellValue,
                          { color: isFundProfit ? '#10B981' : '#EF4444' },
                        ]}
                      >
                        {formatINR(fundGain, { showSign: true })}
                      </Text>
                      <Text
                        style={[
                          styles.metricCellSub,
                          { color: isFundProfit ? '#10B981' : '#EF4444', fontWeight: '700' },
                        ]}
                      >
                        {formatPercentage(fundReturnPct)}
                      </Text>
                    </View>
                  </View>

                  {/* Dedicated XIRR Strip for this holding */}
                  <View style={styles.fundXirrStrip}>
                    <View style={styles.fundXirrLeft}>
                      <Text style={styles.fundXirrIcon}>⚡</Text>
                      <Text style={styles.fundXirrLabel}>Annualized Return (XIRR)</Text>
                    </View>
                    <View
                      style={[
                        styles.xirrBadge,
                        {
                          backgroundColor:
                            xirr !== null
                              ? isXirrProfit
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(100, 116, 139, 0.15)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.xirrBadgeText,
                          {
                            color:
                              xirr !== null
                                ? isXirrProfit
                                  ? '#10B981'
                                  : '#EF4444'
                                : '#94A3B8',
                          },
                        ]}
                      >
                        {formatXIRR(xirr)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Tab 2: Order History */}
        {activeTab === 'History' && (
          <FlatList
            data={groupedTransactions}
            keyExtractor={(item) => item.title}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={styles.emptyTitle}>No Transactions Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Recorded Buy/SIP and Redeem transactions will calculate your invested balance, units, and XIRR automatically.
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => setModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyButtonText}>+ Add Transaction</Text>
                </TouchableOpacity>
              </View>
            )}
            renderItem={({ item: group }) => (
              <View style={styles.groupSection}>
                <Text style={styles.groupHeader}>{group.title}</Text>
                {group.data.map((tx) => {
                  const isBuy = tx.type === 'BUY';
                  return (
                    <View key={tx.id} style={styles.txCard}>
                      <View style={styles.txRowTop}>
                        <View style={styles.txLeft}>
                          <View
                            style={[
                              styles.txBadge,
                              {
                                backgroundColor: isBuy
                                  ? 'rgba(59, 130, 246, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.txBadgeText,
                                { color: isBuy ? '#3B82F6' : '#EF4444' },
                              ]}
                            >
                              {tx.type}
                            </Text>
                          </View>
                          <View style={{ marginLeft: 12, flex: 1, paddingRight: 8 }}>
                            <Text style={styles.txFundName} numberOfLines={1}>
                              {tx.fund_name}
                            </Text>
                            <View style={styles.txMetaRow}>
                              <Text style={styles.txDate}>{tx.date}</Text>
                              {tx.nav ? (
                                <Text style={styles.txNav}>
                                  • NAV: ₹{tx.nav} ({tx.units?.toFixed(3)} units)
                                </Text>
                              ) : tx.units ? (
                                <Text style={styles.txNav}>
                                  • {tx.units.toFixed(3)} units
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.txAmount,
                            { color: isBuy ? '#10B981' : '#EF4444' },
                          ]}
                        >
                          {isBuy ? '+ ' : '- '}
                          {formatINR(tx.amount)}
                        </Text>
                      </View>

                      {/* Transaction Action Controls (Edit & Delete) */}
                      <View style={styles.txActionRow}>
                        <TouchableOpacity
                          style={styles.txEditBtn}
                          onPress={() => setSelectedTxForEdit(tx)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.txEditBtnText}>✏️ Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.txDeleteBtn}
                          onPress={() => handleDeleteTransaction(tx)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.txDeleteBtnText}>🗑️ Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          />
        )}
      </View>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        visible={modalVisible}
        funds={funds}
        onClose={() => setModalVisible(false)}
        onSaveTransaction={(tx) => {
          addNewTransaction(tx);
          setModalVisible(false);
        }}
        onSaveBatchTransactions={(fundId, orders) => {
          addBatchTransactions(fundId, orders);
          setModalVisible(false);
        }}
        onCreateFund={(name, folio, val, scheme, nav, navDate) =>
          addNewFund(name, folio, val, scheme, nav, navDate)
        }
      />

      {/* Edit Individual Fund Value & Scheme Code Modal */}
      <EditFundValueModal
        fund={selectedFundForEdit}
        transactions={transactions}
        visible={!!selectedFundForEdit}
        onClose={() => setSelectedFundForEdit(null)}
        onSave={(fundId, data) => {
          updateFundDetails(fundId, data);
          setSelectedFundForEdit(null);
        }}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        transaction={selectedTxForEdit}
        visible={!!selectedTxForEdit}
        onClose={() => setSelectedTxForEdit(null)}
        onSave={(updatedTx) => {
          editTransaction(updatedTx);
          setSelectedTxForEdit(null);
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 9,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshNavBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  refreshNavBtnText: {
    color: '#60A5FA',
    fontWeight: '700',
    fontSize: 12,
  },
  addButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
  },
  headerXirrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  headerXirrLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  headerXirrValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardBigValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  subValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 3,
  },
  returnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  returnValue: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  listContainer: {
    paddingBottom: 24,
  },
  fundCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  fundName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 20,
  },
  fundSubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  folioText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  schemeTag: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
  navSubText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
    marginTop: 3,
  },
  editValueBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  editValueBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60A5FA',
  },
  fundDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCell: {
    flex: 1,
  },
  metricCellLabel: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricCellValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 2,
  },
  metricCellSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  lastUpdatedSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  fundXirrStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  fundXirrLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fundXirrIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  fundXirrLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  xirrBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  xirrBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  groupSection: {
    marginBottom: 16,
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  txCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  txRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  txBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  txBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  txFundName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  txDate: {
    fontSize: 11,
    color: '#64748B',
  },
  txNav: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 4,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  txActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.5)',
    gap: 8,
  },
  txEditBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  txEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60A5FA',
  },
  txDeleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  txDeleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F87171',
  },
});
