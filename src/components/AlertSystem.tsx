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
    <div className="fixed bottom-2 sm:bottom-4 right-2 sm:right-4 w-[calc(100vw-1rem)] sm:w-96 max-w-md z-50">
      <div className="flex justify-end mb-2">
        <button
          onClick={onToggleNotifications}
          className="bg-gray-800 p-1.5 sm:p-2 rounded-full hover:bg-gray-700 transition-colors shadow-lg"
          title={notificationsEnabled ? "Mute notifications" : "Enable notifications"}
        >
          {notificationsEnabled ? (
            <Bell className="text-white" size={18} />
          ) : (
            <BellOff className="text-gray-400" size={18} />
          )}
        </button>
      </div>
      {notificationsEnabled && alerts.map((alert) => (
        <div
          key={alert.id}
          className={`mb-2 p-3 sm:p-4 rounded-lg shadow-lg flex items-start justify-between ${
            alert.type === 'error' ? 'bg-red-900/80' :
            alert.type === 'warning' ? 'bg-yellow-900/80' :
            'bg-blue-900/80'
          }`}
        >
          <div className="flex items-start">
            <AlertTriangle className="mr-2 sm:mr-3 mt-1 flex-shrink-0" size={18} />
            <div className="min-w-0">
              <p className="text-white text-sm sm:text-base">{alert.message}</p>
              {alert.expiresAt && (
                <p className="text-xs sm:text-sm text-gray-300 mt-1">
                  Expires in: {Math.ceil((alert.expiresAt.getTime() - Date.now()) / 1000)}s
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => onDismiss(alert.id)}
            className="text-gray-300 hover:text-white transition-colors flex-shrink-0 ml-2"
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
};