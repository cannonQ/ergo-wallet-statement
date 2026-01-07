import React, { useState } from 'react';
import { Copy, CheckCircle } from 'lucide-react';
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

  // When wallet is loaded, show compact header; otherwise show full landing header
  if (address) {
    return (
      <header className="bg-gray-900 p-2 sm:p-3 rounded-lg shadow-lg mb-3 md:mb-4">
        <div className="flex items-center justify-between gap-2">
          <MonthPicker selectedMonth={selectedMonth} onChange={onMonthChange} />
          <div className="bg-gray-800 rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5">
            <span className="text-white font-mono text-[10px] sm:text-xs">{`${address.slice(0, 6)}...${address.slice(-4)}`}</span>
            <button
              onClick={copyAddress}
              className="text-gray-400 hover:text-white transition-colors p-1 min-h-[36px] min-w-[36px] flex items-center justify-center sm:min-h-0 sm:min-w-0"
              title="Copy address"
            >
              {copied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </header>
    );
  }

  // Landing header - full size with address input
  return (
    <header className="bg-gray-900 p-4 md:p-6 rounded-lg shadow-lg mb-4 md:mb-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 md:gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-white">Ergo Wallet Statement</h1>
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
