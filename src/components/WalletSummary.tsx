import React from 'react';
import type { Holding } from '../types';
import { getCategoryColor, formatNumber } from '../constants';

interface CategorySummary {
  beginningBalance: number;
  endingBalance: number;
  change: number;
  additions: number;
  reductions: number;
}

interface WalletSummaryProps {
  holdings: Holding[];
}

export const WalletSummary: React.FC<WalletSummaryProps> = ({ holdings }) => {
  const categories = ['ERG', 'Stables', 'Liquidity/Lending', 'Tokens'];

  const getCategorySummary = (category: string): CategorySummary => {
    const categoryHoldings = holdings.filter(h => h.category === category);

    // For ERG, use the ERG amounts directly
    // For other categories, use valueInErg for ending balance
    if (category === 'ERG') {
      // ERG amounts are already in ERG, so beginningBalance, additions, reductions are all in ERG
      const beginningBalance = categoryHoldings.reduce((sum, h) => sum + h.beginningBalance, 0);
      const additions = categoryHoldings.reduce((sum, h) => sum + h.additions, 0);
      const reductions = categoryHoldings.reduce((sum, h) => sum + h.reductions, 0);
      const endingBalance = categoryHoldings.reduce((sum, h) => sum + h.endingBalance, 0);
      const change = additions - reductions;

      return {
        beginningBalance: isNaN(beginningBalance) ? 0 : beginningBalance,
        endingBalance: isNaN(endingBalance) ? 0 : endingBalance,
        change: isNaN(change) ? 0 : change,
        additions: isNaN(additions) ? 0 : additions,
        reductions: isNaN(reductions) ? 0 : reductions,
      };
    }

    // For tokens, stables, and LP - show ending value in ERG
    // Change is calculated from net token movements (can't get historical ERG price)
    const endingBalance = categoryHoldings.reduce((sum, h) => sum + h.valueInErg, 0);
    // Estimate beginning balance using current prices (approximation)
    const totalAdditions = categoryHoldings.reduce((sum, h) => sum + h.additions, 0);
    const totalReductions = categoryHoldings.reduce((sum, h) => sum + h.reductions, 0);
    const totalEnding = categoryHoldings.reduce((sum, h) => sum + h.endingBalance, 0);

    // Calculate approximate ERG value of changes using current token prices
    // Change in tokens * current price per token = change in ERG
    let changeInErg = 0;
    for (const h of categoryHoldings) {
      const pricePerToken = h.endingBalance > 0 ? h.valueInErg / h.endingBalance : 0;
      const netChange = h.additions - h.reductions;
      changeInErg += netChange * pricePerToken;
    }

    // Beginning balance = ending balance - change
    const beginningBalance = endingBalance - changeInErg;

    return {
      beginningBalance: isNaN(beginningBalance) ? 0 : Math.max(0, beginningBalance),
      endingBalance: isNaN(endingBalance) ? 0 : endingBalance,
      change: isNaN(changeInErg) ? 0 : changeInErg,
      additions: totalAdditions,
      reductions: totalReductions,
    };
  };

  return (
    <div className="bg-gray-900 p-4 md:p-6 rounded-lg shadow-lg h-full">
      <h2 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6">Wallet Summary</h2>
      <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-xs sm:text-sm">
              <th className="pb-3 md:pb-4 text-left">Category</th>
              <th className="pb-3 md:pb-4 text-right">Beginning</th>
              <th className="pb-3 md:pb-4 text-right">Change</th>
              <th className="pb-3 md:pb-4 text-right">Change %</th>
              <th className="pb-3 md:pb-4 text-right">Ending</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const summary = getCategorySummary(category);
              const changePercent = summary.beginningBalance > 0
                ? ((summary.change / summary.beginningBalance) * 100)
                : 0;
              const colorConfig = getCategoryColor(category);

              return (
                <tr key={category} className="border-b border-gray-800">
                  <td className="py-3 md:py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 sm:w-3 h-2 sm:h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: colorConfig.primary }}
                      />
                      <span className="text-white text-xs sm:text-sm">{category}</span>
                    </div>
                  </td>
                  <td className="py-3 md:py-4 text-right text-white tabular-nums text-xs sm:text-sm">
                    {formatNumber(summary.beginningBalance)}
                  </td>
                  <td className={`py-3 md:py-4 text-right tabular-nums text-xs sm:text-sm ${
                    summary.change === 0 ? 'text-gray-400' : summary.change > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {summary.change > 0 ? '+' : ''}{formatNumber(summary.change)}
                  </td>
                  <td className={`py-3 md:py-4 text-right tabular-nums text-xs sm:text-sm ${
                    changePercent === 0 ? 'text-gray-400' : changePercent > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {changePercent > 0 ? '+' : ''}{isFinite(changePercent) ? changePercent.toFixed(2) : '0.00'}%
                  </td>
                  <td className="py-3 md:py-4 text-right text-white tabular-nums text-xs sm:text-sm">
                    {formatNumber(summary.endingBalance)}
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