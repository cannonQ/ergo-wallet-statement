import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Chart } from './components/Chart';
import { PieChart } from './components/PieChart';
import { Holdings } from './components/Holdings';
import { AlertSystem } from './components/AlertSystem';
import { DemurrageAlert } from './components/DemurrageAlert';
import { WalletSummary } from './components/WalletSummary';
import { Collectibles } from './components/Collectibles';
import { ergoApi } from './services/ergoApi';
import type { Alert, Holding, DemurrageBox, Collectible } from './types';

// Placeholder data for features not yet implemented
const mockDemurrageBoxes: DemurrageBox[] = [];

const mockCollectibles: Collectible[] = [];

function App() {
  // Wallet state
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Data state
  const [balance, setBalance] = useState<number>(0);
  const [statementData, setStatementData] = useState<{
    beginningBalance: number;
    additions: number;
    reductions: number;
    endingBalance: number;
  } | null>(null);

  // UI state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // Default to current month
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Fetch wallet data
  const fetchWalletData = useCallback(async (walletAddress: string, month: Date) => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate address format
      if (!ergoApi.isValidAddress(walletAddress)) {
        throw new Error('Invalid Ergo address format');
      }

      // Fetch balance and statement data
      const [ergBalance, statement] = await Promise.all([
        ergoApi.getErgBalance(walletAddress),
        ergoApi.getMonthlyStatement(walletAddress, month.getFullYear(), month.getMonth()),
      ]);

      setBalance(ergBalance);
      setStatementData({
        beginningBalance: statement.beginningBalance,
        additions: statement.additions,
        reductions: statement.reductions,
        endingBalance: statement.endingBalance,
      });
      setIsOnline(true);

      // Add success alert
      setAlerts(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'info',
          message: `Loaded wallet data: ${ergBalance.toFixed(4)} ERG`,
          expiresAt: new Date(Date.now() + 5000),
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch wallet data';
      setError(message);
      setIsOnline(false);

      // Add error alert
      setAlerts(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'error',
          message,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle address submission
  const handleAddressSubmit = useCallback((walletAddress: string) => {
    setAddress(walletAddress);
    fetchWalletData(walletAddress, selectedMonth);
  }, [fetchWalletData, selectedMonth]);

  // Handle month change
  const handleMonthChange = useCallback((month: Date) => {
    setSelectedMonth(month);
    if (address) {
      fetchWalletData(address, month);
    }
  }, [address, fetchWalletData]);

  const handleDismissAlert = (id: string) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
  };

  const toggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
  };

  // Build holdings data from statement
  const holdings: Holding[] = statementData ? [
    {
      token: 'ERG',
      amount: statementData.endingBalance,
      valueInErg: statementData.endingBalance,
      change24h: 0, // Would need price API for this
      category: 'ERG' as const,
      beginningBalance: statementData.beginningBalance,
      additions: statementData.additions,
      reductions: statementData.reductions,
      endingBalance: statementData.endingBalance,
    },
  ] : [];

  // Chart data - for now just show current balance
  const chartData = {
    labels: statementData ? ['Beginning', 'Ending'] : [],
    values: statementData ? [statementData.beginningBalance, statementData.endingBalance] : [],
  };

  // Pie chart data
  const pieData = {
    labels: ['ERG'],
    values: [balance],
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

      {address && statementData && (
        <>
          <div className="grid md:grid-cols-[60%_40%] gap-4 mb-6">
            <Chart data={chartData} />
            <PieChart data={pieData} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[60%_40%] gap-4 mb-6">
            <WalletSummary holdings={holdings} />
            <DemurrageAlert boxes={mockDemurrageBoxes} />
          </div>

          <Holdings holdings={holdings} />

          {mockCollectibles.length > 0 && (
            <Collectibles collectibles={mockCollectibles} />
          )}
        </>
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
