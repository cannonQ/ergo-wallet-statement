import React, { useState, useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, History, ExternalLink, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
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
  selectedDate?: Date | null;
  onClearDateFilter?: () => void;
}

const LIMIT_OPTIONS = [20, 40, 60, 100];
const PAGE_SIZE = 20;

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  total,
  isLoading = false,
  limit,
  onLimitChange,
  selectedDate,
  onClearDateFilter,
}) => {
  const [page, setPage] = useState(0);

  const openExplorer = (txId: string) => {
    window.open(`https://ergexplorer.com/transactions#${txId}`, '_blank');
  };

  // Filter by selected date if provided
  const filteredTransactions = useMemo(() => {
    if (!selectedDate) return transactions;
    return transactions.filter(tx => isSameDay(tx.timestamp, selectedDate));
  }, [transactions, selectedDate]);

  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE);
  const displayedTransactions = filteredTransactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handlePrevPage = () => setPage(p => Math.max(0, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages - 1, p + 1));

  // Reset page when date filter changes
  React.useEffect(() => {
    setPage(0);
  }, [selectedDate]);

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-bold text-white">Recent Transactions</h2>
          {selectedDate && (
            <div className="flex items-center bg-purple-600/30 text-purple-300 px-2 py-1 rounded text-xs">
              <span>{format(selectedDate, 'MMM d, yyyy')}</span>
              <button
                onClick={onClearDateFilter}
                className="ml-1 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {/* Pagination */}
          <div className="flex items-center space-x-1">
            <button
              onClick={handlePrevPage}
              disabled={page === 0}
              className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-gray-400 text-xs">
              {page + 1}/{Math.max(1, totalPages)}
            </span>
            <button
              onClick={handleNextPage}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-gray-400 text-sm">
            {filteredTransactions.length} tx
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
