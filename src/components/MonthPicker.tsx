import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface MonthPickerProps {
  selectedMonth: Date;
  onChange: (date: Date) => void;
}

export const MonthPicker: React.FC<MonthPickerProps> = ({ selectedMonth, onChange }) => {
  const goToPreviousMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    // Don't allow future months
    if (newDate <= new Date()) {
      onChange(newDate);
    }
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return (
      selectedMonth.getMonth() === now.getMonth() &&
      selectedMonth.getFullYear() === now.getFullYear()
    );
  };

  // Get start and end of month for display
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);

  return (
    <div className="flex items-center gap-2 sm:gap-3 bg-gray-800 rounded-lg p-2 w-full sm:w-auto">
      <Calendar className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400 flex-shrink-0" />
      <button
        onClick={goToPreviousMonth}
        className="p-1.5 hover:bg-gray-700 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center sm:min-w-0 sm:min-h-0 sm:p-1"
        title="Previous month"
      >
        <ChevronLeft className="w-5 h-5 text-gray-400" />
      </button>

      <div className="text-center flex-1 sm:min-w-[140px]">
        <div className="text-white font-semibold text-sm sm:text-base">
          {format(selectedMonth, 'MMMM yyyy')}
        </div>
        <div className="text-gray-400 text-xs hidden sm:block">
          {format(monthStart, 'MMM d')} - {format(monthEnd, 'MMM d, yyyy')}
        </div>
      </div>

      <button
        onClick={goToNextMonth}
        disabled={isCurrentMonth()}
        className={`p-1.5 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center sm:min-w-0 sm:min-h-0 sm:p-1 ${
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
