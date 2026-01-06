import React, { useState } from 'react';
import { Copy, CheckCircle, WifiOff, Loader2 } from 'lucide-react';
import { AddressInput } from './AddressInput';
import { MonthPicker } from './MonthPicker';

interface HeaderProps {
  address: string | null;
  isOnline: boolean;
  isLoading: boolean;
  error?: string | null;
  selectedMonth: Date;
  onAddressSubmit: (address: string) => void;
  onMonthChange: (date: Date) => void;
}

export const Header: React.FC<HeaderProps> = ({
  address,
  isOnline,
  isLoading,
  error,
  selectedMonth,
  onAddressSubmit,
  onMonthChange,
}) => {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="bg-gray-900 p-4 md:p-6 rounded-lg shadow-lg mb-4 md:mb-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 md:gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full lg:w-auto">
          <h1 className="text-xl md:text-2xl font-bold text-white">Ergo Wallet Statement</h1>
          <div className={`flex items-center ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span className="ml-2 text-xs sm:text-sm">Loading...</span>
              </>
            ) : isOnline ? (
              <>
                <CheckCircle size={18} />
                <span className="ml-2 text-xs sm:text-sm">Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={18} />
                <span className="ml-2 text-xs sm:text-sm">Offline</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
          <MonthPicker selectedMonth={selectedMonth} onChange={onMonthChange} />
          {address && (
            <div className="bg-gray-800 rounded-lg p-2 flex items-center w-full sm:w-auto">
              <span className="text-gray-400 text-xs sm:text-sm mr-2 hidden sm:inline">Address:</span>
              <span className="text-white font-mono text-xs sm:text-sm">{`${address.slice(0, 8)}...${address.slice(-6)}`}</span>
              <button
                onClick={copyAddress}
                className="ml-2 text-gray-400 hover:text-white transition-colors p-1"
                title="Copy address"
              >
                {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 md:mt-4">
        <AddressInput
          onSubmit={onAddressSubmit}
          isLoading={isLoading}
          error={error}
          currentAddress={address || ''}
        />
      </div>
    </header>
  );
};
