import React, { useState } from 'react';
import { Menu, X, Copy, CheckCircle, WifiOff, Loader2, ChevronLeft, ChevronRight, Calendar, ExternalLink } from 'lucide-react';
import { AddressInput } from './AddressInput';
import { format, startOfMonth, endOfMonth, formatDistanceToNow } from 'date-fns';
import type { SystemInfo } from '../types';

interface NavbarProps {
  address: string;
  isOnline: boolean;
  isLoading: boolean;
  error?: string | null;
  selectedMonth: Date;
  systemInfo: SystemInfo | null;
  onAddressSubmit: (address: string) => void;
  onMonthChange: (date: Date) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  address,
  isOnline,
  isLoading,
  error,
  selectedMonth,
  systemInfo,
  onAddressSubmit,
  onMonthChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goToPreviousMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onMonthChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    if (newDate <= new Date()) {
      onMonthChange(newDate);
    }
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return (
      selectedMonth.getMonth() === now.getMonth() &&
      selectedMonth.getFullYear() === now.getFullYear()
    );
  };

  // Mobile month format: "Jan 26"
  const mobileMonthFormat = format(selectedMonth, "MMM yy");

  // Date range for month picker
  const startDate = startOfMonth(selectedMonth);
  const endDate = endOfMonth(selectedMonth);
  const dateRange = `${format(startDate, 'MMM d')} - ${format(endDate, 'd, yyyy')}`;

  return (
    <>
      {/* Mobile Navbar */}
      <nav className="md:hidden bg-gray-900 px-3 py-2 flex items-center justify-center gap-2">
        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-gray-400 hover:text-white p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center absolute left-3"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* Compact Month Picker - Centered */}
        <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1">
          <button
            onClick={goToPreviousMonth}
            className="text-gray-400 p-0.5 hover:text-white"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-white text-xs font-medium min-w-[48px] text-center">
            {mobileMonthFormat}
          </span>
          <button
            onClick={goToNextMonth}
            disabled={isCurrentMonth()}
            className="text-gray-400 p-0.5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </nav>

      {/* Desktop Navbar */}
      <nav className="hidden md:flex bg-gray-900 px-4 py-3 items-center justify-between gap-4 rounded-lg">
        {/* Left: Title + Status + Change Wallet */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white whitespace-nowrap">
            Ergo Wallet Statement
          </h1>
          <div className={`flex items-center gap-1.5 ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs">Loading...</span>
              </>
            ) : isOnline ? (
              <>
                <CheckCircle size={16} />
                <span className="text-xs">Connected to Explorer</span>
              </>
            ) : (
              <>
                <WifiOff size={16} />
                <span className="text-xs">Offline</span>
              </>
            )}
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800"
          >
            Change Wallet
          </button>
        </div>

        {/* Center: Month Picker */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <button
            onClick={goToPreviousMonth}
            className="text-gray-400 p-1 hover:bg-gray-700 rounded"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-[180px]">
            <div className="text-white font-semibold text-sm">
              {format(selectedMonth, 'MMMM yyyy')}
            </div>
            <div className="text-gray-400 text-xs">
              {dateRange}
            </div>
          </div>
          <button
            onClick={goToNextMonth}
            disabled={isCurrentMonth()}
            className="text-gray-400 p-1 hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Right: Address */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
          <span className="text-white font-mono text-xs">
            {address.slice(0, 8)}...{address.slice(-6)}
          </span>
          <button
            onClick={copyAddress}
            className="text-gray-400 hover:text-white"
            title="Copy address"
          >
            {copied ? (
              <CheckCircle size={14} className="text-green-400" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>
      </nav>

      {/* Drawer (Mobile + Desktop) */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed top-0 left-0 bottom-0 w-[85vw] max-w-[400px] bg-gray-900 z-50 overflow-y-auto shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white">Menu</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-4 space-y-4">
              {/* Connection Status */}
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-sm text-gray-400">
                    {isOnline ? 'Connected' : 'Offline'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-mono break-all">
                  {address}
                </div>
              </div>

              {/* Change Address */}
              <div>
                <h3 className="text-sm font-medium text-white mb-2">Change Wallet</h3>
                <AddressInput
                  onSubmit={(newAddress) => {
                    onAddressSubmit(newAddress);
                    setDrawerOpen(false);
                  }}
                  isLoading={isLoading}
                  error={error}
                  currentAddress={address}
                />
              </div>

              {/* System Information */}
              {systemInfo && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-2">System Information</h3>
                  <div className="bg-gray-800 rounded-lg p-3 space-y-2 text-xs">
                    {/* Current Block */}
                    <div className="flex justify-between items-start">
                      <span className="text-gray-400">Current Block:</span>
                      <div className="text-right">
                        {systemInfo.currentBlockHash ? (
                          <a
                            href={`https://ergexplorer.com/blocks#${systemInfo.currentBlockHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            <span>{systemInfo.currentBlockHeight.toLocaleString()}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-white">{systemInfo.currentBlockHeight.toLocaleString()}</span>
                        )}
                      </div>
                    </div>

                    {/* Last Fetched */}
                    <div className="flex justify-between items-start">
                      <span className="text-gray-400">Last Fetched:</span>
                      <div className="text-right text-white">
                        <div>{formatDistanceToNow(systemInfo.lastFetchTimestamp, { addSuffix: true })}</div>
                        <div className="text-[10px] text-gray-500">
                          {format(systemInfo.lastFetchTimestamp, 'MMM d, h:mm a')}
                        </div>
                      </div>
                    </div>

                    {/* Historical Data */}
                    <div className="flex justify-between items-start">
                      <span className="text-gray-400">Historical Data:</span>
                      <div className="text-right text-white">
                        <div>Up to {format(new Date(systemInfo.latestHistoricalMonth), "MMM ''yy")}</div>
                        <div className="text-[10px] text-gray-500">Month-end pricing</div>
                      </div>
                    </div>

                    {/* API Endpoint */}
                    <div className="flex justify-between items-start">
                      <span className="text-gray-400">API Endpoint:</span>
                      <a
                        href="https://api.ergoplatform.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <span>{systemInfo.apiEndpoint}</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};
