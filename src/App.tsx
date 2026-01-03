import React, { useState, useCallback } from 'react';
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

  // Loading states for individual sections
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingDemurrage, setLoadingDemurrage] = useState(false);
  const [loadingNFTs, setLoadingNFTs] = useState(false);

  // UI state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Fetch all wallet data
  const fetchWalletData = useCallback(async (walletAddress: string) => {
    setIsLoading(true);
    setError(null);
    setBalance(null);
    setTokens([]);
    setTransactions([]);
    setDemurrageBoxes([]);
    setNfts([]);

    try {
      if (!ergoApi.isValidAddress(walletAddress)) {
        throw new Error('Invalid Ergo address format');
      }

      // Fetch balance and tokens first (most important)
      const fullBalance = await ergoApi.getFullBalance(walletAddress);
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

      // Fetch transactions in background
      setLoadingTransactions(true);
      ergoApi.getRecentTransactions(walletAddress, 20)
        .then(result => {
          setTransactions(result.transactions);
          setTotalTransactions(result.total);
        })
        .catch(err => console.error('Failed to load transactions:', err))
        .finally(() => setLoadingTransactions(false));

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
  }, []);

  const handleAddressSubmit = useCallback((walletAddress: string) => {
    setAddress(walletAddress);
    fetchWalletData(walletAddress);
  }, [fetchWalletData]);

  const handleMonthChange = useCallback((month: Date) => {
    setSelectedMonth(month);
  }, []);

  const handleDismissAlert = (id: string) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
  };

  const toggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
  };

  // Convert tokens to Holdings format for the original components
  const holdings: Holding[] = balance !== null ? [
    // ERG holding
    {
      token: 'ERG',
      amount: balance,
      valueInErg: balance,
      change24h: 0,
      category: 'ERG' as const,
      beginningBalance: balance,
      additions: 0,
      reductions: 0,
      endingBalance: balance,
    },
    // Token holdings
    ...tokens.map(token => ({
      token: token.name,
      amount: token.amount,
      valueInErg: 0, // Would need price API
      change24h: 0,
      category: categorizeToken(token.name),
      beginningBalance: token.amount,
      additions: 0,
      reductions: 0,
      endingBalance: token.amount,
    })),
  ] : [];

  // Chart data - show balance (simplified since we don't have historical data)
  const chartData = {
    labels: balance !== null ? ['Current Balance'] : [],
    values: balance !== null ? [balance] : [],
  };

  // Pie chart data - distribution by category
  const pieData = {
    labels: ['ERG', 'Stables', 'Tokens', 'LP Tokens'],
    values: [
      holdings.filter(h => h.category === 'ERG').reduce((sum, h) => sum + h.valueInErg, 0),
      holdings.filter(h => h.category === 'Stables').reduce((sum, h) => sum + h.valueInErg, 0),
      holdings.filter(h => h.category === 'Tokens').reduce((sum, h) => sum + h.valueInErg, 0),
      holdings.filter(h => h.category === 'Liquidity/Lending').reduce((sum, h) => sum + h.valueInErg, 0),
    ],
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
