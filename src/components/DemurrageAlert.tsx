import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { DemurrageBox } from '../types';

interface DemurrageAlertProps {
  boxes: DemurrageBox[];
}

export const DemurrageAlert: React.FC<DemurrageAlertProps> = ({ boxes }) => {
  return (
    <div className="bg-yellow-900/80 p-6 rounded-lg shadow-lg h-full">
      <div className="flex items-center mb-4">
        <AlertTriangle className="text-yellow-400 mr-2" size={24} />
        <div>
          <h2 className="text-xl font-bold text-white">Demurrage Alert</h2>
          <p className="text-gray-300">Boxes subject to storage rent in next 6 months:</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-gray-300 border-b border-yellow-800">
              <th className="pb-4 text-left">Box ID</th>
              <th className="pb-4 text-right">Current Age</th>
              <th className="pb-4 text-right">Demurrage Date</th>
              <th className="pb-4 text-right">Value (ERG)</th>
            </tr>
          </thead>
          <tbody>
            {boxes.map((box) => (
              <tr key={box.boxId} className="border-b border-yellow-800">
                <td className="py-4 text-white font-mono">{box.boxId}</td>
                <td className="py-4 text-right text-white">{box.currentAge.toLocaleString()} blocks</td>
                <td className="py-4 text-right text-white">
                  {box.demurrageDate.toLocaleDateString()}
                </td>
                <td className="py-4 text-right text-white">{box.valueInErg.toLocaleString()} ERG</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};