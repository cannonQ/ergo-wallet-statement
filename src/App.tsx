import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { Chart } from './components/Chart';
import { PieChart } from './components/PieChart';
import { WalletSummary } from './components/WalletSummary';
import { Holdings } from './components/Holdings';
import { TransactionHistory } from './components/TransactionHistory';
import { DemurrageAlert } from './components/DemurrageAlert';
import { NFTGallery } from './components/NFTGallery';
import { AlertSystem } from './components/AlertSystem';
import { ergoApi } from './services/ergoApi';
import type { Alert, Holding } from './types';

interface Token {
  tokenId: string;
  name: string;
  amount: number;
  decimals: number;
  valueInErg: number;
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

// Categorize tokens based on known token names
const categorizeToken = (name: string): Holding['category'] => {
  const nameLower = name.toLowerCase();
  if (nameLower === 'erg') return 'ERG';
  if (nameLower.includes('sigusd') || nameLower.includes('sigrsv') || nameLower.includes('stable') || nameLower.includes('gold')) return 'Stables';
  if (nameLower.includes('lp') || nameLower.includes('liquidity') || nameLower.includes('lending')) return 'Liquidity/Lending';
  return 'Tokens';
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
  const [balanceHistory, setBalanceHistory] = useState<Array<{ month: string; balance: number }>>([]);

  // Loading states for individual sections
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingDemurrage, setLoadingDemurrage] = useState(false);
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Token movements (In/Out) for selected month
  const [tokenMovements, setTokenMovements] = useState<Map<string, { additions: number; reductions: number }>>(new Map());

