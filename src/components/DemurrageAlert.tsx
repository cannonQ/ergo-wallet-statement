import React from 'react';
import { AlertTriangle, Clock, ExternalLink, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface DemurrageBox {
  boxId: string;
  valueInErg: number;
  currentAge: number;
  demurrageDate: Date;
  daysUntilDemurrage: number;
}

interface DemurrageAlertProps {
  boxes: DemurrageBox[];
  isLoading?: boolean;
}

export const DemurrageAlert: React.FC<DemurrageAlertProps> = ({ boxes, isLoading = false }) => {
  const openExplorer = (boxId: string) => {
    window.open(`https://explorer.ergoplatform.com/en/boxes/${boxId}`, '_blank');
  };

  const getUrgencyColor = (daysUntil: number) => {
    if (daysUntil < 30) return 'text-red-400 bg-red-500/20';
    if (daysUntil < 90) return 'text-orange-400 bg-orange-500/20';
    return 'text-yellow-400 bg-yellow-500/20';
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900 p-4 rounded-lg shadow-lg h-full">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-bold text-white">Storage Rent Status</h2>
        </div>
        <div className="text-gray-400 text-center py-4">
          Checking boxes for demurrage...
        </div>
      </div>
    );
  }

  if (boxes.length === 0) {
    return (
      <div className="bg-gray-900 p-4 rounded-lg shadow-lg h-full">
        <div className="flex items-center space-x-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-bold text-white">Storage Rent Status</h2>
        </div>
        <div className="text-gray-400 text-sm">
          <p>No boxes at risk of storage rent in the next year.</p>
          <p className="mt-2">Ergo charges storage rent on boxes older than 4 years.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-900/30 border border-yellow-700/50 p-6 rounded-lg shadow-lg">
      <div className="flex items-center space-x-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-yellow-400" />
        <h2 className="text-xl font-bold text-white">Storage Rent Alerts</h2>
        <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded">
          {boxes.length} box{boxes.length !== 1 ? 'es' : ''}
        </span>
      </div>

      <p className="text-gray-300 text-sm mb-4">
        The following boxes will be subject to storage rent fees:
      </p>

      <div className="space-y-2">
        {boxes.map((box) => (
          <div
            key={box.boxId}
            className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
            onClick={() => openExplorer(box.boxId)}
          >
            <div className="flex items-center space-x-3">
              <div className={`px-2 py-1 rounded text-xs font-medium ${getUrgencyColor(box.daysUntilDemurrage)}`}>
                {box.daysUntilDemurrage}d
              </div>
              <div>
                <div className="text-white font-mono text-sm">
                  {box.boxId.slice(0, 12)}...{box.boxId.slice(-6)}
                </div>
                <div className="text-gray-400 text-xs">
                  Due: {format(box.demurrageDate, 'MMM d, yyyy')}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-white font-medium">
                  {box.valueInErg.toFixed(4)} ERG
                </div>
                <div className="text-gray-400 text-xs">
                  {box.currentAge.toLocaleString()} blocks old
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-yellow-700/30 text-gray-400 text-xs">
        <p>To avoid storage rent, consolidate or spend these boxes before their due date.</p>
      </div>
    </div>
  );
};
