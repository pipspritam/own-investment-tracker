import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { InvestmentProvider, useInvestment } from './src/context/InvestmentContext';
import NetWorthScreen from './src/screens/NetWorthScreen';
import MutualFundsScreen from './src/screens/MutualFundsScreen';
import IndianStocksScreen from './src/screens/IndianStocksScreen';
import PPFScreen from './src/screens/PPFScreen';
import EPFScreen from './src/screens/EPFScreen';

type TabType = 'networth' | 'mutualfunds' | 'stocks' | 'ppf' | 'epf';

function MainApp() {
  const { categoryVisibility } = useInvestment();
  const [currentTab, setCurrentTab] = useState<TabType>('networth');
  const insets = useSafeAreaInsets();

  // If the currently selected tab gets hidden in settings, auto-fallback to 'networth'
  useEffect(() => {
    if (currentTab !== 'networth' && categoryVisibility && !categoryVisibility[currentTab]) {
      setCurrentTab('networth');
    }
  }, [currentTab, categoryVisibility]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Screens View */}
      <View style={styles.screenContainer}>
        {currentTab === 'networth' && (
          <NetWorthScreen onNavigate={(tab) => setCurrentTab(tab)} />
        )}
        {currentTab === 'mutualfunds' && categoryVisibility?.mutualfunds && <MutualFundsScreen />}
        {currentTab === 'stocks' && categoryVisibility?.stocks && <IndianStocksScreen />}
        {currentTab === 'ppf' && categoryVisibility?.ppf && <PPFScreen />}
        {currentTab === 'epf' && categoryVisibility?.epf && <EPFScreen />}
      </View>

      {/* Bottom Navigation Bar */}
      <View
        style={[
          styles.tabBar,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            height: 64 + Math.max(insets.bottom, 12),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'networth' && styles.activeTabItem]}
          onPress={() => setCurrentTab('networth')}
          activeOpacity={0.75}
        >
          <Text style={styles.tabIcon}>📊</Text>
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'networth' ? styles.activeTabLabel : styles.inactiveTabLabel,
            ]}
          >
            Net Worth
          </Text>
          {currentTab === 'networth' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>

        {categoryVisibility?.mutualfunds && (
          <TouchableOpacity
            style={[styles.tabItem, currentTab === 'mutualfunds' && styles.activeTabItem]}
            onPress={() => setCurrentTab('mutualfunds')}
            activeOpacity={0.75}
          >
            <Text style={styles.tabIcon}>📈</Text>
            <Text
              style={[
                styles.tabLabel,
                currentTab === 'mutualfunds' ? styles.activeTabLabel : styles.inactiveTabLabel,
              ]}
            >
              Mutual Funds
            </Text>
            {currentTab === 'mutualfunds' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        )}

        {categoryVisibility?.stocks && (
          <TouchableOpacity
            style={[styles.tabItem, currentTab === 'stocks' && styles.activeTabItem]}
            onPress={() => setCurrentTab('stocks')}
            activeOpacity={0.75}
          >
            <Text style={styles.tabIcon}>💹</Text>
            <Text
              style={[
                styles.tabLabel,
                currentTab === 'stocks' ? styles.activeTabLabel : styles.inactiveTabLabel,
              ]}
            >
              Indian Stocks
            </Text>
            {currentTab === 'stocks' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        )}

        {categoryVisibility?.ppf && (
          <TouchableOpacity
            style={[styles.tabItem, currentTab === 'ppf' && styles.activeTabItem]}
            onPress={() => setCurrentTab('ppf')}
            activeOpacity={0.75}
          >
            <Text style={styles.tabIcon}>🏦</Text>
            <Text
              style={[
                styles.tabLabel,
                currentTab === 'ppf' ? styles.activeTabLabel : styles.inactiveTabLabel,
              ]}
            >
              PPF
            </Text>
            {currentTab === 'ppf' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        )}

        {categoryVisibility?.epf && (
          <TouchableOpacity
            style={[styles.tabItem, currentTab === 'epf' && styles.activeTabItem]}
            onPress={() => setCurrentTab('epf')}
            activeOpacity={0.75}
          >
            <Text style={styles.tabIcon}>🏛️</Text>
            <Text
              style={[
                styles.tabLabel,
                currentTab === 'epf' ? styles.activeTabLabel : styles.inactiveTabLabel,
              ]}
            >
              EPF
            </Text>
            {currentTab === 'epf' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}



export default function App() {
  return (
    <SafeAreaProvider>
      <InvestmentProvider>
        <MainApp />
      </InvestmentProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTabItem: {},
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  activeTabLabel: {
    color: '#3B82F6',
  },
  inactiveTabLabel: {
    color: '#64748B',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 20,
    height: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
});
