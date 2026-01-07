import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { Navbar } from './components/Navbar';
import { SectionNav } from './components/SectionNav';
import { Chart } from './components/Chart';
import { PieChart } from './components/PieChart';
import { WalletSummary } from './components/WalletSummary';
import { Holdings } from './components/Holdings';
import { TransactionHistory } from './components/TransactionHistory';
import { TransactionHeatmap } from './components/TransactionHeatmap';
import { WalletMaintenance } from './components/WalletMaintenance';
import { TopHodls } from './components/TopHodls';
import { NFTGallery } from './components/NFTGallery';
import { CyberVerseGallery } from './components/CyberVerseGallery';
import { AlertSystem } from './components/AlertSystem';
import { ergoApi } from './services/ergoApi';
import { historicalPrices, isCurrentMonth, type LpPriceResult, type TokenPriceResult } from './services/historicalPrices';
import { tokenBlacklist } from './services/tokenBlacklist';
import type { Alert, Holding } from './types';

interface Token {
  tokenId: string;
  name: string;
  amount: number;
  decimals: number;
  valueInErg: number;
  isArtwork: boolean;
}

interface Transaction {
  id: string;
  timestamp: Date;
  type: 'incoming' | 'outgoing';
  amount: number;
  status: 'confirmed';
}

interface DemurrageBox {
  boxId: string;
  valueInErg: number;
  currentAge: number;
  demurrageDate: Date;
  daysUntilDemurrage: number;
}

interface NFT {
  tokenId: string;
  name: string;
  description: string;
  type: 'NFT' | 'Audio' | 'Video' | 'Artwork Collection';
  artworkUrl: string | null;
}

interface CyberVerseSets {
  gen2: Set<string>;
  gen3: Set<string>;
  cars: Set<string>;
  apartments: Set<string>;
  pets: Set<string>;
  skins: Set<string>;
  vipcards: Set<string>;
  emotes: Set<string>;
  audio: Set<string>;
  jackhammers: Set<string>;
  eggs: Set<string>;
}

// Known stablecoin token IDs
const STABLECOIN_TOKEN_IDS = new Set([
  '03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04', // SigUSD
  '003bd19d0187117f130b62e1bcab0939929ff5c7709f843c5c4dd158949285d0', // SigRSV
  '6122f7289e7bb2df2de273e09d4b2756cda6aeb0f40438dc9d257688f45183ad', // DexyGold
  'a55b8735ed1a99e46c2c89f8994aacdf4b1109bdcf682f1e5b34479c6e392669', // USE
  '886b7721bef42f60c6317d37d8752da8aca01898cae7dae61808c4a14225edc8', // GluonW GAU
  '9944ff273ff169f32b851b96bbecdbb67f223101c15ae143de82b3e7f75b19d2', // GluonW GAUC
  '85763f3893ddd8f7f820473ed0dcc3c40aa8398ec6075a8990f250b9d270e9b3', // CLB USE
]);

// Memoized token categorization cache
const categoryCache = new Map<string, Holding['category']>();

// Categorize tokens based on token ID and name (with caching for performance)
const categorizeToken = (name: string, tokenId?: string): Holding['category'] => {
  const cacheKey = `${tokenId || ''}_${name}`;
  const cached = categoryCache.get(cacheKey);
  if (cached) return cached;

  const nameLower = name.toLowerCase();
  let category: Holding['category'];

  if (nameLower === 'erg') {
    category = 'ERG';
  } else if (tokenId && STABLECOIN_TOKEN_IDS.has(tokenId)) {
    // Check stables by token ID first (most reliable)
    category = 'Stables';
  } else if (nameLower.includes('lp') || nameLower.includes('liquidity') || nameLower.includes('lending')) {
    // LP tokens
    category = 'Liquidity/Lending';
  } else {
    category = 'Tokens';
  }

  categoryCache.set(cacheKey, category);
  return category;
};

