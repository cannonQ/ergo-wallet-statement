import React from 'react';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';

interface SummaryProps {
  totalBalance: number;
  change24h: number;
  totalTransactions: number;
  activeTokens: number;
}

export const FinancialSummary: React.FC<SummaryProps> = ({
  totalBalance,
  change24h,
  totalTransactions,
  activeTokens,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-gray-400 text-sm">Total Balance</h3>
            <p className="text-2xl font-bold text-white mt-1">
              {totalBalance.toLocaleString()} ERG
            </p>
          </div>
          <button className="text-gray-400 hover:text-white transition-colors">
            <Info size={20} />
          </button>
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-gray-400 text-sm">24h Change</h3>
            <div className="flex items-center mt-1">
              {change24h >= 0 ? (
                <TrendingUp className="text-green-400 mr-2" size={20} />
              ) : (
                <TrendingDown className="text-red-400 mr-2" size={20} />
              )}
              <p className={`text-2xl font-bold ${change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {Math.abs(change24h).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
        <h3 className="text-gray-400 text-sm">Total Transactions</h3>
        <p className="text-2xl font-bold text-white mt-1">{totalTransactions}</p>
      </div>

      <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
        <h3 className="text-gray-400 text-sm">Active Tokens</h3>
        <p className="text-2xl font-bold text-white mt-1">{activeTokens}</p>
      </div>
    </div>
  );
};