  // UI state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [transactionLimit, setTransactionLimit] = useState(5);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Fetch transactions and token movements for selected month
  const fetchTransactionsForMonth = useCallback(async (walletAddress: string, month: Date) => {
    setLoadingTransactions(true);
    try {
      // Fetch transactions and token movements in parallel
      const [txResult, movements] = await Promise.all([
        ergoApi.getMonthTransactions(
          walletAddress,
          month.getFullYear(),
          month.getMonth(),
          100 // Fetch up to 100 transactions, UI will limit display
        ),
        ergoApi.getTokenMovements(
          walletAddress,
          month.getFullYear(),
          month.getMonth()
        ),
      ]);
      setTransactions(txResult.transactions);
      setTotalTransactions(txResult.total);
      setTokenMovements(movements);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setTransactions([]);
      setTotalTransactions(0);
      setTokenMovements(new Map());
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

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

      // Fetch transactions for selected month in background
      fetchTransactionsForMonth(walletAddress, month);

      // Fetch balance history for chart in background
      setLoadingHistory(true);
      ergoApi.getMonthlyBalanceHistory(walletAddress, 6)
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
  }, [fetchTransactionsForMonth]);

  const handleAddressSubmit = useCallback((walletAddress: string) => {
    setAddress(walletAddress);
    fetchWalletData(walletAddress, selectedMonth);
  }, [fetchWalletData, selectedMonth]);

  // Re-fetch transactions when month changes
  const handleMonthChange = useCallback((month: Date) => {
    setSelectedMonth(month);
    if (address) {
      fetchTransactionsForMonth(address, month);
    }
  }, [address, fetchTransactionsForMonth]);

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

  // Convert tokens to Holdings format for the original components
  // Note: ERG shows selected month's ending balance, tokens show current values
  // Get ERG movements for the month (stored with pseudo ID '__ERG__')
  const ergMovement = tokenMovements.get('__ERG__') || { additions: 0, reductions: 0 };

  const holdings: Holding[] = balance !== null ? [
    // ERG holding - use selected month's balance
    {
      token: 'ERG',
      tokenId: '', // ERG has no token ID
      amount: selectedMonthBalance,
      valueInErg: selectedMonthBalance, // ERG value = ERG amount
      change24h: 0,
      category: 'ERG' as const,
      beginningBalance: selectedMonthBalance - ergMovement.additions + ergMovement.reductions,
      additions: ergMovement.additions,
      reductions: ergMovement.reductions,
      endingBalance: selectedMonthBalance,
    },
    // Token holdings with ERG values from Crux Finance prices (current values)
    ...tokens.map(token => {
      // Get movement for this token, adjusting for decimals
      const rawMovement = tokenMovements.get(token.tokenId) || { additions: 0, reductions: 0 };
      const divisor = token.decimals > 0 ? Math.pow(10, token.decimals) : 1;
      const additions = rawMovement.additions / divisor;
      const reductions = rawMovement.reductions / divisor;

      return {
        token: token.name,
        tokenId: token.tokenId,
        amount: token.amount,
        valueInErg: token.valueInErg, // ERG equivalent from Crux prices
        change24h: 0,
        category: categorizeToken(token.name),
        beginningBalance: token.amount - additions + reductions,
        additions,
        reductions,
        endingBalance: token.amount,
      };
    }),
  ] : [];

  // Calculate current values by category
  const currentErgValue = holdings.filter(h => h.category === 'ERG').reduce((sum, h) => sum + h.valueInErg, 0);
  const currentStablesValue = holdings.filter(h => h.category === 'Stables').reduce((sum, h) => sum + h.valueInErg, 0);
  const currentLiquidityValue = holdings.filter(h => h.category === 'Liquidity/Lending').reduce((sum, h) => sum + h.valueInErg, 0);
  const currentTokensValue = holdings.filter(h => h.category === 'Tokens').reduce((sum, h) => sum + h.valueInErg, 0);

  // Chart data - stacked area chart showing value breakdown by category
  // For historical months, we only have ERG balance. Token values are shown for current month only.
  const chartLabels = balanceHistory.length > 0
    ? balanceHistory.map(h => h.month)
    : (balance !== null ? ['Current'] : []);

  const chartData = {
    labels: chartLabels,
    erg: balanceHistory.length > 0
      ? balanceHistory.map(h => h.balance)
      : (balance !== null ? [currentErgValue] : []),
    stables: balanceHistory.length > 0
      ? balanceHistory.map((_, i) => i === balanceHistory.length - 1 ? currentStablesValue : 0)
      : (balance !== null ? [currentStablesValue] : []),
    liquidity: balanceHistory.length > 0
      ? balanceHistory.map((_, i) => i === balanceHistory.length - 1 ? currentLiquidityValue : 0)
      : (balance !== null ? [currentLiquidityValue] : []),
    tokens: balanceHistory.length > 0
      ? balanceHistory.map((_, i) => i === balanceHistory.length - 1 ? currentTokensValue : 0)
      : (balance !== null ? [currentTokensValue] : []),
  };

  // Pie chart data - distribution by category (ERG value)
  const pieData = {
    labels: ['ERG', 'Stables', 'Tokens', 'LP Tokens'],
    values: [currentErgValue, currentStablesValue, currentTokensValue, currentLiquidityValue],
  };

  return (
    <div className="min-h-screen bg-gray-800 text-white p-6">
      <Header
        address={address}
        isOnline={isOnline}
        isLoading={isLoading}
        error={error}
        selectedMonth={selectedMonth}
        onAddressSubmit={handleAddressSubmit}
        onMonthChange={handleMonthChange}
      />

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
          <div className="grid md:grid-cols-[60%_40%] gap-4 mb-6">
            <Chart data={chartData} />
            <PieChart data={pieData} />
          </div>

          {/* Summary and Demurrage row */}
          <div className="grid grid-cols-1 md:grid-cols-[60%_40%] gap-4 mb-6">
            <WalletSummary holdings={holdings} />
            <DemurrageAlert boxes={demurrageBoxes} isLoading={loadingDemurrage} />
          </div>

          {/* Holdings table */}
          <div className="mb-6">
            <Holdings holdings={holdings} />
          </div>

          {/* Transaction History */}
          <div className="mb-6">
            <TransactionHistory
              transactions={transactions}
              total={totalTransactions}
              isLoading={loadingTransactions}
              limit={transactionLimit}
              onLimitChange={setTransactionLimit}
            />
          </div>

          {/* NFT Gallery */}
          <NFTGallery nfts={nfts} isLoading={loadingNFTs} />
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
  );
}

export default App;
