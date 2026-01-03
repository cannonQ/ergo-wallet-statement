import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { Copy, CheckCircle, WifiOff } from 'lucide-react';
import "react-datepicker/dist/react-datepicker.css";

interface HeaderProps {
  address: string;
  isOnline: boolean;
  onDateRangeChange: (start: Date, end: Date) => void;
}

export const Header: React.FC<HeaderProps> = ({ address, isOnline, onDateRangeChange }) => {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="bg-gray-900 p-6 rounded-lg shadow-lg mb-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-white">Ergo Wallet</h1>
          <div className={`flex items-center ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
            {isOnline ? <CheckCircle size={20} /> : <WifiOff size={20} />}
            <span className="ml-2 text-sm">{isOnline ? 'Connected' : 'Offline'}</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-gray-800 rounded-lg p-2 flex items-center">
            <span className="text-gray-400 text-sm mr-2">Address:</span>
            <span className="text-white font-mono">{`${address.slice(0, 6)}...${address.slice(-4)}`}</span>
            <button
              onClick={copyAddress}
              className="ml-2 text-gray-400 hover:text-white transition-colors"
            >
              {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center space-x-4">
        <DatePicker
          selected={startDate}
          onChange={(date: Date) => {
            setStartDate(date);
            onDateRangeChange(date, endDate);
          }}
          className="bg-gray-800 text-white border border-gray-700 rounded p-2"
        />
        <span className="text-gray-400">to</span>
        <DatePicker
          selected={endDate}
          onChange={(date: Date) => {
            setEndDate(date);
            onDateRangeChange(startDate, date);
          }}
          className="bg-gray-800 text-white border border-gray-700 rounded p-2"
        />
      </div>
    </header>
  );
};