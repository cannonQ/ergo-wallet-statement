import React from 'react';
import { ExternalLink, Github } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { SystemInfo } from '../types';

interface FooterProps {
  systemInfo: SystemInfo | null;
}

export function Footer({ systemInfo }: FooterProps) {
  return (
    <footer className="hidden md:block mt-8 py-6 border-t border-gray-700 text-gray-400">
      <div className="px-4 md:px-6">
        {/* System Information Row */}
        {systemInfo && (
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs mb-4">
            {/* Current Block */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Block:</span>
              {systemInfo.currentBlockHash ? (
                <a
                  href={`https://ergexplorer.com/blocks#${systemInfo.currentBlockHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                >
                  <span>{systemInfo.currentBlockHeight.toLocaleString()}</span>
                  <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-white">{systemInfo.currentBlockHeight.toLocaleString()}</span>
              )}
            </div>

            <span className="text-gray-600">•</span>

            {/* Last Fetched */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Updated:</span>
              <span className="text-white" title={format(systemInfo.lastFetchTimestamp, 'MMM d, yyyy h:mm a')}>
                {formatDistanceToNow(systemInfo.lastFetchTimestamp, { addSuffix: true })}
              </span>
            </div>

            <span className="text-gray-600">•</span>

            {/* Historical Data */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Data:</span>
              <span className="text-white" title="Month-end pricing coverage">
                Up to {format(new Date(systemInfo.latestHistoricalMonth), "MMM ''yy")}
              </span>
            </div>

            <span className="text-gray-600">•</span>

            {/* API Endpoint */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">API:</span>
              <a
                href="https://api.ergoplatform.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
              >
                <span>{systemInfo.apiEndpoint}</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}

        {/* Credits and GitHub Link */}
        <div className="flex items-center justify-center gap-2 text-xs">
          <span>Made with ❤️ for the Ergo community</span>
          <span className="text-gray-600">•</span>
          <a
            href="https://github.com/cannonQ/ergo-wallet-statement"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
          >
            <Github size={14} />
            <span>View on GitHub</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
