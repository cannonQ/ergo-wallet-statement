import React from 'react';
import type { DetailedHolding } from '../types';

interface DetailedHoldingsProps {
  category: string;
  holdings: DetailedHolding[];
}

export const DetailedHoldings: React.FC<DetailedHoldingsProps> = ({ category, holdings }) => {
  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-lg mt-6">
      <h2 className="text-xl font-bold text-white mb-6">{category}</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800">
              <th className="pb-4 text-left">Token</th>
              <th className="pb-4 text-right">Beginning Balance</th>
              <th className="pb-4 text-right">Additions</th>
              <th className="pb-4 text-right">Reductions</th>
              <th className="pb-4 text-right">Ending Balance</th>
              <th className="pb-4 text-right">Value (ERG)</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => (
              <tr key={holding.token} className="border-b border-gray-800">
                <td className="py-4 text-white">{holding.token}</td>
                <td className="py-4 text-right text-white">{holding.beginningBalance.toLocaleString()}</td>
                <td className="py-4 text-right text-green-400">+{holding.additions.toLocaleString()}</td>
                <td className="py-4 text-right text-red-400">-{holding.reductions.toLocaleString()}</td>
                <td className="py-4 text-right text-white">{holding.endingBalance.toLocaleString()}</td>
                <td className="py-4 text-right text-white">{holding.valueInErg.toLocaleString()} ERG</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};