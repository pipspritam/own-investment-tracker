import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInvestment } from '../context/InvestmentContext';
import { formatINR, formatPercentage } from '../utils/currency';
import { AssetAllocation } from '../types';
import EditAssetModal from '../components/EditAssetModal';

const ASSET_COLORS: Record<string, string> = {
  'Mutual Fund': '#3B82F6', // Blue
  'Stock': '#10B981',       // Emerald
  'EPF': '#F59E0B',         // Amber
  'Gold': '#EAB308',        // Yellow
  'TI ESPP': '#8B5CF6',     // Purple
  'PPF': '#EC4899',         // Pink
  'Crypto': '#06B6D4',      // Cyan
};

export default function NetWorthScreen() {
  const { assets, portfolioSummary, updateAsset, isRefreshingNAVs } = useInvestment();
  const [selectedAsset, setSelectedAsset] = useState<AssetAllocation | null>(null);

  const isProfit = portfolioSummary.absoluteReturn >= 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Net Worth</Text>
          <Text style={styles.headerSubtitle}>Portfolio Overview & Asset Allocation</Text>
        </View>
        {isRefreshingNAVs && (
          <View style={styles.syncBadge}>
            <ActivityIndicator size="small" color="#60A5FA" style={{ marginRight: 6 }} />
            <Text style={styles.syncText}>Updating NAVs...</Text>
          </View>
        )}
      </View>

      <FlatList
        data={assets}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <>
            {/* Top Metric Card */}
            <View style={styles.metricCard}>
              <Text style={styles.cardLabel}>TOTAL NET WORTH</Text>
              <Text style={styles.netWorthValue}>
                {formatINR(portfolioSummary.totalNetWorth)}
              </Text>

              <View style={styles.cardDivider} />

              <View style={styles.metricRow}>
                <View>
                  <Text style={styles.subLabel}>Total Invested</Text>
                  <Text style={styles.subValue}>
                    {formatINR(portfolioSummary.totalInvested)}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.subLabel}>Total Absolute Return</Text>
                  <View style={styles.returnsRow}>
                    <Text
                      style={[
                        styles.returnValue,
                        { color: isProfit ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {formatINR(portfolioSummary.absoluteReturn, { showSign: true })}
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
                        {formatPercentage(portfolioSummary.percentageReturn)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Asset Allocation Progress Bar */}
            <View style={styles.allocationSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Asset Allocation</Text>
                <Text style={styles.sectionHelper}>Percentage distribution</Text>
              </View>

              <View style={styles.progressBar}>
                {assets.map((asset) => {
                  const pct =
                    portfolioSummary.totalNetWorth > 0
                      ? (asset.current_value / portfolioSummary.totalNetWorth) * 100
                      : 0;
                  if (pct <= 0) return null;
                  return (
                    <View
                      key={asset.id}
                      style={{
                        height: 12,
                        width: `${pct}%`,
                        backgroundColor: ASSET_COLORS[asset.asset_type] || '#64748B',
                      }}
                    />
                  );
                })}
              </View>

              {/* Legend row */}
              <View style={styles.legendContainer}>
                {assets.map((asset) => {
                  const pct =
                    portfolioSummary.totalNetWorth > 0
                      ? (asset.current_value / portfolioSummary.totalNetWorth) * 100
                      : 0;
                  return (
                    <View key={asset.id} style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: ASSET_COLORS[asset.asset_type] || '#64748B' },
                        ]}
                      />
                      <Text style={styles.legendText}>
                        {asset.asset_type}: {pct.toFixed(1)}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Holdings Title */}
            <View style={styles.holdingsHeader}>
              <Text style={styles.sectionTitle}>Asset Breakdown</Text>
              <Text style={styles.tapToEditHint}>Tap any card to update valuation</Text>
            </View>
          </>
        )}
        renderItem={({ item }) => {
          const returns = item.current_value - item.invested_amount;
          const returnPct =
            item.invested_amount > 0 ? (returns / item.invested_amount) * 100 : 0;
          const isItemProfit = returns >= 0;
          const shareOfTotal =
            portfolioSummary.totalNetWorth > 0
              ? (item.current_value / portfolioSummary.totalNetWorth) * 100
              : 0;

          return (
            <TouchableOpacity
              style={styles.assetCard}
              onPress={() => setSelectedAsset(item)}
              activeOpacity={0.75}
            >
              <View style={styles.assetHeader}>
                <View style={styles.assetNameRow}>
                  <View
                    style={[
                      styles.colorIndicator,
                      { backgroundColor: ASSET_COLORS[item.asset_type] || '#64748B' },
                    ]}
                  />
                  <View>
                    <Text style={styles.assetName}>{item.asset_type}</Text>
                    <Text style={styles.assetInvestedSub}>
                      Invested: {formatINR(item.invested_amount)} ({shareOfTotal.toFixed(1)}% of total)
                    </Text>
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.assetCurrentValue}>
                    {formatINR(item.current_value)}
                  </Text>
                  <View style={styles.assetReturnRow}>
                    <Text
                      style={[
                        styles.assetReturnsText,
                        { color: isItemProfit ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {formatINR(returns, { showSign: true })}
                    </Text>
                    <Text
                      style={[
                        styles.assetPctText,
                        { color: isItemProfit ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      ({formatPercentage(returnPct)})
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Edit Modal */}
      <EditAssetModal
        asset={selectedAsset}
        visible={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onSave={(currentVal, investedVal) => {
          if (selectedAsset) {
            updateAsset(selectedAsset.id, currentVal, investedVal);
            setSelectedAsset(null);
          }
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  metricCard: {
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
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
  },
  netWorthValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 8,
    letterSpacing: -0.5,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  subValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 4,
  },
  returnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  returnValue: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  allocationSection: {
    marginTop: 24,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sectionHelper: {
    fontSize: 12,
    color: '#64748B',
  },
  progressBar: {
    height: 12,
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginBottom: 14,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  holdingsHeader: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  tapToEditHint: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  assetCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorIndicator: {
    width: 10,
    height: 38,
    borderRadius: 5,
    marginRight: 12,
  },
  assetName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  assetInvestedSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
  },
  assetCurrentValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  assetReturnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  assetReturnsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  assetPctText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
});
