import React from 'react';
import { ArrowDownLeft, ArrowUpRight, History, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  timestamp: Date;
  type: 'incoming' | 'outgoing';
  amount: number;
  status: 'confirmed' | 'pending';
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  total: number;
  isLoading?: boolean;
  limit: number;
  onLimitChange: (limit: number) => void;
}

const LIMIT_OPTIONS = [5, 10, 25, 50, 100];

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  total,
  isLoading = false,
  limit,
  onLimitChange,
}) => {
  const openExplorer = (txId: string) => {
    window.open(`https://ergexplorer.com/transactions#${txId}`, '_blank');
  };

  const displayedTransactions = transactions.slice(0, limit);

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-bold text-white">Recent Transactions</h2>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="bg-gray-800 text-white text-sm px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-gray-600"
          >
            {LIMIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt} tx
              </option>
            ))}
          </select>
          <span className="text-gray-400 text-sm">
            {displayedTransactions.length} of {total}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-gray-400 text-sm">
          Loading transactions...
        </div>
      ) : displayedTransactions.length === 0 ? (
        <div className="text-center py-4 text-gray-400 text-sm">
          No transactions found
        </div>
      ) : (
        <div className="space-y-1">
          {displayedTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-2 bg-gray-800 rounded hover:bg-gray-750 transition-colors cursor-pointer"
              onClick={() => openExplorer(tx.id)}
            >
              <div className="flex items-center space-x-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    tx.type === 'incoming'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {tx.type === 'incoming' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="text-white text-sm font-medium">
                    {tx.type === 'incoming' ? 'Received' : 'Sent'}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {format(tx.timestamp, 'MMM d, HH:mm')}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <div
                    className={`text-sm font-medium ${
                      tx.type === 'incoming' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {tx.type === 'incoming' ? '+' : '-'}
                    {tx.amount.toFixed(4)} ERG
                  </div>
                  <div className="text-gray-500 text-xs font-mono">
                    {tx.id.slice(0, 6)}...{tx.id.slice(-4)}
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-500" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
