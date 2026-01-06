import React, { useState } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';

interface AddressInputProps {
  onSubmit: (address: string) => void;
  isLoading: boolean;
  error?: string | null;
  currentAddress?: string;
}

export const AddressInput: React.FC<AddressInputProps> = ({
  onSubmit,
  isLoading,
  error,
  currentAddress,
}) => {
  const [address, setAddress] = useState(currentAddress || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAddress = address.trim();
    if (trimmedAddress) {
      onSubmit(trimmedAddress);
    }
  };

  const isValidFormat = address.trim() === '' || /^9[a-zA-Z0-9]{50}$/.test(address.trim());

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Ergo wallet address (starts with 9)"
              className={`w-full bg-gray-800 text-white border rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 pr-10 sm:pr-12 font-mono text-xs sm:text-sm
                ${!isValidFormat ? 'border-red-500' : 'border-gray-700'}
                focus:outline-none focus:border-blue-500 transition-colors`}
              disabled={isLoading}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            {isLoading && (
              <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400 animate-spin" />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || !address.trim() || !isValidFormat}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed
              text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors min-h-[44px]"
          >
            <Search className="w-4 sm:w-5 h-4 sm:h-5" />
            <span className="text-sm sm:text-base">Load</span>
          </button>
        </div>

        {!isValidFormat && (
          <div className="flex items-center space-x-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Invalid address format. Ergo addresses start with '9' and are 51 characters.</span>
          </div>
        )}

        {error && isValidFormat && (
          <div className="flex items-center space-x-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </form>
  );
};
