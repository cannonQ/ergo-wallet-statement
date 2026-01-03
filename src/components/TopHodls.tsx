import React from 'react';
import { TrendingUp } from 'lucide-react';
import type { Holding } from '../types';
import { getCategoryColor, formatNumber } from '../constants';

interface TopHodlsProps {
  holdings: Holding[];
}

export const TopHodls: React.FC<TopHodlsProps> = ({ holdings }) => {
  // Calculate total portfolio value
  const totalValue = holdings.reduce((sum, h) => sum + h.valueInErg, 0);

  // Get top 5 holdings by ERG value (exclude NFTs - amount === 1 in Tokens category)
  const topHoldings = holdings
    .filter(h => !(h.category === 'Tokens' && h.amount === 1))
    .sort((a, b) => b.valueInErg - a.valueInErg)
    .slice(0, 5);

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow-lg h-full">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-bold text-white">Top 5 Hodl</h2>
      </div>

      <div className="space-y-3">
        {topHoldings.map((holding, index) => {
          const colorConfig = getCategoryColor(holding.category);
          const portfolioPercent = totalValue > 0
            ? (holding.valueInErg / totalValue) * 100
            : 0;

          return (
            <div
              key={holding.tokenId || holding.token}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-gray-500 text-sm w-4">{index + 1}.</span>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colorConfig.primary }}
                />
                <span className="text-white text-sm truncate" title={holding.token}>
                  {holding.token.length > 12 ? holding.token.slice(0, 12) + '...' : holding.token}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-gray-400 text-sm tabular-nums">
                  {formatNumber(holding.valueInErg)} ERG
                </span>
                <span
                  className="text-sm tabular-nums w-14 text-right"
                  style={{ color: colorConfig.primary }}
                >
                  {formatNumber(portfolioPercent, 1)}%
                </span>
              </div>
            </div>
          );
        })}

        {topHoldings.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            No holdings found
          </div>
        )}
      </div>

      {/* Total */}
      <div className="mt-4 pt-3 border-t border-gray-800 flex justify-between">
        <span className="text-gray-400 text-sm">Total Portfolio</span>
        <span className="text-white text-sm font-medium tabular-nums">
          {formatNumber(totalValue)} ERG
        </span>
      </div>
    </div>
  );
};
