import React, { useState, useMemo } from 'react';
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
import CategorySettingsModal from '../components/CategorySettingsModal';

interface Props {
  onNavigate?: (tab: 'mutualfunds' | 'stocks' | 'ppf' | 'epf') => void;
}

export default function NetWorthScreen({ onNavigate }: Props) {
  const {
    assets,
    transactions,
    stockTransactions,
    ppfTransactions,
    epfTransactions,
    isRefreshingNAVs,
    isRefreshingStockPrices,
    categoryVisibility,
  } = useInvestment();

  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Category visibility flags
  const isMfVisible = categoryVisibility?.mutualfunds ?? true;
  const isStockVisible = categoryVisibility?.stocks ?? true;
  const isPpfVisible = categoryVisibility?.ppf ?? true;
  const isEpfVisible = categoryVisibility?.epf ?? true;
  const visibleCategoriesCount =
    (isMfVisible ? 1 : 0) +
    (isStockVisible ? 1 : 0) +
    (isPpfVisible ? 1 : 0) +
    (isEpfVisible ? 1 : 0);

  // Dynamic header subtitle based on visible categories
  const visibleCategorySubtitle = useMemo(() => {
    const names: string[] = [];
    if (isMfVisible) names.push('Mutual Funds');
    if (isStockVisible) names.push('Stocks');
    if (isPpfVisible) names.push('PPF');
    if (isEpfVisible) names.push('EPF');
    if (names.length === 0) return 'All Categories Hidden';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
  }, [isMfVisible, isStockVisible, isPpfVisible, isEpfVisible]);

  // 1. Extract Mutual Fund, Indian Stock, PPF, and EPF assets
  const mfAsset = assets.find((a) => a.asset_type === 'Mutual Fund');
  const stockAsset = assets.find((a) => a.asset_type === 'Stock');
  const ppfAsset = assets.find((a) => a.asset_type === 'PPF');
  const epfAsset = assets.find((a) => a.asset_type === 'EPF');

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

  const ppfInvested = ppfAsset?.invested_amount || 0;
  const ppfCurrent = ppfAsset?.current_value || 0;
  const ppfReturn = ppfCurrent - ppfInvested;
  const ppfReturnPct = ppfInvested > 0 ? (ppfReturn / ppfInvested) * 100 : 0;
  const isPpfProfit = ppfReturn >= 0;

  const epfInvested = epfAsset?.invested_amount || 0;
  const epfCurrent = epfAsset?.current_value || 0;
  const epfReturn = epfCurrent - epfInvested;
  const epfReturnPct = epfInvested > 0 ? (epfReturn / epfInvested) * 100 : 0;
  const isEpfProfit = epfReturn >= 0;

  // 2. Aggregate Portfolio Values (only including visible categories)
  const totalInvested =
    (isMfVisible ? mfInvested : 0) +
    (isStockVisible ? stockInvested : 0) +
    (isPpfVisible ? ppfInvested : 0) +
    (isEpfVisible ? epfInvested : 0);
  const totalCurrent =
    (isMfVisible ? mfCurrent : 0) +
    (isStockVisible ? stockCurrent : 0) +
    (isPpfVisible ? ppfCurrent : 0) +
    (isEpfVisible ? epfCurrent : 0);
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

  // 5. Calculate PPF XIRR
  const ppfXIRR = useMemo(() => {
    if (ppfTransactions.length === 0 || ppfCurrent <= 0) return null;
    const flows: CashFlow[] = ppfTransactions.map((t) => ({
      amount: t.type === 'INVEST' ? -t.amount : t.amount,
      date: t.date,
    }));
    flows.push({ amount: ppfCurrent, date: today });
    return calculateXIRR(flows);
  }, [ppfTransactions, ppfCurrent, today]);

  // 6. Calculate EPF XIRR
  const epfXIRR = useMemo(() => {
    if (epfTransactions.length === 0 || epfCurrent <= 0) return null;
    const flows: CashFlow[] = epfTransactions.map((t) => ({
      amount: t.type === 'INVEST' ? -t.amount : t.amount,
      date: t.date,
    }));
    flows.push({ amount: epfCurrent, date: today });
    return calculateXIRR(flows);
  }, [epfTransactions, epfCurrent, today]);

  // 7. Calculate Combined Portfolio XIRR (only visible categories)
  const portfolioXIRR = useMemo(() => {
    const combinedFlows: CashFlow[] = [
      ...(isMfVisible
        ? transactions.map((t) => ({
            amount: t.type === 'BUY' ? -t.amount : t.amount,
            date: t.date,
          }))
        : []),
      ...(isStockVisible
        ? stockTransactions.map((t) => ({
            amount: t.type === 'BUY' ? -t.amount : t.amount,
            date: t.date,
          }))
        : []),
      ...(isPpfVisible
        ? ppfTransactions.map((t) => ({
            amount: t.type === 'INVEST' ? -t.amount : t.amount,
            date: t.date,
          }))
        : []),
      ...(isEpfVisible
        ? epfTransactions.map((t) => ({
            amount: t.type === 'INVEST' ? -t.amount : t.amount,
            date: t.date,
          }))
        : []),
    ];
    if (combinedFlows.length === 0 || totalCurrent <= 0) return null;
    combinedFlows.push({ amount: totalCurrent, date: today });
    return calculateXIRR(combinedFlows);
  }, [
    isMfVisible,
    isStockVisible,
    isPpfVisible,
    isEpfVisible,
    transactions,
    stockTransactions,
    ppfTransactions,
    epfTransactions,
    totalCurrent,
    today,
  ]);

  // 8. Allocation percentages
  const mfPct = isMfVisible && totalCurrent > 0 ? (mfCurrent / totalCurrent) * 100 : 0;
  const stockPct = isStockVisible && totalCurrent > 0 ? (stockCurrent / totalCurrent) * 100 : 0;
  const ppfPct = isPpfVisible && totalCurrent > 0 ? (ppfCurrent / totalCurrent) * 100 : 0;
  const epfPct = isEpfVisible && totalCurrent > 0 ? (epfCurrent / totalCurrent) * 100 : 0;

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
            <Text style={styles.headerSubtitle}>{visibleCategorySubtitle}</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          {(isRefreshingNAVs || isRefreshingStockPrices) && (
            <View style={styles.syncBadge}>
              <ActivityIndicator size="small" color="#60A5FA" style={{ marginRight: 6 }} />
              <Text style={styles.syncText}>Updating...</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setSettingsModalVisible(true)}
            accessibilityLabel="Category Settings"
            activeOpacity={0.7}
          >
            <Text style={styles.settingsButtonIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
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

        {/* Asset Allocation Section (Mutual Funds, Indian Stocks, PPF & EPF) */}
        <View style={styles.allocationCard}>
          <View style={styles.allocationHeaderRow}>
            <Text style={styles.sectionTitle}>Asset Allocation</Text>
            <Text style={styles.allocationSubtitle}>{visibleCategorySubtitle}</Text>
          </View>

          <View style={[styles.progressBar, { overflow: 'hidden', flexDirection: 'row' }]}>
            {isMfVisible && mfPct > 0 && (
              <View
                style={{
                  height: 12,
                  width: `${mfPct}%`,
                  backgroundColor: '#3B82F6',
                }}
              />
            )}
            {isStockVisible && stockPct > 0 && (
              <View
                style={{
                  height: 12,
                  width: `${stockPct}%`,
                  backgroundColor: '#10B981',
                }}
              />
            )}
            {isPpfVisible && ppfPct > 0 && (
              <View
                style={{
                  height: 12,
                  width: `${ppfPct}%`,
                  backgroundColor: '#F59E0B',
                }}
              />
            )}
            {isEpfVisible && epfPct > 0 && (
              <View
                style={{
                  height: 12,
                  width: `${epfPct}%`,
                  backgroundColor: '#8B5CF6',
                }}
              />
            )}
            {(totalCurrent === 0 || visibleCategoriesCount === 0) && (
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
            {isMfVisible && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.legendText}>
                  Mutual Funds: <Text style={styles.legendHighlight}>{mfPct.toFixed(1)}%</Text> ({formatINR(mfCurrent)})
                </Text>
              </View>
            )}
            {isStockVisible && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>
                  Indian Stocks: <Text style={styles.legendHighlight}>{stockPct.toFixed(1)}%</Text> ({formatINR(stockCurrent)})
                </Text>
              </View>
            )}
            {isPpfVisible && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.legendText}>
                  PPF: <Text style={styles.legendHighlight}>{ppfPct.toFixed(1)}%</Text> ({formatINR(ppfCurrent)})
                </Text>
              </View>
            )}
            {isEpfVisible && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.legendText}>
                  EPF: <Text style={styles.legendHighlight}>{epfPct.toFixed(1)}%</Text> ({formatINR(epfCurrent)})
                </Text>
              </View>
            )}
            {visibleCategoriesCount === 0 && (
              <Text style={styles.legendText}>No categories currently visible.</Text>
            )}
          </View>
        </View>



        {/* Asset Breakdown Section: (Non-editable, from individual pages) */}
        {visibleCategoriesCount > 0 && (
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Portfolio Breakdown</Text>
            <Text style={styles.sectionNote}>Synced from individual tabs (Non-editable)</Text>
          </View>
        )}

        {/* 1. Mutual Fund Asset Card */}
        {isMfVisible && (
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
        )}

        {/* 2. Indian Stock Asset Card */}
        {isStockVisible && (
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
        )}

        {/* 3. Public Provident Fund (PPF) Asset Card (Non-editable on dashboard) */}
        {isPpfVisible && (
          <TouchableOpacity
            style={styles.assetCard}
            onPress={() => onNavigate && onNavigate('ppf')}
            activeOpacity={onNavigate ? 0.75 : 1}
          >
            <View style={styles.cardHeader}>
              <View style={styles.assetTitleGroup}>
                <View style={[styles.colorBar, { backgroundColor: '#F59E0B' }]} />
                <View>
                  <Text style={styles.assetTitle}>Public Provident Fund (PPF)</Text>
                  <Text style={styles.assetSubtitle}>Sovereign Fixed Return</Text>
                </View>
              </View>

              {/* PPF XIRR Badge */}
              <View
                style={[
                  styles.xirrBadge,
                  {
                    backgroundColor:
                      ppfXIRR !== null
                        ? ppfXIRR >= 0
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
                        ppfXIRR !== null
                          ? ppfXIRR >= 0
                            ? '#10B981'
                            : '#EF4444'
                          : '#94A3B8',
                    },
                  ]}
                >
                  {formatXIRR(ppfXIRR)}
                </Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            {/* 2x2 Metrics Grid: Total Investment, Current Value, Return, Return % */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricGridCell}>
                <Text style={styles.gridLabel}>Total Investment</Text>
                <Text style={styles.gridValue}>{formatINR(ppfInvested)}</Text>
              </View>

              <View style={[styles.metricGridCell, { alignItems: 'flex-end' }]}>
                <Text style={styles.gridLabel}>Current Value</Text>
                <Text style={styles.gridValue}>{formatINR(ppfCurrent)}</Text>
              </View>
            </View>

            <View style={[styles.metricsGrid, { marginTop: 12 }]}>
              <View style={styles.metricGridCell}>
                <Text style={styles.gridLabel}>Return</Text>
                <Text
                  style={[
                    styles.gridValue,
                    { color: isPpfProfit ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {formatINR(ppfReturn, { showSign: true })}
                </Text>
              </View>

              <View style={[styles.metricGridCell, { alignItems: 'flex-end' }]}>
                <Text style={styles.gridLabel}>Return %</Text>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isPpfProfit
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isPpfProfit ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {formatPercentage(ppfReturnPct)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Card Footer Link */}
            {onNavigate && (
              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>
                  {ppfPct.toFixed(1)}% of portfolio • Manage in PPF ➔
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* 4. Employees' Provident Fund (EPF) Asset Card (Non-editable on dashboard) */}
        {isEpfVisible && (
          <TouchableOpacity
            style={styles.assetCard}
            onPress={() => onNavigate && onNavigate('epf')}
            activeOpacity={onNavigate ? 0.75 : 1}
          >
            <View style={styles.cardHeader}>
              <View style={styles.assetTitleGroup}>
                <View style={[styles.colorBar, { backgroundColor: '#8B5CF6' }]} />
                <View>
                  <Text style={styles.assetTitle}>Employees' Provident Fund (EPF)</Text>
                  <Text style={styles.assetSubtitle}>EPFO Retirement Return</Text>
                </View>
              </View>

              {/* EPF XIRR Badge */}
              <View
                style={[
                  styles.xirrBadge,
                  {
                    backgroundColor:
                      epfXIRR !== null
                        ? epfXIRR >= 0
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
                        epfXIRR !== null
                          ? epfXIRR >= 0
                            ? '#10B981'
                            : '#EF4444'
                          : '#94A3B8',
                    },
                  ]}
                >
                  {formatXIRR(epfXIRR)}
                </Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            {/* 2x2 Metrics Grid: Total Investment, Current Value, Return, Return % */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricGridCell}>
                <Text style={styles.gridLabel}>Total Investment</Text>
                <Text style={styles.gridValue}>{formatINR(epfInvested)}</Text>
              </View>

              <View style={[styles.metricGridCell, { alignItems: 'flex-end' }]}>
                <Text style={styles.gridLabel}>Current Value</Text>
                <Text style={styles.gridValue}>{formatINR(epfCurrent)}</Text>
              </View>
            </View>

            <View style={[styles.metricsGrid, { marginTop: 12 }]}>
              <View style={styles.metricGridCell}>
                <Text style={styles.gridLabel}>Return</Text>
                <Text
                  style={[
                    styles.gridValue,
                    { color: isEpfProfit ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {formatINR(epfReturn, { showSign: true })}
                </Text>
              </View>

              <View style={[styles.metricGridCell, { alignItems: 'flex-end' }]}>
                <Text style={styles.gridLabel}>Return %</Text>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isEpfProfit
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isEpfProfit ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {formatPercentage(epfReturnPct)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Card Footer Link */}
            {onNavigate && (
              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>
                  {epfPct.toFixed(1)}% of portfolio • Manage in EPF ➔
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Empty State when all categories are hidden */}
        {visibleCategoriesCount === 0 && (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateIcon}>👁️‍🗨️</Text>
            <Text style={styles.emptyStateTitle}>All Categories Hidden</Text>
            <Text style={styles.emptyStateText}>
              You have hidden all investment categories. Tap below to choose which categories to display on your dashboard.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => setSettingsModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyStateButtonText}>Customize Categories</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Category Visibility Settings Modal */}
      <CategorySettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  settingsButtonIcon: {
    fontSize: 17,
  },
  emptyStateCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    marginTop: 8,
    marginBottom: 20,
  },
  emptyStateIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyStateButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
