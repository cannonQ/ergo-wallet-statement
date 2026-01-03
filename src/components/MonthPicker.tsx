import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface MonthPickerProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
}

export const MonthPicker: React.FC<MonthPickerProps> = ({ selectedDate, onChange }) => {
  const goToPreviousMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    // Don't allow future months
    if (newDate <= new Date()) {
      onChange(newDate);
    }
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return (
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getFullYear() === now.getFullYear()
    );
  };

  // Get start and end of month for display
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

  return (
    <div className="flex items-center space-x-3 bg-gray-800 rounded-lg p-2">
      <Calendar className="w-5 h-5 text-gray-400" />
      <button
        onClick={goToPreviousMonth}
        className="p-1 hover:bg-gray-700 rounded transition-colors"
        title="Previous month"
      >
        <ChevronLeft className="w-5 h-5 text-gray-400" />
      </button>

      <div className="text-center min-w-[180px]">
        <div className="text-white font-semibold">
          {format(selectedDate, 'MMMM yyyy')}
        </div>
        <div className="text-gray-400 text-xs">
          {format(monthStart, 'MMM d')} - {format(monthEnd, 'MMM d, yyyy')}
        </div>
      </div>

      <button
        onClick={goToNextMonth}
        disabled={isCurrentMonth()}
        className={`p-1 rounded transition-colors ${
          isCurrentMonth()
            ? 'text-gray-600 cursor-not-allowed'
            : 'hover:bg-gray-700 text-gray-400'
        }`}
        title={isCurrentMonth() ? 'Cannot view future months' : 'Next month'}
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};
