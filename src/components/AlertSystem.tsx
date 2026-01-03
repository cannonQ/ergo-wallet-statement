import React from 'react';
import { AlertTriangle, X, Bell, BellOff } from 'lucide-react';
import type { Alert } from '../types';

interface AlertSystemProps {
  alerts: Alert[];
  onDismiss: (id: string) => void;
  onToggleNotifications: () => void;
  notificationsEnabled: boolean;
}

export const AlertSystem: React.FC<AlertSystemProps> = ({
  alerts,
  onDismiss,
  onToggleNotifications,
  notificationsEnabled,
}) => {
  return (
    <div className="fixed bottom-4 right-4 w-96">
      <div className="flex justify-end mb-2">
        <button
          onClick={onToggleNotifications}
          className="bg-gray-800 p-2 rounded-full hover:bg-gray-700 transition-colors"
        >
          {notificationsEnabled ? (
            <Bell className="text-white" size={20} />
          ) : (
            <BellOff className="text-gray-400" size={20} />
          )}
        </button>
      </div>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`mb-2 p-4 rounded-lg shadow-lg flex items-start justify-between ${
            alert.type === 'error' ? 'bg-red-900/80' :
            alert.type === 'warning' ? 'bg-yellow-900/80' :
            'bg-blue-900/80'
          }`}
        >
          <div className="flex items-start">
            <AlertTriangle className="mr-3 mt-1" size={20} />
            <div>
              <p className="text-white">{alert.message}</p>
              {alert.expiresAt && (
                <p className="text-sm text-gray-300 mt-1">
                  Expires in: {Math.ceil((alert.expiresAt.getTime() - Date.now()) / 1000)}s
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => onDismiss(alert.id)}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      ))}
    </div>
  );
};