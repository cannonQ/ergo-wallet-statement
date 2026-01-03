import React from 'react';
import { ArrowDownLeft, ArrowUpRight, History, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { formatNumber } from '../constants';

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

const LIMIT_OPTIONS = [20, 40, 60, 100];

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
        <div className="text-center py-8 text-gray-400 text-sm">
          Loading transactions...
        </div>
      ) : displayedTransactions.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No transactions found
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {displayedTransactions.map((tx) => (
            <div
              key={tx.id}
              className="p-2 bg-gray-800 rounded hover:bg-gray-750 transition-colors cursor-pointer group"
              onClick={() => openExplorer(tx.id)}
              title={`${tx.type === 'incoming' ? 'Received' : 'Sent'} ${formatNumber(tx.amount, 4)} ERG\n${format(tx.timestamp, 'MMM d, yyyy HH:mm')}\n${tx.id}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    tx.type === 'incoming'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {tx.type === 'incoming' ? (
                    <ArrowDownLeft className="w-3 h-3" />
                  ) : (
                    <ArrowUpRight className="w-3 h-3" />
                  )}
                </div>
                <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
              </div>
              <div
                className={`text-xs font-medium truncate ${
                  tx.type === 'incoming' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {tx.type === 'incoming' ? '+' : '-'}{formatNumber(tx.amount, 2)}
              </div>
              <div className="text-gray-500 text-xs truncate">
                {format(tx.timestamp, 'MMM d')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
