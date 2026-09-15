import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInvestment } from '../context/InvestmentContext';
import { formatINR, formatPercentage } from '../utils/currency';
import { calculateXIRR, formatXIRR, CashFlow } from '../utils/xirr';

interface Props {
  onNavigate?: (tab: 'mutualfunds' | 'stocks') => void;
}

export default function NetWorthScreen({ onNavigate }: Props) {
  const {
    assets,
    transactions,
    stockTransactions,
    isRefreshingNAVs,
    isRefreshingStockPrices,
  } = useInvestment();

  // 1. Extract strictly Mutual Fund and Indian Stock assets
  const mfAsset = assets.find((a) => a.asset_type === 'Mutual Fund');
  const stockAsset = assets.find((a) => a.asset_type === 'Stock');

  const mfInvested = mfAsset?.invested_amount || 0;
  const mfCurrent = mfAsset?.current_value || 0;
  const mfReturn = mfCurrent - mfInvested;
  const mfReturnPct = mfInvested > 0 ? (mfReturn / mfInvested) * 100 : 0;
  const isMfProfit = mfReturn >= 0;

  const stockInvested = stockAsset?.invested_amount || 0;
  const stockCurrent = stockAsset?.current_value || 0;
  const stockReturn = stockCurrent - stockInvested;
  const stockReturnPct = stockInvested > 0 ? (stockReturn / stockInvested) * 100 : 0;
  const isStockProfit = stockReturn >= 0;

  // 2. Aggregate Portfolio Values (Strictly Mutual Fund + Indian Stock)
  const totalInvested = mfInvested + stockInvested;
  const totalCurrent = mfCurrent + stockCurrent;
  const totalReturn = totalCurrent - totalInvested;
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  const isTotalProfit = totalReturn >= 0;

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 3. Calculate Mutual Fund XIRR
  const mfXIRR = useMemo(() => {
    if (transactions.length === 0 || mfCurrent <= 0) return null;
    const flows: CashFlow[] = transactions.map((t) => ({
      amount: t.type === 'BUY' ? -t.amount : t.amount,
      date: t.date,
    }));
    flows.push({ amount: mfCurrent, date: today });
    return calculateXIRR(flows);
  }, [transactions, mfCurrent, today]);

  // 4. Calculate Indian Stock XIRR
  const stockXIRR = useMemo(() => {
    if (stockTransactions.length === 0 || stockCurrent <= 0) return null;
    const flows: CashFlow[] = stockTransactions.map((t) => ({
      amount: t.type === 'BUY' ? -t.amount : t.amount,
      date: t.date,
    }));
    flows.push({ amount: stockCurrent, date: today });
    return calculateXIRR(flows);
  }, [stockTransactions, stockCurrent, today]);

  // 5. Calculate Combined Portfolio XIRR
  const portfolioXIRR = useMemo(() => {
    const combinedFlows: CashFlow[] = [
      ...transactions.map((t) => ({
        amount: t.type === 'BUY' ? -t.amount : t.amount,
        date: t.date,
      })),
      ...stockTransactions.map((t) => ({
        amount: t.type === 'BUY' ? -t.amount : t.amount,
        date: t.date,
      })),
    ];
    if (combinedFlows.length === 0 || totalCurrent <= 0) return null;
    combinedFlows.push({ amount: totalCurrent, date: today });
    return calculateXIRR(combinedFlows);
  }, [transactions, stockTransactions, totalCurrent, today]);

  // 6. Allocation percentages
  const mfPct = totalCurrent > 0 ? (mfCurrent / totalCurrent) * 100 : 0;
  const stockPct = totalCurrent > 0 ? (stockCurrent / totalCurrent) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Brand Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/ownwealth-logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.brandNameWhite}>Own</Text>
              <Text style={styles.brandNameCyan}>Wealth</Text>
            </View>
            <Text style={styles.headerSubtitle}>Mutual Funds & Indian Stocks</Text>
          </View>
        </View>
        {(isRefreshingNAVs || isRefreshingStockPrices) && (
          <View style={styles.syncBadge}>
            <ActivityIndicator size="small" color="#60A5FA" style={{ marginRight: 6 }} />
            <Text style={styles.syncText}>Updating...</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Metric Card: Portfolio Value, Total Investment, Current, Return, Return %, and XIRR */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <Text style={styles.summaryLabel}>TOTAL PORTFOLIO NET WORTH</Text>
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

          <Text style={styles.summaryBigValue}>{formatINR(totalCurrent)}</Text>

          <View style={styles.divider} />

          {/* Investment & Returns Metrics */}
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statLabel}>Total Investment</Text>
              <Text style={styles.statValue}>{formatINR(totalInvested)}</Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.statLabel}>Total Return</Text>
              <View style={styles.returnsRow}>
                <Text
                  style={[
                    styles.returnValue,
                    { color: isTotalProfit ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {formatINR(totalReturn, { showSign: true })}
                </Text>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isTotalProfit
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isTotalProfit ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {formatPercentage(totalReturnPct)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Dedicated Overall Portfolio XIRR Strip */}
          <View style={styles.portfolioXirrStrip}>
            <View style={styles.portfolioXirrLeft}>
              <Text style={styles.portfolioXirrIcon}>⚡</Text>
              <Text style={styles.portfolioXirrLabel}>Overall Annualized Return (XIRR)</Text>
            </View>
            <View
              style={[
                styles.xirrBadge,
                {
                  backgroundColor:
                    portfolioXIRR !== null
                      ? portfolioXIRR >= 0
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
                      portfolioXIRR !== null
                        ? portfolioXIRR >= 0
                          ? '#10B981'
                          : '#EF4444'
                        : '#94A3B8',
                  },
                ]}
              >
                {formatXIRR(portfolioXIRR)}
              </Text>
            </View>
          </View>
        </View>

        {/* Asset Allocation Section (Mutual Funds vs Indian Stocks) */}
        <View style={styles.allocationCard}>
          <View style={styles.allocationHeaderRow}>
            <Text style={styles.sectionTitle}>Asset Allocation</Text>
            <Text style={styles.allocationSubtitle}>Mutual Funds & Indian Stocks</Text>
          </View>

          <View style={styles.progressBar}>
            {mfPct > 0 && (
              <View
                style={{
                  height: 12,
                  width: `${mfPct}%`,
                  backgroundColor: '#3B82F6',
                  borderTopLeftRadius: 6,
                  borderBottomLeftRadius: 6,
                  borderTopRightRadius: stockPct === 0 ? 6 : 0,
                  borderBottomRightRadius: stockPct === 0 ? 6 : 0,
                }}
              />
            )}
            {stockPct > 0 && (
              <View
                style={{
                  height: 12,
                  width: `${stockPct}%`,
                  backgroundColor: '#10B981',
                  borderTopRightRadius: 6,
                  borderBottomRightRadius: 6,
                  borderTopLeftRadius: mfPct === 0 ? 6 : 0,
                  borderBottomLeftRadius: mfPct === 0 ? 6 : 0,
                }}
              />
            )}
            {totalCurrent === 0 && (
              <View
                style={{
                  height: 12,
                  width: '100%',
                  backgroundColor: '#334155',
                  borderRadius: 6,
                }}
              />
            )}
          </View>

          {/* Allocation Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.legendText}>
                Mutual Funds: <Text style={styles.legendHighlight}>{mfPct.toFixed(1)}%</Text> ({formatINR(mfCurrent)})
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>
                Indian Stocks: <Text style={styles.legendHighlight}>{stockPct.toFixed(1)}%</Text> ({formatINR(stockCurrent)})
              </Text>
            </View>
          </View>
        </View>

        {/* Asset Breakdown Section: Mutual Fund and Indian Stock (Non-editable, from individual pages) */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Portfolio Breakdown</Text>
          <Text style={styles.sectionNote}>Synced from individual tabs (Non-editable)</Text>
        </View>

        {/* 1. Mutual Fund Asset Card */}
        <TouchableOpacity
          style={styles.assetCard}
          onPress={() => onNavigate && onNavigate('mutualfunds')}
          activeOpacity={onNavigate ? 0.75 : 1}
        >
          <View style={styles.cardHeader}>
            <View style={styles.assetTitleGroup}>
              <View style={[styles.colorBar, { backgroundColor: '#3B82F6' }]} />
              <View>
                <Text style={styles.assetTitle}>Mutual Funds</Text>
                <Text style={styles.assetSubtitle}>AMFI & SIP Real-time Tracking</Text>
              </View>
            </View>

            {/* Mutual Fund XIRR Badge */}
            <View
              style={[
                styles.xirrBadge,
                {
                  backgroundColor:
                    mfXIRR !== null
                      ? mfXIRR >= 0
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(100, 116, 139, 0.15)',
                },
              ]}
            >
              <Text style={styles.xirrPrefix}>XIRR: </Text>
              <Text
                style={[
                  styles.xirrBadgeText,
                  {
                    color:
                      mfXIRR !== null
                        ? mfXIRR >= 0
                          ? '#10B981'
                          : '#EF4444'
                        : '#94A3B8',
                  },
                ]}
              >
                {formatXIRR(mfXIRR)}
              </Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* 2x2 Metrics Grid: Total Investment, Current Value, Return, Return % */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricGridCell}>
              <Text style={styles.gridLabel}>Total Investment</Text>
              <Text style={styles.gridValue}>{formatINR(mfInvested)}</Text>
            </View>

            <View style={[styles.metricGridCell, { alignItems: 'flex-end' }]}>
              <Text style={styles.gridLabel}>Current Value</Text>
              <Text style={styles.gridValue}>{formatINR(mfCurrent)}</Text>
            </View>
          </View>

          <View style={[styles.metricsGrid, { marginTop: 12 }]}>
            <View style={styles.metricGridCell}>
              <Text style={styles.gridLabel}>Return</Text>
              <Text
                style={[
                  styles.gridValue,
                  { color: isMfProfit ? '#10B981' : '#EF4444' },
                ]}
              >
                {formatINR(mfReturn, { showSign: true })}
              </Text>
            </View>

            <View style={[styles.metricGridCell, { alignItems: 'flex-end' }]}>
              <Text style={styles.gridLabel}>Return %</Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isMfProfit
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: isMfProfit ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {formatPercentage(mfReturnPct)}
                </Text>
              </View>
            </View>
          </View>

          {/* Card Footer Link */}
          {onNavigate && (
            <View style={styles.cardFooter}>
              <Text style={styles.cardFooterText}>
                {mfPct.toFixed(1)}% of portfolio • Manage in Mutual Funds ➔
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 2. Indian Stock Asset Card */}
        <TouchableOpacity
          style={styles.assetCard}
          onPress={() => onNavigate && onNavigate('stocks')}
          activeOpacity={onNavigate ? 0.75 : 1}
        >
          <View style={styles.cardHeader}>
            <View style={styles.assetTitleGroup}>
              <View style={[styles.colorBar, { backgroundColor: '#10B981' }]} />
              <View>
                <Text style={styles.assetTitle}>Indian Stocks</Text>
                <Text style={styles.assetSubtitle}>NSE & BSE Equities</Text>
              </View>
            </View>

            {/* Indian Stock XIRR Badge */}
            <View
              style={[
                styles.xirrBadge,
                {
                  backgroundColor:
                    stockXIRR !== null
                      ? stockXIRR >= 0
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(100, 116, 139, 0.15)',
                },
              ]}
            >
              <Text style={styles.xirrPrefix}>XIRR: </Text>
              <Text
                style={[
                  styles.xirrBadgeText,
                  {
                    color:
                      stockXIRR !== null
                        ? stockXIRR >= 0
                          ? '#10B981'
                          : '#EF4444'
                        : '#94A3B8',
                  },
                ]}
              >
                {formatXIRR(stockXIRR)}
              </Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* 2x2 Metrics Grid: Total Investment, Current Value, Return, Return % */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricGridCell}>
              <Text style={styles.gridLabel}>Total Investment</Text>
              <Text style={styles.gridValue}>{formatINR(stockInvested)}</Text>
            </View>

            <View style={[styles.metricGridCell, { alignItems: 'flex-end' }]}>
              <Text style={styles.gridLabel}>Current Value</Text>
              <Text style={styles.gridValue}>{formatINR(stockCurrent)}</Text>
            </View>
          </View>

          <View style={[styles.metricsGrid, { marginTop: 12 }]}>
            <View style={styles.metricGridCell}>
              <Text style={styles.gridLabel}>Return</Text>
              <Text
                style={[
                  styles.gridValue,
                  { color: isStockProfit ? '#10B981' : '#EF4444' },
                ]}
              >
                {formatINR(stockReturn, { showSign: true })}
              </Text>
            </View>

            <View style={[styles.metricGridCell, { alignItems: 'flex-end' }]}>
              <Text style={styles.gridLabel}>Return %</Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isStockProfit
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: isStockProfit ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {formatPercentage(stockReturnPct)}
                </Text>
              </View>
            </View>
          </View>

          {/* Card Footer Link */}
          {onNavigate && (
            <View style={styles.cardFooter}>
              <Text style={styles.cardFooterText}>
                {stockPct.toFixed(1)}% of portfolio • Manage in Indian Stocks ➔
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    marginRight: 10,
  },
  brandNameWhite: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  brandNameCyan: {
    fontSize: 22,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: -0.5,
  },
  headerTitle: {
    fontSize: 26,
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
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  syncText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 30,
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
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
  summaryBigValue: {
    fontSize: 32,
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
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 3,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  returnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  returnValue: {
    fontSize: 16,
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
  portfolioXirrStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  portfolioXirrLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  portfolioXirrIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  portfolioXirrLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  xirrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  xirrPrefix: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  xirrBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  allocationCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  allocationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  allocationSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
  },
  progressBar: {
    height: 12,
    flexDirection: 'row',
    borderRadius: 6,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    marginBottom: 12,
  },
  legendContainer: {
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  legendHighlight: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionNote: {
    fontSize: 11,
    color: '#64748B',
  },
  assetCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorBar: {
    width: 4,
    height: 28,
    borderRadius: 2,
    marginRight: 10,
  },
  assetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  assetSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricGridCell: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
    fontWeight: '500',
  },
  gridValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    alignItems: 'flex-end',
  },
  cardFooterText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '600',
  },
});
