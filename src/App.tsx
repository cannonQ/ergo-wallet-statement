import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { AlertSystem } from './components/AlertSystem';
import { ergoApi } from './services/ergoApi';
import type { Alert } from './types';

function App() {
  // Wallet state
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Data state
  const [balance, setBalance] = useState<number | null>(null);

  // UI state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Fetch wallet data
  const fetchWalletData = useCallback(async (walletAddress: string) => {
    setIsLoading(true);
    setError(null);
    setBalance(null);

    try {
      if (!ergoApi.isValidAddress(walletAddress)) {
        throw new Error('Invalid Ergo address format');
      }

      const ergBalance = await ergoApi.getErgBalance(walletAddress);
      setBalance(ergBalance);
      setIsOnline(true);

      setAlerts(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'info' as const,
          message: `Loaded wallet: ${ergBalance.toFixed(4)} ERG`,
          expiresAt: new Date(Date.now() + 5000),
        },
      ]);
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
        <div className="bg-gray-900 p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Wallet Balance</h2>
          <div className="text-5xl font-bold text-green-400">
            {balance.toFixed(4)} ERG
          </div>
          <p className="text-gray-400 mt-2">
            Address: {address.slice(0, 12)}...{address.slice(-8)}
          </p>
        </div>
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
