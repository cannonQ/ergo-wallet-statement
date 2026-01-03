import React from 'react';
import type { Holding } from '../types';

interface CategorySummary {
  beginningBalance: number;
  endingBalance: number;
  change: number;
}

interface WalletSummaryProps {
  holdings: Holding[];
}

export const WalletSummary: React.FC<WalletSummaryProps> = ({ holdings }) => {
  const categories = ['ERG', 'Stables', 'Liquidity/Lending', 'Tokens'];
  
  const getCategorySummary = (category: string): CategorySummary => {
    const categoryHoldings = holdings.filter(h => h.category === category);
    // Use valueInErg for ERG equivalent values consistently
    const endingBalance = categoryHoldings.reduce((sum, h) => sum + h.valueInErg, 0);
    // Beginning balance should also be ERG equivalent (currently same as ending without historical data)
    const beginningBalance = endingBalance;
    const change = endingBalance - beginningBalance;

    return {
      beginningBalance: isNaN(beginningBalance) ? 0 : beginningBalance,
      endingBalance: isNaN(endingBalance) ? 0 : endingBalance,
      change: isNaN(change) ? 0 : change
    };
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-lg h-full">
      <h2 className="text-xl font-bold text-white mb-6">Wallet Summary</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800">
              <th className="pb-4 text-left">Category</th>
              <th className="pb-4 text-right">Beginning (ERG)</th>
              <th className="pb-4 text-right">Change (ERG)</th>
              <th className="pb-4 text-right">Change (%)</th>
              <th className="pb-4 text-right">Ending (ERG)</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const summary = getCategorySummary(category);
              const changePercent = summary.beginningBalance > 0
                ? ((summary.change / summary.beginningBalance) * 100)
                : 0;

              return (
                <tr key={category} className="border-b border-gray-800">
                  <td className="py-4 text-white">{category}</td>
                  <td className="py-4 text-right text-white">
                    {summary.beginningBalance.toFixed(2)}
                  </td>
                  <td className={`py-4 text-right ${summary.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {summary.change >= 0 ? '+' : ''}{summary.change.toFixed(2)}
                  </td>
                  <td className={`py-4 text-right ${changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {changePercent >= 0 ? '+' : ''}{isFinite(changePercent) ? changePercent.toFixed(2) : '0.00'}%
                  </td>
                  <td className="py-4 text-right text-white">
                    {summary.endingBalance.toFixed(2)}
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