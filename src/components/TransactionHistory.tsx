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
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  total,
  isLoading = false,
}) => {
  const openExplorer = (txId: string) => {
    window.open(`https://ergexplorer.com/transactions#${txId}`, '_blank');
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-bold text-white">Recent Transactions</h2>
        </div>
        <div className="text-gray-400 text-sm">
          Showing {transactions.length} of {total.toLocaleString()}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">
          Loading transactions...
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No transactions found
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors cursor-pointer"
              onClick={() => openExplorer(tx.id)}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === 'incoming'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {tx.type === 'incoming' ? (
                    <ArrowDownLeft className="w-5 h-5" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="text-white font-medium">
                    {tx.type === 'incoming' ? 'Received' : 'Sent'}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {format(tx.timestamp, 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div
                    className={`font-medium ${
                      tx.type === 'incoming' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {tx.type === 'incoming' ? '+' : '-'}
                    {tx.amount.toFixed(4)} ERG
                  </div>
                  <div className="text-gray-400 text-xs font-mono">
                    {tx.id.slice(0, 8)}...{tx.id.slice(-4)}
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          ))}
        </div>
      )}

      {total > transactions.length && (
        <div className="mt-4 pt-4 border-t border-gray-800 text-center">
          <span className="text-gray-400 text-sm">
            Showing {transactions.length} of {total.toLocaleString()} transactions this month
          </span>
        </div>
      )}
    </div>
  );
};
