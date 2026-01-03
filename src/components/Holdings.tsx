import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import type { Holding } from '../types';
import { ergoApi, LpPairInfo, HistoricalPriceData } from '../services/ergoApi';
import { getCategoryColor, formatNumber } from '../constants';

interface HoldingsProps {
  holdings: Holding[];
  selectedMonth: Date;
}

interface HistoricalPriceInfo {
  prices: Map<string, HistoricalPriceData>;
  changes: Map<string, { startPrice: number; endPrice: number }>;
  loading: boolean;
}

// Check if the selected month is the current month
const isCurrentMonth = (selectedMonth: Date): boolean => {
  const now = new Date();
  return selectedMonth.getFullYear() === now.getFullYear() &&
         selectedMonth.getMonth() === now.getMonth();
};

export const Holdings: React.FC<HoldingsProps> = ({ holdings, selectedMonth }) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof Holding>('valueInErg');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedCategory, setSelectedCategory] = useState<string>('ERG'); // Default to ERG
  const [lpPairInfoMap, setLpPairInfoMap] = useState<Map<string, LpPairInfo>>(new Map());
  const [historicalPrices, setHistoricalPrices] = useState<HistoricalPriceInfo>({
    prices: new Map(),
    changes: new Map(),
    loading: false,
  });

  // Determine if we can show current prices (only for current month)
  const showCurrentPrices = isCurrentMonth(selectedMonth);

  // Fetch LP pair info for LP/Lending tokens
  useEffect(() => {
    const fetchLpPairInfo = async () => {
      const lpTokens = holdings.filter(h =>
        h.category === 'Liquidity/Lending' &&
        h.tokenId &&
        !lpPairInfoMap.has(h.tokenId)
      );

      for (const token of lpTokens) {
        try {
          const pairInfo = await ergoApi.getLpPairInfo(token.tokenId);
          if (pairInfo) {
            setLpPairInfoMap(prev => new Map(prev).set(token.tokenId, pairInfo));
          }
        } catch (error) {
          console.error(`Error fetching LP pair info for ${token.tokenId}:`, error);
        }
      }
    };

    fetchLpPairInfo();
  }, [holdings]);

  // Fetch historical prices when viewing non-current months
  useEffect(() => {
    const fetchHistoricalPrices = async () => {
      // Only fetch for non-current months
      if (showCurrentPrices) {
        setHistoricalPrices({ prices: new Map(), changes: new Map(), loading: false });
        return;
      }

      // Get token IDs (excluding ERG which has no token ID)
      const tokenIds = holdings
        .filter(h => h.tokenId && h.tokenId.length === 64)
        .map(h => h.tokenId);

      if (tokenIds.length === 0) {
        setHistoricalPrices({ prices: new Map(), changes: new Map(), loading: false });
        return;
      }

      setHistoricalPrices(prev => ({ ...prev, loading: true }));

      try {
        const year = selectedMonth.getFullYear();
        const month = selectedMonth.getMonth();

        // Fetch both price data and change data in parallel
        const [priceMap, changeMap] = await Promise.all([
          ergoApi.getHistoricalPricesForMonth(tokenIds, year, month),
          ergoApi.getHistoricalPriceChange(tokenIds, year, month),
        ]);

        setHistoricalPrices({
          prices: priceMap,
          changes: changeMap,
          loading: false,
        });
      } catch (error) {
        console.error('Error fetching historical prices:', error);
        setHistoricalPrices({ prices: new Map(), changes: new Map(), loading: false });
      }
    };

    fetchHistoricalPrices();
  }, [holdings, selectedMonth, showCurrentPrices]);

  const categories = ['ERG', 'Stables', 'Tokens', 'Liquidity/Lending'];

  const filteredHoldings = holdings
    .filter(holding => {
      // Basic search and category filter
      const matchesSearch = holding.token.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || holding.category === selectedCategory;

      // For Tokens category, exclude NFTs (amount === 1)
      if (holding.category === 'Tokens' && holding.amount === 1) {
        return false; // NFTs have amount of exactly 1
      }

      return matchesSearch && matchesCategory;
    })
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
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === 'All'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700'
              }`}
              onClick={() => setSelectedCategory('All')}
            >
              All
            </button>
            {categories.map((category) => {
              const colorConfig = getCategoryColor(category);
              const isSelected = selectedCategory === category;
              return (
                <button
                  key={category}
                  className={`px-4 py-2 rounded-lg transition-colors border ${
                    isSelected
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  style={{
                    backgroundColor: isSelected ? colorConfig.bg : colorConfig.bgFaded,
                    borderColor: isSelected ? colorConfig.primary : 'transparent'
                  }}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category === 'Liquidity/Lending' ? 'Liquidity' : category}
                </button>
              );
            })}
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
            <col className="w-[100px]" />  {/* In */}
            <col className="w-[100px]" />  {/* Out */}
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
              const lpInfo = holding.tokenId ? lpPairInfoMap.get(holding.tokenId) : null;

              // For LP tokens, show the pair name; otherwise show the token name
              const displayName = lpInfo
                ? lpInfo.lpName
                : (holding.token.length > 20
                    ? holding.token.slice(0, 20) + '...'
                    : holding.token);

              const shortTokenId = holding.tokenId ? holding.tokenId.slice(0, 5) : '';
              const ERG_ID = '0000000000000000000000000000000000000000000000000000000000000000';

              return (
                <tr key={holding.tokenId || holding.token} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 text-white">
                    <div className="flex items-center gap-2 flex-wrap">
                      {lpInfo ? (
                        // LP token: show pair name with links to each token
                        <>
                          <span className="font-medium">
                            {lpInfo.token1.id !== ERG_ID ? (
                              <a
                                href={`https://ergexplorer.com/token#${lpInfo.token1.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-400"
                              >
                                {lpInfo.token1.ticker}
                              </a>
                            ) : (
                              <span>{lpInfo.token1.ticker}</span>
                            )}
                            <span className="text-gray-400">/</span>
                            {lpInfo.token2.id && lpInfo.token2.id !== ERG_ID ? (
                              <a
                                href={`https://ergexplorer.com/token#${lpInfo.token2.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-400"
                              >
                                {lpInfo.token2.ticker}
                              </a>
                            ) : (
                              <span>{lpInfo.token2.ticker}</span>
                            )}
                            <span className="text-gray-400 ml-1">LP</span>
                          </span>
                          <a
                            href={`https://ergexplorer.com/token#${holding.tokenId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-blue-400 text-xs"
                            title={holding.tokenId}
                          >
                            ({shortTokenId}...)
                          </a>
                        </>
                      ) : (
                        // Regular token
                        <>
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
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-right text-white tabular-nums">{formatNumber(holding.beginningBalance)}</td>
                  <td className="py-3 text-right text-green-400 tabular-nums">+{formatNumber(holding.additions)}</td>
                  <td className="py-3 text-right text-red-400 tabular-nums">-{formatNumber(holding.reductions)}</td>
                  <td className="py-3 text-right text-white tabular-nums">{formatNumber(holding.endingBalance)}</td>
                  <td className="py-3 text-right text-white tabular-nums">
                    {showCurrentPrices ? (
                      `${formatNumber(holding.valueInErg)} ERG`
                    ) : (() => {
                      // Historical pricing - calculate value from historical price
                      if (historicalPrices.loading) {
                        return <span className="text-gray-500">...</span>;
                      }
                      // ERG token - value equals amount
                      if (!holding.tokenId || holding.token === 'ERG') {
                        return `${formatNumber(holding.endingBalance)} ERG`;
                      }
                      const priceData = historicalPrices.prices.get(holding.tokenId);
                      if (priceData) {
                        const historicalValue = holding.endingBalance * priceData.priceInErg;
                        return `${formatNumber(historicalValue)} ERG`;
                      }
                      return <span className="text-gray-500">-</span>;
                    })()}
                  </td>
                  <td className={`py-3 text-right tabular-nums ${(() => {
                    if (!showCurrentPrices) {
                      const changeData = holding.tokenId ? historicalPrices.changes.get(holding.tokenId) : null;
                      if (changeData) {
                        const changePercent = ((changeData.endPrice - changeData.startPrice) / changeData.startPrice) * 100;
                        return changePercent >= 0 ? 'text-green-400' : 'text-red-400';
                      }
                      return 'text-gray-500';
                    }
                    return holding.change24h >= 0 ? 'text-green-400' : 'text-red-400';
                  })()}`}>
                    {showCurrentPrices ? (
                      `${holding.change24h >= 0 ? '+' : ''}${holding.change24h.toFixed(2)}%`
                    ) : (() => {
                      // Historical pricing - calculate change from start/end of month prices
                      if (historicalPrices.loading) {
                        return '...';
                      }
                      // ERG token - no change % for native token
                      if (!holding.tokenId || holding.token === 'ERG') {
                        return '-';
                      }
                      const changeData = historicalPrices.changes.get(holding.tokenId);
                      if (changeData) {
                        const changePercent = ((changeData.endPrice - changeData.startPrice) / changeData.startPrice) * 100;
                        return `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                      }
                      return '-';
                    })()}
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