function App() {
  // Wallet state
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Data state
  const [balance, setBalance] = useState<number | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [demurrageBoxes, setDemurrageBoxes] = useState<DemurrageBox[]>([]);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<Array<{
    month: string;
    balance: number;
    tokenHoldings: Map<string, number>;
  }>>([]);
  const [cyberverseSets, setCyberverseSets] = useState<CyberVerseSets | null>(null);
  const [blacklistedTokens, setBlacklistedTokens] = useState<Set<string>>(new Set());

  // Loading states for individual sections
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingMoreTransactions, setLoadingMoreTransactions] = useState(false);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
  const [loadingDemurrage, setLoadingDemurrage] = useState(false);
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Token movements (In/Out) for selected month
  const [tokenMovements, setTokenMovements] = useState<Map<string, { additions: number; reductions: number }>>(new Map());

  // Historical pricing state
  const [historicalTokenPrices, setHistoricalTokenPrices] = useState<Map<string, TokenPriceResult>>(new Map());
  const [historicalLpPrices, setHistoricalLpPrices] = useState<Map<string, LpPriceResult>>(new Map());
  const [loadingHistoricalPrices, setLoadingHistoricalPrices] = useState(false);

  // Chart category values per month (for historical chart data)
  interface ChartCategoryValues {
    stables: number;
    liquidity: number;
    tokens: number;
  }
  const [chartCategoryHistory, setChartCategoryHistory] = useState<Map<string, ChartCategoryValues>>(new Map());

  // UI state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [chartRange, setChartRange] = useState<3 | 6 | 12>(3); // months to show in chart
  const [transactionLimit, setTransactionLimit] = useState(20);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Load CyberVerse token IDs on mount
  useEffect(() => {
    fetch('/data/cyberverse_ids.json')
      .then(res => res.json())
      .then(data => {
        setCyberverseSets({
          gen2: new Set(data.gen2 || []),
          gen3: new Set(data.gen3 || []),
          cars: new Set(data.cars || []),
          apartments: new Set(data.apartments || []),
          pets: new Set(data.pets || []),
          skins: new Set(data.skins || []),
          vipcards: new Set(data.vipcards || []),
          emotes: new Set(data.emotes || []),
          audio: new Set(data.audio || []),
          jackhammers: new Set(data.jackhammers || []),
          eggs: new Set(data.eggs || []),
        });
      })
      .catch(err => console.error('Failed to load CyberVerse IDs:', err));
  }, []);

  // Load NSFW/Scam token blacklist on mount
  useEffect(() => {
    tokenBlacklist.getBlacklistedTokenIds()
      .then(blacklist => {
        setBlacklistedTokens(blacklist);
        console.log(`Loaded ${blacklist.size} blacklisted tokens`);
      })
      .catch(err => console.error('Failed to load token blacklist:', err));
  }, []);

  // Calculate chart category values for all months using actual historical token holdings
  useEffect(() => {
    if (balanceHistory.length === 0 || tokens.length === 0) {
      setChartCategoryHistory(new Map());
      return;
    }

    const calculateChartCategoryValues = async () => {
      const now = new Date();
      const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      // Get LP token IDs once
      const lpTokenIds = await historicalPrices.getLpTokenIds();

      // Build a map of token names for categorization
      const tokenNameMap = new Map<string, string>();
      for (const token of tokens) {
        tokenNameMap.set(token.tokenId, token.name);
      }

      // Filter valid tokens (exclude artwork and blacklisted) for current month
      const validTokens = tokens.filter(t => !t.isArtwork && !blacklistedTokens.has(t.tokenId));

      const categoryMap = new Map<string, ChartCategoryValues>();

      // Process each month in balance history
      for (const monthData of balanceHistory) {
        // For current month, use live prices from tokens state
        if (monthData.month === currentMonthLabel) {
          let stables = 0, liquidity = 0, tokenVal = 0;

          for (const token of validTokens) {
            const category = categorizeToken(token.name, token.tokenId);
            if (category === 'Stables') stables += token.valueInErg;
            else if (category === 'Liquidity/Lending') liquidity += token.valueInErg;
            else if (category === 'Tokens') tokenVal += token.valueInErg;
          }

          categoryMap.set(monthData.month, { stables, liquidity, tokens: tokenVal });
        } else {
          // For historical months, use actual historical holdings from transaction replay
          // Parse month label back to Date (e.g., "Dec '24" -> 2024-12-01)
          const [monthStr, yearStr] = monthData.month.split(' ');
          const monthIndex = new Date(Date.parse(monthStr + ' 1, 2000')).getMonth();
          const year = 2000 + parseInt(yearStr.replace("'", ''), 10);
          const monthDate = new Date(year, monthIndex, 1);

          // Get token IDs that were held at this month-end (from transaction replay)
          const historicalHoldings = monthData.tokenHoldings;
          const historicalTokenIds = Array.from(historicalHoldings.keys())
            .filter(id => !blacklistedTokens.has(id));

          // Split into LP and regular tokens
          const lpIds = historicalTokenIds.filter(id => lpTokenIds.has(id));
          const regularTokenIds = historicalTokenIds.filter(id => !lpTokenIds.has(id));

          try {
            // Fetch historical prices for this month
            const [tokenPriceResults, lpPriceResults] = await Promise.all([
              historicalPrices.getTokenPrices(regularTokenIds, monthDate),
              historicalPrices.getLpPrices(lpIds, monthDate),
            ]);

            let stables = 0, liquidity = 0, tokenVal = 0;

            // Calculate values using actual historical holdings
            for (const [tokenId, amount] of historicalHoldings) {
              if (blacklistedTokens.has(tokenId)) continue;

              const tokenName = tokenNameMap.get(tokenId) || '';
              const category = categorizeToken(tokenName, tokenId);
              let valueInErg = 0;

              // Check if LP token
              const lpPrice = lpPriceResults.get(tokenId);
              const tokenPrice = tokenPriceResults.get(tokenId);

              if (lpPrice && lpPrice.priceErg !== null && !lpPrice.unavailable) {
                valueInErg = amount * lpPrice.priceErg;
              } else if (tokenPrice && tokenPrice.priceErg !== null && !tokenPrice.unavailable) {
                valueInErg = amount * tokenPrice.priceErg;
              }

              if (category === 'Stables') stables += valueInErg;
              else if (category === 'Liquidity/Lending') liquidity += valueInErg;
              else if (category === 'Tokens') tokenVal += valueInErg;
            }

            categoryMap.set(monthData.month, { stables, liquidity, tokens: tokenVal });
          } catch (err) {
            console.error(`Failed to fetch historical prices for ${monthData.month}:`, err);
            categoryMap.set(monthData.month, { stables: 0, liquidity: 0, tokens: 0 });
          }
        }
      }

      setChartCategoryHistory(categoryMap);
    };

    calculateChartCategoryValues();
  }, [balanceHistory, tokens, blacklistedTokens]);

  // Fetch transactions and token movements for selected month
  const fetchTransactionsForMonth = useCallback(async (walletAddress: string, month: Date, currentTokens: Token[] = []) => {
    setLoadingTransactions(true);
    setHasMoreTransactions(false);
    // Clear cache when switching months to ensure fresh data
    ergoApi.clearMonthTxCache();
    try {
      // Fetch transactions and token movements in parallel
      const [txResult, movements] = await Promise.all([
        ergoApi.getMonthTransactions(
          walletAddress,
          month.getFullYear(),
          month.getMonth(),
          20, // Initial limit
          0   // Start from offset 0
        ),
        ergoApi.getTokenMovements(
          walletAddress,
          month.getFullYear(),
          month.getMonth()
        ),
      ]);
      setTransactions(txResult.transactions);
      setTotalTransactions(txResult.total);
      setHasMoreTransactions(txResult.hasMore);
      setTokenMovements(movements);

      // For non-current months, fetch historical prices from JSON
      if (!isCurrentMonth(month)) {
        setLoadingHistoricalPrices(true);
        try {
          // Get all token IDs from current holdings
          const tokenIds = currentTokens.map(t => t.tokenId);

          // Get LP token IDs (tokens in Liquidity/Lending category or known LP tokens)
          const lpTokenIds = await historicalPrices.getLpTokenIds();
          const lpIds = tokenIds.filter(id => lpTokenIds.has(id));
          const regularTokenIds = tokenIds.filter(id => !lpTokenIds.has(id));

          // Fetch prices in parallel
          const [tokenPriceResults, lpPriceResults] = await Promise.all([
            historicalPrices.getTokenPrices(regularTokenIds, month),
            historicalPrices.getLpPrices(lpIds, month),
          ]);

          setHistoricalTokenPrices(tokenPriceResults);
          setHistoricalLpPrices(lpPriceResults);
          console.log(`Loaded historical prices: ${tokenPriceResults.size} tokens, ${lpPriceResults.size} LPs`);
        } catch (err) {
          console.error('Failed to load historical prices:', err);
          setHistoricalTokenPrices(new Map());
          setHistoricalLpPrices(new Map());
        } finally {
          setLoadingHistoricalPrices(false);
        }
      } else {
        // Clear historical prices for current month (use live prices instead)
        setHistoricalTokenPrices(new Map());
        setHistoricalLpPrices(new Map());
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setTransactions([]);
      setTotalTransactions(0);
      setHasMoreTransactions(false);
      setTokenMovements(new Map());
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  // Load more transactions for current month
  const loadMoreTransactions = useCallback(async () => {
    if (!address || loadingMoreTransactions || !hasMoreTransactions) return;

    setLoadingMoreTransactions(true);
    try {
      const txResult = await ergoApi.getMonthTransactions(
        address,
        selectedMonth.getFullYear(),
        selectedMonth.getMonth(),
        20, // Load 20 more
        transactions.length // Offset by current count
      );

      // Append new transactions to existing list
      setTransactions(prev => [...prev, ...txResult.transactions]);
      setTotalTransactions(txResult.total);
      setHasMoreTransactions(txResult.hasMore);
    } catch (err) {
      console.error('Failed to load more transactions:', err);
    } finally {
      setLoadingMoreTransactions(false);
    }
  }, [address, selectedMonth, transactions.length, loadingMoreTransactions, hasMoreTransactions]);

  // Fetch all wallet data
  const fetchWalletData = useCallback(async (walletAddress: string, month: Date) => {
    setIsLoading(true);
    setError(null);
    setBalance(null);
    setTokens([]);
    setTransactions([]);
    setDemurrageBoxes([]);
    setNfts([]);
    setBalanceHistory([]);

    try {
      if (!ergoApi.isValidAddress(walletAddress)) {
        throw new Error('Invalid Ergo address format');
      }

      // Fetch balance, tokens and prices (most important)
      const fullBalance = await ergoApi.getFullBalanceWithPrices(walletAddress);
      setBalance(fullBalance.ergBalance);
      setTokens(fullBalance.tokens);
      setIsOnline(true);

      setAlerts(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'info' as const,
          message: `Loaded wallet: ${fullBalance.ergBalance.toFixed(4)} ERG, ${fullBalance.tokens.length} tokens`,
          expiresAt: new Date(Date.now() + 5000),
        },
      ]);

      // Fetch transactions for selected month in background (pass tokens for historical pricing)
      fetchTransactionsForMonth(walletAddress, month, fullBalance.tokens);

      // Fetch balance history with token holdings for chart in background
      setLoadingHistory(true);
      ergoApi.getMonthlyBalanceHistoryWithTokens(walletAddress, chartRange, fullBalance.tokens)
        .then(history => setBalanceHistory(history))
        .catch(err => console.error('Failed to load balance history:', err))
        .finally(() => setLoadingHistory(false));

      // Fetch demurrage boxes in background
      setLoadingDemurrage(true);
      ergoApi.getDemurrageBoxes(walletAddress)
        .then(boxes => setDemurrageBoxes(boxes))
        .catch(err => console.error('Failed to load demurrage boxes:', err))
        .finally(() => setLoadingDemurrage(false));

      // Fetch NFTs in background
      setLoadingNFTs(true);
      const rawBalance = await ergoApi.getAddressBalance(walletAddress);
      ergoApi.getNFTs(rawBalance.tokens)
        .then(nftList => setNfts(nftList))
        .catch(err => console.error('Failed to load NFTs:', err))
        .finally(() => setLoadingNFTs(false));

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch wallet data';
      setError(message);
      setIsOnline(false);

      setAlerts(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'error' as const,
          message,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTransactionsForMonth, chartRange]);

  const handleAddressSubmit = useCallback((walletAddress: string) => {
    setAddress(walletAddress);
    fetchWalletData(walletAddress, selectedMonth);
  }, [fetchWalletData, selectedMonth]);

  // Re-fetch transactions when month changes
  const handleMonthChange = useCallback((month: Date) => {
    setSelectedMonth(month);
    setSelectedDate(null); // Clear date filter when month changes
    if (address) {
      fetchTransactionsForMonth(address, month, tokens);
    }
  }, [address, fetchTransactionsForMonth, tokens]);

  // Handle chart range changes - re-fetch balance history with tokens
  const handleChartRangeChange = useCallback((range: 3 | 6 | 12) => {
    setChartRange(range);
    if (address) {
      setLoadingHistory(true);
      ergoApi.getMonthlyBalanceHistoryWithTokens(address, range, tokens)
        .then(history => setBalanceHistory(history))
        .catch(err => console.error('Failed to load balance history:', err))
        .finally(() => setLoadingHistory(false));
    }
  }, [address, tokens]);

  const handleDismissAlert = (id: string) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
  };

  const toggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
  };

  // Get ERG balance for the selected month from history
  const getSelectedMonthBalance = (): number => {
    if (balanceHistory.length === 0) return balance ?? 0;

    const selectedMonthLabel = selectedMonth.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const monthData = balanceHistory.find(h => h.month === selectedMonthLabel);

    // If selected month is in history, use that balance; otherwise use current
    return monthData?.balance ?? balance ?? 0;
  };

  const selectedMonthBalance = getSelectedMonthBalance();

  // Check if we're viewing current month vs historical
  const viewingCurrentMonth = isCurrentMonth(selectedMonth);

  // Memoized holdings calculation - expensive operation that should not run on every render
  const holdings: Holding[] = useMemo(() => {
    if (balance === null) return [];

    // Get ERG movements for the month (stored with pseudo ID '__ERG__')
    const ergMovement = tokenMovements.get('__ERG__') || { additions: 0, reductions: 0 };

    const ergHolding: Holding = {
      token: 'ERG',
      tokenId: '', // ERG has no token ID
      amount: selectedMonthBalance,
      valueInErg: selectedMonthBalance, // ERG value = ERG amount (always 1:1)
      change24h: 0,
      category: 'ERG' as const,
      beginningBalance: selectedMonthBalance - ergMovement.additions + ergMovement.reductions,
      additions: ergMovement.additions,
      reductions: ergMovement.reductions,
      endingBalance: selectedMonthBalance,
    };

    // Token holdings with ERG values
    // For current month: use live Crux prices
    // For historical months: use historical prices from JSON files
    // Filter out EIP-4 artwork tokens and blacklisted NSFW/scam tokens
    const tokenHoldings = tokens
      .filter(token => !token.isArtwork && !blacklistedTokens.has(token.tokenId))
      .map(token => {
        // Get movement for this token, adjusting for decimals
        const rawMovement = tokenMovements.get(token.tokenId) || { additions: 0, reductions: 0 };
        const divisor = token.decimals > 0 ? Math.pow(10, token.decimals) : 1;
        const additions = rawMovement.additions / divisor;
        const reductions = rawMovement.reductions / divisor;

        // Calculate ending balance for the selected month
        const endingBalance = token.amount;
        const beginningBalance = endingBalance - additions + reductions;

        // Determine value in ERG based on whether it's current or historical month
        let valueInErg = token.valueInErg; // Default to live price
        let displayName = token.name;
        let priceUnavailable = false;

        if (!viewingCurrentMonth) {
          // Check if this is an LP token
          const lpPrice = historicalLpPrices.get(token.tokenId);
          const tokenPrice = historicalTokenPrices.get(token.tokenId);

          if (lpPrice) {
            // LP token - use historical LP price
            if (lpPrice.priceErg !== null && !lpPrice.unavailable) {
              valueInErg = endingBalance * lpPrice.priceErg;
              // Add pool type indicator to name
              displayName = lpPrice.poolName + (lpPrice.poolType ? ` (${lpPrice.poolType})` : '');
            } else {
              valueInErg = 0;
              priceUnavailable = true;
              displayName = lpPrice.poolName + ' ⚠️';
            }
          } else if (tokenPrice) {
            // Regular token - use historical token price
            if (tokenPrice.priceErg !== null && !tokenPrice.unavailable) {
              valueInErg = endingBalance * tokenPrice.priceErg;
            } else {
              valueInErg = 0;
              priceUnavailable = true;
              displayName = token.name + ' ⚠️';
            }
          } else {
            // No historical price available
            valueInErg = 0;
            priceUnavailable = true;
            displayName = token.name + ' ⚠️';
          }
        } else {
          // Current month - check for LP pool type indicator from historical data
          const lpPrice = historicalLpPrices.get(token.tokenId);
          if (lpPrice?.poolType) {
            displayName = token.name + (token.name.includes('LP') ? '' : ' LP') + ` (${lpPrice.poolType})`;
          }
        }

        // Get pool type if it's an LP token
        const lpData = historicalLpPrices.get(token.tokenId);
        const poolType = lpData?.poolType || undefined;

        return {
          token: displayName,
          tokenId: token.tokenId,
          amount: endingBalance,
          valueInErg,
          change24h: 0,
          category: categorizeToken(token.name, token.tokenId),
          beginningBalance,
          additions,
          reductions,
          endingBalance,
          priceUnavailable, // Pass flag for UI to show warning
          poolType, // N2T or T2T for LP tokens
        };
      });

    return [ergHolding, ...tokenHoldings];
  }, [balance, selectedMonthBalance, tokens, tokenMovements, viewingCurrentMonth, historicalLpPrices, historicalTokenPrices, blacklistedTokens]);

  // Memoized category values for the SELECTED month
  // For current month: uses live prices
  // For historical months: uses historical prices from JSON files
  const { selectedMonthErgValue, selectedMonthStablesValue, selectedMonthLiquidityValue, selectedMonthTokensValue } = useMemo(() => {
    let erg = 0, stables = 0, liquidity = 0, tokens = 0;
    for (const h of holdings) {
      switch (h.category) {
        case 'ERG': erg += h.valueInErg; break;
        case 'Stables': stables += h.valueInErg; break;
        case 'Liquidity/Lending': liquidity += h.valueInErg; break;
        case 'Tokens': tokens += h.valueInErg; break;
      }
    }
    return {
      selectedMonthErgValue: erg,
      selectedMonthStablesValue: stables,
      selectedMonthLiquidityValue: liquidity,
      selectedMonthTokensValue: tokens,
    };
  }, [holdings]);

  // Memoized chart data - avoids expensive recalculation on unrelated state changes
  const chartData = useMemo(() => {
    const chartLabels = balanceHistory.length > 0
      ? balanceHistory.map(h => h.month)
      : (balance !== null ? ['Current'] : []);

    return {
      labels: chartLabels,
      erg: balanceHistory.length > 0
        ? balanceHistory.map(h => h.balance)
        : (balance !== null ? [selectedMonthErgValue] : []),
      stables: balanceHistory.length > 0
        ? balanceHistory.map(h => chartCategoryHistory.get(h.month)?.stables ?? 0)
        : (balance !== null ? [selectedMonthStablesValue] : []),
      liquidity: balanceHistory.length > 0
        ? balanceHistory.map(h => chartCategoryHistory.get(h.month)?.liquidity ?? 0)
        : (balance !== null ? [selectedMonthLiquidityValue] : []),
      tokens: balanceHistory.length > 0
        ? balanceHistory.map(h => chartCategoryHistory.get(h.month)?.tokens ?? 0)
        : (balance !== null ? [selectedMonthTokensValue] : []),
    };
  }, [balanceHistory, balance, selectedMonthErgValue, selectedMonthStablesValue, selectedMonthLiquidityValue, selectedMonthTokensValue, chartCategoryHistory]);

  // Memoized pie chart data - distribution by category (ERG value) for SELECTED month
  const pieData = useMemo(() => ({
    labels: ['ERG', 'Stables', 'Tokens', 'LP Tokens'],
    values: [selectedMonthErgValue, selectedMonthStablesValue, selectedMonthTokensValue, selectedMonthLiquidityValue],
  }), [selectedMonthErgValue, selectedMonthStablesValue, selectedMonthTokensValue, selectedMonthLiquidityValue]);

  // Helper to check if a token ID is a CyberVerse token
  const isCyberverseToken = useCallback((tokenId: string): boolean => {
    if (!cyberverseSets) return false;
    return (
      cyberverseSets.gen2.has(tokenId) ||
      cyberverseSets.gen3.has(tokenId) ||
      cyberverseSets.cars.has(tokenId) ||
      cyberverseSets.apartments.has(tokenId) ||
      cyberverseSets.pets.has(tokenId) ||
      cyberverseSets.skins.has(tokenId) ||
      cyberverseSets.vipcards.has(tokenId) ||
      cyberverseSets.emotes.has(tokenId) ||
      cyberverseSets.audio.has(tokenId) ||
      cyberverseSets.jackhammers.has(tokenId) ||
      cyberverseSets.eggs.has(tokenId)
    );
  }, [cyberverseSets]);

  // Filter out CyberVerse NFTs and blacklisted tokens from the regular NFT gallery
  const nonCyberverseNfts = useMemo(() => {
    return nfts.filter(nft => !isCyberverseToken(nft.tokenId) && !blacklistedTokens.has(nft.tokenId));
  }, [nfts, isCyberverseToken, blacklistedTokens]);

  // Filter blacklisted tokens from all NFTs (for CyberVerse gallery)
  const safeNfts = useMemo(() => {
    return nfts.filter(nft => !blacklistedTokens.has(nft.tokenId));
  }, [nfts, blacklistedTokens]);

  return (
    <div className="min-h-screen bg-gray-800 text-white flex flex-col">
      {/* Sticky navbar/header */}
      {address ? (
        // Compact navbar when wallet loaded
        <div className="sticky top-0 z-50 bg-gray-800 shadow-lg border-b border-gray-700">
          <Navbar
            address={address}
            isOnline={isOnline}
            isLoading={isLoading}
            error={error}
            selectedMonth={selectedMonth}
            onAddressSubmit={handleAddressSubmit}
            onMonthChange={handleMonthChange}
          />
        </div>
      ) : (
        // Full header for landing page
        <div className="sticky top-0 z-50 bg-gray-800 px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 border-b border-gray-700">
          <Header
            address={address}
            isOnline={isOnline}
            isLoading={isLoading}
            error={error}
            selectedMonth={selectedMonth}
            onAddressSubmit={handleAddressSubmit}
            onMonthChange={handleMonthChange}
          />
        </div>
      )}

      {/* Section Navigation - only show when wallet is loaded */}
      {address && balance !== null && !isLoading && <SectionNav />}

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto px-4 md:px-6 pb-4 md:pb-6 pt-3 md:pt-4">

      {!address && !isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-gray-400">
            <p className="text-xl mb-2">Enter a wallet address to view statement</p>
            <p className="text-sm">Ergo addresses start with '9' and are 51 characters long</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-gray-400">
            <p className="text-xl">Loading wallet data...</p>
          </div>
        </div>
      )}

      {address && balance !== null && !isLoading && (
        <>
          {/* Charts row */}
          <div id="chart" className="grid grid-cols-1 md:grid-cols-[40%_60%] gap-3 md:gap-4 mb-4 md:mb-6">
            <PieChart data={pieData} />
            <Chart
              data={chartData}
              range={chartRange}
              onRangeChange={handleChartRangeChange}
              isLoading={loadingHistory}
            />
          </div>

          {/* Summary, Top Hodls, and Wallet Maintenance row */}
          <div id="summary" className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3 md:gap-4 mb-4 md:mb-6">
            <WalletSummary holdings={holdings} />
            <TopHodls holdings={holdings} />
            <WalletMaintenance
              boxes={demurrageBoxes}
              holdings={holdings}
              blacklistedTokens={blacklistedTokens}
              isLoading={loadingDemurrage}
            />
          </div>

          {/* Holdings and Transaction Activity Row */}
          <div className="grid grid-cols-1 lg:grid-cols-[67%_33%] gap-4 md:gap-6 mb-4 md:mb-6">
            {/* Holdings table - Left 67% */}
            <div id="holdings">
              <Holdings holdings={holdings} selectedMonth={selectedMonth} loadingHistoricalPrices={loadingHistoricalPrices} />
            </div>

            {/* Transaction Stack - Right 33% */}
            <div className="flex flex-col gap-4">
              {/* Transaction Heatmap - Top 50% */}
              <div id="heatmap" className="flex-1">
                <TransactionHeatmap
                  transactions={transactions}
                  selectedMonth={selectedMonth}
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  isLoading={loadingTransactions}
                />
              </div>

              {/* Transaction History - Bottom 50% */}
              <div id="transactions" className="flex-1">
                <TransactionHistory
                  transactions={transactions}
                  total={totalTransactions}
                  isLoading={loadingTransactions}
                  isLoadingMore={loadingMoreTransactions}
                  hasMore={hasMoreTransactions}
                  onLoadMore={loadMoreTransactions}
                  selectedDate={selectedDate}
                  onClearDateFilter={() => setSelectedDate(null)}
                />
              </div>
            </div>
          </div>

          {/* CyberVerse Gallery */}
          <div id="cyberverse" className="mb-4 md:mb-6">
            <CyberVerseGallery
              nfts={safeNfts}
              cyberverseSets={cyberverseSets}
              isLoading={loadingNFTs}
            />
          </div>

          {/* NFT Gallery */}
          <div id="nfts">
            <NFTGallery nfts={nonCyberverseNfts} isLoading={loadingNFTs} />
          </div>
        </>
      )}

      {error && !isLoading && (
        <div className="bg-red-900/50 border border-red-500 p-6 rounded-lg">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
          <p className="text-white">{error}</p>
        </div>
      )}

      <AlertSystem
        alerts={alerts}
        onDismiss={handleDismissAlert}
        onToggleNotifications={toggleNotifications}
        notificationsEnabled={notificationsEnabled}
      />
      </div>
    </div>
  );
}

export default App;
