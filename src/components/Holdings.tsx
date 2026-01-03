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
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[200px]" /> {/* Token */}
            <col className="w-[120px]" /> {/* Begin */}
            <col className="w-[80px]" />  {/* In */}
            <col className="w-[80px]" />  {/* Out */}
            <col className="w-[120px]" /> {/* End */}
            <col className="w-[140px]" /> {/* Value (ERG) */}
            <col className="w-[100px]" /> {/* Change % */}
          </colgroup>
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-sm">
              <th className="pb-3 text-left font-medium">Token</th>
              <th className="pb-3 text-right font-medium cursor-pointer" onClick={() => toggleSort('beginningBalance')}>
                Begin
                {sortField === 'beginningBalance' && (
                  sortDirection === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />
                )}
              </th>
              <th className="pb-3 text-right font-medium">In</th>
              <th className="pb-3 text-right font-medium">Out</th>
              <th className="pb-3 text-right font-medium cursor-pointer" onClick={() => toggleSort('endingBalance')}>
                End
                {sortField === 'endingBalance' && (
                  sortDirection === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />
                )}
              </th>
              <th className="pb-3 text-right font-medium cursor-pointer" onClick={() => toggleSort('valueInErg')}>
                Value (ERG)
                {sortField === 'valueInErg' && (
                  sortDirection === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />
                )}
              </th>
              <th className="pb-3 text-right font-medium cursor-pointer" onClick={() => toggleSort('change24h')}>
                Change %
                {sortField === 'change24h' && (
                  sortDirection === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredHoldings.map((holding) => {
              const displayName = holding.token.length > 20
                ? holding.token.slice(0, 20) + '...'
                : holding.token;
              const shortTokenId = holding.tokenId ? holding.tokenId.slice(0, 5) : '';

              return (
                <tr key={holding.tokenId || holding.token} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 text-white">
                    <div className="flex items-center gap-2">
                      <span title={holding.token} className="font-medium">{displayName}</span>
                      {shortTokenId && (
                        <a
                          href={`https://ergexplorer.com/token#${holding.tokenId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-blue-400 text-xs"
                          title={holding.tokenId}
                        >
                          ({shortTokenId}...)
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-right text-white tabular-nums">{holding.amount.toFixed(1)}</td>
                  <td className="py-3 text-right text-green-400 tabular-nums">+{holding.additions.toFixed(1)}</td>
                  <td className="py-3 text-right text-red-400 tabular-nums">-{holding.reductions.toFixed(1)}</td>
                  <td className="py-3 text-right text-white tabular-nums">{holding.amount.toFixed(1)}</td>
                  <td className="py-3 text-right text-white tabular-nums">{holding.valueInErg.toFixed(2)} ERG</td>
                  <td className={`py-3 text-right tabular-nums ${holding.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {holding.change24h >= 0 ? '+' : ''}{holding.change24h.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};