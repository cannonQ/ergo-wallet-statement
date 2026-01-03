import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import type { Holding } from '../types';

interface HoldingsProps {
  holdings: Holding[];
}

export const Holdings: React.FC<HoldingsProps> = ({ holdings }) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof Holding>('valueInErg');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedCategory, setSelectedCategory] = useState<string>('ERG');

  const categories = ['ERG', 'Stables', 'Tokens', 'Liquidity/Lending'];

  const filteredHoldings = holdings
    .filter(holding => 
      holding.token.toLowerCase().includes(search.toLowerCase()) &&
      (selectedCategory === 'All' || holding.category === selectedCategory)
    )
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      return sortDirection === 'asc' 
        ? (aValue > bValue ? 1 : -1)
        : (aValue < bValue ? 1 : -1);
    });

  const toggleSort = (field: keyof Holding) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Wallet Details</h2>
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <button
              className={`px-4 py-2 rounded-lg ${
                selectedCategory === 'All'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => setSelectedCategory('All')}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                className={`px-4 py-2 rounded-lg ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search tokens..."
              className="bg-gray-800 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-600"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800">
              <th className="pb-4 text-left">Token</th>
              <th className="pb-4 text-right cursor-pointer" onClick={() => toggleSort('beginningBalance')}>
                Beginning Balance
                {sortField === 'beginningBalance' && (
                  sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />
                )}
              </th>
              <th className="pb-4 text-right">Additions</th>
              <th className="pb-4 text-right">Reductions</th>
              <th className="pb-4 text-right cursor-pointer" onClick={() => toggleSort('endingBalance')}>
                Ending Balance
                {sortField === 'endingBalance' && (
                  sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />
                )}
              </th>
              <th className="pb-4 text-right cursor-pointer" onClick={() => toggleSort('valueInErg')}>
                Value (ERG)
                {sortField === 'valueInErg' && (
                  sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />
                )}
              </th>
              <th className="pb-4 text-right cursor-pointer" onClick={() => toggleSort('change24h')}>
                24h Change
                {sortField === 'change24h' && (
                  sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredHoldings.map((holding) => (
              <tr key={holding.token} className="border-b border-gray-800">
                <td className="py-4 text-white">{holding.token}</td>
                <td className="py-4 text-right text-white">{holding.beginningBalance.toLocaleString()}</td>
                <td className="py-4 text-right text-green-400">+{holding.additions.toLocaleString()}</td>
                <td className="py-4 text-right text-red-400">-{holding.reductions.toLocaleString()}</td>
                <td className="py-4 text-right text-white">{holding.endingBalance.toLocaleString()}</td>
                <td className="py-4 text-right text-white">{holding.valueInErg.toLocaleString()} ERG</td>
                <td className={`py-4 text-right ${holding.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {holding.change24h >= 0 ? '+' : ''}{holding.change24h}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};