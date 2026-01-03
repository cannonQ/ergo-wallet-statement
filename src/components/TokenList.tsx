import React from 'react';
import { Coins } from 'lucide-react';

interface Token {
  tokenId: string;
  name: string;
  amount: number;
  decimals: number;
}

interface TokenListProps {
  tokens: Token[];
  ergBalance: number;
}

export const TokenList: React.FC<TokenListProps> = ({ tokens, ergBalance }) => {
  const formatAmount = (amount: number, decimals: number) => {
    if (decimals === 0) return amount.toLocaleString();
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(decimals, 4)
    });
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
      <div className="flex items-center space-x-2 mb-4">
        <Coins className="w-5 h-5 text-blue-400" />
        <h2 className="text-xl font-bold text-white">Token Balances</h2>
      </div>

      <div className="space-y-3">
        {/* ERG Balance */}
        <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              Σ
            </div>
            <div>
              <div className="text-white font-medium">ERG</div>
              <div className="text-gray-400 text-xs">Native Token</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-white font-medium">{ergBalance.toFixed(4)}</div>
            <div className="text-gray-400 text-xs">ERG</div>
          </div>
        </div>

        {/* Other Tokens */}
        {tokens.length === 0 ? (
          <div className="text-gray-400 text-center py-4">
            No other tokens in this wallet
          </div>
        ) : (
          tokens.map((token) => (
            <div
              key={token.tokenId}
              className="flex justify-between items-center p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                  {token.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-white font-medium">{token.name}</div>
                  <div className="text-gray-400 text-xs font-mono">
                    {token.tokenId.slice(0, 8)}...{token.tokenId.slice(-4)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-medium">
                  {formatAmount(token.amount, token.decimals)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {tokens.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="text-gray-400 text-sm">
            Total: {tokens.length + 1} token{tokens.length > 0 ? 's' : ''} (including ERG)
          </div>
        </div>
      )}
    </div>
  );
};
