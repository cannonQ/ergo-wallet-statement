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
    const endingBalance = categoryHoldings.reduce((sum, h) => sum + h.valueInErg, 0);
    // Simulate beginning balance by subtracting the change
    const beginningBalance = endingBalance / (1 + categoryHoldings.reduce((sum, h) => sum + h.change24h/100, 0));
    const change = endingBalance - beginningBalance;
    
    return {
      beginningBalance,
      endingBalance,
      change
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
              const changePercent = ((summary.change / summary.beginningBalance) * 100);
              
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
                    {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
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