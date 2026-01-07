import React from 'react';
import { AlertTriangle, Clock, CheckCircle, Flame } from 'lucide-react';

interface DemurrageBox {
  boxId: string;
  valueInErg: number;
  currentAge: number;
  demurrageDate: Date;
  daysUntilDemurrage: number;
}

interface WalletMaintenanceProps {
  boxes: DemurrageBox[];
  hasBlacklistedTokens: boolean;
  isLoading?: boolean;
}

export const WalletMaintenance: React.FC<WalletMaintenanceProps> = ({
  boxes,
  hasBlacklistedTokens,
  isLoading = false
}) => {
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
      <div className="bg-gray-900 p-4 rounded-lg shadow-lg h-full flex flex-col">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-bold text-white">Wallet Maintenance</h2>
        </div>
        <div className="text-gray-400 text-center py-4 flex-1">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow-lg h-full flex flex-col">
      <div className="flex items-center space-x-2 mb-4">
        <Clock className="w-5 h-5 text-yellow-400" />
        <h2 className="text-lg font-bold text-white">Wallet Maintenance</h2>
      </div>

      {/* Storage Rent Status - Top 50% */}
      <div className="flex-1 min-h-0 mb-4 pb-4 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold text-gray-300">Storage Rent Status</h3>
        </div>
        {boxes.length === 0 ? (
          <div className="text-gray-400 text-xs">
            <p className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              No boxes at risk of storage rent in the next year.
            </p>
            <p className="mt-2">Ergo charges storage rent on boxes older than 4 years.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[120px] overflow-y-auto">
            {boxes.slice(0, 3).map((box) => (
              <div
                key={box.boxId}
                className="flex items-center justify-between p-2 bg-gray-800/50 rounded hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => openExplorer(box.boxId)}
              >
                <div className="flex items-center space-x-2">
                  <div className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getUrgencyColor(box.daysUntilDemurrage)}`}>
                    {box.daysUntilDemurrage}d
                  </div>
                  <div className="text-white font-mono text-xs">
                    {box.boxId.slice(0, 8)}...
                  </div>
                </div>
                <div className="text-white text-xs font-medium">
                  {box.valueInErg.toFixed(2)} ERG
                </div>
              </div>
            ))}
            {boxes.length > 3 && (
              <p className="text-gray-500 text-[10px] text-center">
                +{boxes.length - 3} more box{boxes.length - 3 !== 1 ? 'es' : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Burn Tokens - Bottom 50% */}
      <div className="flex-1 min-h-0">
        <div className="flex items-center gap-2 mb-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-gray-300">Burn Tokens</h3>
        </div>
        <div className="text-gray-400 text-xs space-y-2">
          {hasBlacklistedTokens ? (
            <>
              <p className="text-yellow-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  You have tokens that were filtered by ErgExplorer{' '}
                  <a
                    href="https://github.com/sigmanauts/token-id-blacklist/tree/main"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    NSFW / Scam filter
                  </a>
                  .
                </span>
              </p>
              <p>
                BURN your tokens using{' '}
                <a
                  href="https://tools.mewfinance.com/burn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  simple tool
                </a>
              </p>
            </>
          ) : (
            <p className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              Your wallet doesn't appear to have any NSFW or SCAM tokens
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
