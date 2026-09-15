import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInvestment } from '../context/InvestmentContext';
import { formatINR, formatPercentage, formatLastUpdated } from '../utils/currency';
import { calculateXIRR, formatXIRR } from '../utils/xirr';
import AddStockTransactionModal from '../components/AddStockTransactionModal';
import EditStockValueModal from '../components/EditStockValueModal';
import EditStockTransactionModal from '../components/EditStockTransactionModal';
import { Stock, StockTransaction } from '../types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function IndianStocksScreen() {
  const {
    stocks,
    stockTransactions,
    assets,
    addNewStock,
    updateStockValue,
    updateStockDetails,
    removeStock,
    addNewStockTransaction,
    editStockTransaction,
    deleteStockTransaction,
  } = useInvestment();

  const [activeTab, setActiveTab] = useState<'Holdings' | 'History'>('Holdings');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedStockForEdit, setSelectedStockForEdit] = useState<Stock | null>(null);
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<StockTransaction | null>(null);

  // Derive Stock Total Stats from the 'Stock' asset entry in asset_allocations
  const stockAsset = assets.find((a) => a.asset_type === 'Stock');
  const totalInvested = stockAsset?.invested_amount || 0;
  const currentValue = stockAsset?.current_value || 0;
  const absoluteGain = currentValue - totalInvested;
  const returnPct = totalInvested > 0 ? (absoluteGain / totalInvested) * 100 : 0;
  const isProfit = absoluteGain >= 0;

  // Calculate Overall Portfolio Stock XIRR
  const portfolioXIRR = useMemo(() => {
    if (stockTransactions.length === 0 || currentValue <= 0) return null;
    const cashFlows = stockTransactions.map((t) => ({
      amount: t.type === 'BUY' ? -t.amount : t.amount,
      date: t.date,
    }));
    cashFlows.push({
      amount: currentValue,
      date: new Date().toISOString().split('T')[0],
    });
    return calculateXIRR(cashFlows);
  }, [stockTransactions, currentValue]);

  // Calculate XIRR per individual stock holding
  const stockXIRRMap = useMemo(() => {
    const map: { [stockId: number]: number | null } = {};
    const today = new Date().toISOString().split('T')[0];

    stocks.forEach((stock) => {
      const txns = stockTransactions.filter((t) => t.stock_id === stock.id);
      const curVal = stock.current_value || 0;

      if (txns.length === 0 || curVal <= 0) {
        map[stock.id] = null;
        return;
      }

      const flows = txns.map((t) => ({
        amount: t.type === 'BUY' ? -t.amount : t.amount,
        date: t.date,
      }));

      flows.push({
        amount: curVal,
        date: today,
      });

      map[stock.id] = calculateXIRR(flows);
    });

    return map;
  }, [stocks, stockTransactions]);

  // Group transactions by Month and Year (e.g. "September 2026")
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: StockTransaction[] } = {};

    stockTransactions.forEach((tx) => {
      let groupKey = 'Recent Orders';
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
  }, [stockTransactions]);

  const handleDeleteTransaction = (tx: StockTransaction) => {
    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete this ${tx.type} order of ${tx.quantity} shares of "${tx.stock_name}"?\n\nThis will automatically recalculate your invested balance and returns.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteStockTransaction(tx.id),
        },
      ]
    );
  };

  const handleDeleteStock = (stock: Stock) => {
    Alert.alert(
      'Delete Stock',
      `Are you sure you want to delete "${stock.name}" and all its transaction history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Stock',
          style: 'destructive',
          onPress: () => removeStock(stock.id),
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
            <Text style={styles.headerTitle}>Indian Stocks</Text>
            <Text style={styles.headerSubtitle}>NSE & BSE Equity Tracking</Text>
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

      <View style={styles.content}>
        {/* Stocks Summary Header Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeaderRow}>
            <Text style={styles.cardLabel}>INDIAN STOCKS PORTFOLIO</Text>
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
              Holdings ({stocks.length})
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
              Order History ({stockTransactions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1: Holdings List */}
        {activeTab === 'Holdings' && (
          <FlatList
            data={stocks}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏢</Text>
                <Text style={styles.emptyTitle}>No Stocks Added</Text>
                <Text style={styles.emptySubtitle}>
                  You haven't added any stocks yet. Tap below to log your first buy order with its price and shares.
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => setAddModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyButtonText}>+ Add First Stock / Order</Text>
                </TouchableOpacity>
              </View>
            )}
            renderItem={({ item }) => {
              const stockInvested = item.total_invested || 0;
              const stockCurrent = item.current_value || 0;
              const stockGain = stockCurrent - stockInvested;
              const stockReturnPct = stockInvested > 0 ? (stockGain / stockInvested) * 100 : 0;
              const isStockProfit = stockGain >= 0;
              const xirr = stockXIRRMap[item.id] ?? null;
              const isXirrProfit = xirr !== null && xirr >= 0;
              const shares = item.total_quantity || 0;

              return (
                <View style={styles.stockCard}>
                  {/* Stock Card Header */}
                  <View style={styles.stockHeader}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.stockName}>{item.name}</Text>
                      <View style={styles.stockSubHeaderRow}>
                        {item.symbol ? (
                          <View style={styles.symbolBadge}>
                            <Text style={styles.symbolBadgeText}>{item.symbol}</Text>
                          </View>
                        ) : null}
                        {item.current_price !== undefined && item.current_price > 0 ? (
                          <View style={styles.cmpBadge}>
                            <Text style={styles.cmpLabel}>CMP: </Text>
                            <Text style={styles.cmpValue}>{formatINR(item.current_price)}</Text>
                            {item.day_change_pct !== undefined && item.day_change_pct !== null ? (
                              <Text
                                style={[
                                  styles.cmpChange,
                                  { color: item.day_change_pct >= 0 ? '#10B981' : '#EF4444' },
                                ]}
                              >
                                {item.day_change_pct >= 0 ? ' +' : ' '}
                                {item.day_change_pct.toFixed(2)}%
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                        <Text style={styles.stockTxnCount}>
                          {item.transaction_count || 0} order{item.transaction_count === 1 ? '' : 's'}
                        </Text>
                      </View>
                    </View>

                    {/* Edit Value Button (User puts current value) */}
                    <TouchableOpacity
                      style={styles.editValueBtn}
                      onPress={() => setSelectedStockForEdit(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editValueBtnText}>✏️ Edit Value</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardDivider} />

                  {/* 2x2 Metrics Grid */}
                  <View style={styles.metricsRow}>
                    <View style={styles.metricCell}>
                      <Text style={styles.metricCellLabel}>Invested Amount</Text>
                      <Text style={styles.metricCellValue}>
                        {formatINR(stockInvested)}
                      </Text>
                      <Text style={styles.metricCellSub}>
                        {shares > 0 && stockInvested > 0
                          ? `Avg ₹${(stockInvested / shares).toFixed(2)}`
                          : 'Net capital'}
                      </Text>
                    </View>

                    <View style={styles.metricCell}>
                      <Text style={styles.metricCellLabel}>Shares Owned</Text>
                      <Text style={styles.metricCellValue}>
                        {shares % 1 === 0 ? shares.toString() : shares.toFixed(2)}
                      </Text>
                      <Text style={styles.metricCellSub}>net quantity</Text>
                    </View>
                  </View>

                  <View style={[styles.metricsRow, { marginTop: 12 }]}>
                    <View style={styles.metricCell}>
                      <Text style={styles.metricCellLabel}>Current Market Value</Text>
                      <Text style={styles.metricCellValue}>
                        {formatINR(stockCurrent)}
                      </Text>
                      {item.current_price !== undefined && item.current_price > 0 && shares > 0 ? (
                        <Text style={styles.liveCalcSub}>
                          Live: {shares % 1 === 0 ? shares : shares.toFixed(2)} × ₹{item.current_price.toFixed(2)}
                        </Text>
                      ) : (
                        <Text style={styles.lastUpdatedSub}>
                          {item.updated_at ? formatLastUpdated(item.updated_at) : 'Tap ✏️ to update'}
                        </Text>
                      )}
                    </View>

                    <View style={styles.metricCell}>
                      <Text style={styles.metricCellLabel}>Total Returns</Text>
                      <Text
                        style={[
                          styles.metricCellValue,
                          { color: isStockProfit ? '#10B981' : '#EF4444' },
                        ]}
                      >
                        {formatINR(stockGain, { showSign: true })}
                      </Text>
                      <Text
                        style={[
                          styles.metricCellSub,
                          { color: isStockProfit ? '#10B981' : '#EF4444', fontWeight: '700' },
                        ]}
                      >
                        {formatPercentage(stockReturnPct)}
                      </Text>
                    </View>
                  </View>

                  {/* Stock XIRR Strip */}
                  <View style={styles.stockXirrStrip}>
                    <View style={styles.stockXirrLeft}>
                      <Text style={styles.stockXirrIcon}>⚡</Text>
                      <Text style={styles.stockXirrLabel}>Annualized Return (XIRR)</Text>
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

                  {/* Long press / optional delete option footer */}
                  <TouchableOpacity
                    style={styles.deleteStockLink}
                    onPress={() => handleDeleteStock(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.deleteStockLinkText}>🗑️ Remove Stock</Text>
                  </TouchableOpacity>
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
                <Text style={styles.emptyTitle}>No Orders Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Recorded Buy and Sell orders will automatically compute your invested value and net shares.
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => setAddModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyButtonText}>+ Add Order</Text>
                </TouchableOpacity>
              </View>
            )}
            renderItem={({ item: group }) => (
              <View style={styles.groupSection}>
                <Text style={styles.groupHeader}>{group.title}</Text>
                {group.data.map((tx) => {
                  const isBuy = tx.type === 'BUY';
                  const isDividend = tx.type === 'DIVIDEND';
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
                                  : isDividend
                                  ? 'rgba(139, 92, 246, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.txBadgeText,
                                {
                                  color: isBuy
                                    ? '#3B82F6'
                                    : isDividend
                                    ? '#A78BFA'
                                    : '#EF4444',
                                },
                              ]}
                            >
                              {tx.type}
                            </Text>
                          </View>
                          <View style={{ marginLeft: 12, flex: 1, paddingRight: 8 }}>
                            <Text style={styles.txStockName} numberOfLines={1}>
                              {tx.stock_name}
                            </Text>
                            <View style={styles.txMetaRow}>
                              <Text style={styles.txDate}>{tx.date}</Text>
                              <Text style={styles.txDetails}>
                                {isDividend
                                  ? `• ${tx.quantity} shares × ₹${tx.price.toFixed(2)} div`
                                  : `• @ ₹${tx.price.toFixed(2)} (${tx.quantity} shares)`}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.txAmount,
                            {
                              color: isBuy
                                ? '#10B981'
                                : isDividend
                                ? '#A78BFA'
                                : '#EF4444',
                            },
                          ]}
                        >
                          {isBuy ? '+ ' : isDividend ? '+ ' : '- '}
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

      {/* Add Stock Transaction Modal */}
      <AddStockTransactionModal
        visible={addModalVisible}
        stocks={stocks}
        onClose={() => setAddModalVisible(false)}
        onSaveTransaction={addNewStockTransaction}
        onCreateStock={addNewStock}
      />

      {/* Edit Stock Value Modal (User puts current value) */}
      <EditStockValueModal
        visible={!!selectedStockForEdit}
        stock={selectedStockForEdit}
        transactions={stockTransactions}
        onClose={() => setSelectedStockForEdit(null)}
        onSave={(stockId, data) => {
          updateStockValue(stockId, data.current_value);
          if (data.name || data.symbol !== undefined) {
            updateStockDetails(stockId, {
              name: data.name,
              symbol: data.symbol,
              current_value: data.current_value,
            });
          }
        }}
      />

      {/* Edit Stock Transaction Modal */}
      <EditStockTransactionModal
        visible={!!selectedTxForEdit}
        transaction={selectedTxForEdit}
        onClose={() => setSelectedTxForEdit(null)}
        onSave={editStockTransaction}
        onDelete={deleteStockTransaction}
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
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
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
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
    fontSize: 30,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 3,
    fontWeight: '500',
  },
  subValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  returnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  activeTabButton: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContainer: {
    paddingBottom: 30,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  stockCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stockName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  stockSubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  symbolBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  symbolBadgeText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '700',
  },
  cmpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cmpLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  cmpValue: {
    fontSize: 11,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  cmpChange: {
    fontSize: 10,
    fontWeight: '700',
  },
  stockTxnCount: {
    fontSize: 12,
    color: '#94A3B8',
  },
  editValueBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editValueBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60A5FA',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCell: {
    flex: 1,
  },
  metricCellLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
    fontWeight: '500',
  },
  metricCellValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  metricCellSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  lastUpdatedSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  liveCalcSub: {
    fontSize: 10,
    color: '#38BDF8',
    marginTop: 1,
    fontWeight: '600',
  },
  stockXirrStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stockXirrLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockXirrIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  stockXirrLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  xirrBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  xirrBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteStockLink: {
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  deleteStockLinkText: {
    fontSize: 11,
    color: '#64748B',
  },
  groupSection: {
    marginBottom: 16,
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  txCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
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
    paddingVertical: 4,
    borderRadius: 6,
  },
  txBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  txStockName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  txDate: {
    fontSize: 11,
    color: '#64748B',
  },
  txDetails: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 4,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 12,
  },
  txEditBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  txEditBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#60A5FA',
  },
  txDeleteBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  txDeleteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
});
