import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, startOfWeek, addDays } from 'date-fns';

interface Transaction {
  id: string;
  timestamp: Date;
  type: 'incoming' | 'outgoing';
  amount: number;
}

interface TransactionHeatmapProps {
  transactions: Transaction[];
  selectedMonth: Date;
}

export const TransactionHeatmap: React.FC<TransactionHeatmapProps> = ({
  transactions,
  selectedMonth,
}) => {
  // Group transactions by date
  const transactionsByDate = useMemo(() => {
    const map = new Map<string, { count: number; incoming: number; outgoing: number }>();

    for (const tx of transactions) {
      const dateKey = format(tx.timestamp, 'yyyy-MM-dd');
      const existing = map.get(dateKey) || { count: 0, incoming: 0, outgoing: 0 };
      existing.count++;
      if (tx.type === 'incoming') {
        existing.incoming += tx.amount;
      } else {
        existing.outgoing += tx.amount;
      }
      map.set(dateKey, existing);
    }

    return map;
  }, [transactions]);

  // Generate calendar data for the month
  const calendarData = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    const days = eachDayOfInterval({ start, end });

    // Get the day of week for the first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = getDay(start);

    // Create weeks array
    const weeks: (Date | null)[][] = [];
    let currentWeek: (Date | null)[] = [];

    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }

    for (const day of days) {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    }

    // Fill remaining days of the last week
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);

    return weeks;
  }, [selectedMonth]);

  // Get color intensity based on transaction count
  const getColorClass = (count: number): string => {
    if (count === 0) return 'bg-gray-800';
    if (count === 1) return 'bg-green-900';
    if (count === 2) return 'bg-green-700';
    if (count <= 4) return 'bg-green-500';
    return 'bg-green-400';
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthYear = format(selectedMonth, 'MMMM yyyy');

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Transaction Activity</h2>
        <span className="text-gray-400 text-sm">{monthYear}</span>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayLabels.map((day) => (
          <div key={day} className="text-center text-gray-500 text-xs py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-1">
        {calendarData.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((day, dayIndex) => {
              if (!day) {
                return <div key={dayIndex} className="aspect-square" />;
              }

              const dateKey = format(day, 'yyyy-MM-dd');
              const data = transactionsByDate.get(dateKey) || { count: 0, incoming: 0, outgoing: 0 };
              const dayNum = format(day, 'd');

              return (
                <div
                  key={dayIndex}
                  className={`aspect-square rounded flex items-center justify-center text-xs relative group cursor-default ${getColorClass(data.count)}`}
                  title={data.count > 0 ? `${data.count} tx on ${format(day, 'MMM d')}\nIn: +${data.incoming.toFixed(2)} ERG\nOut: -${data.outgoing.toFixed(2)} ERG` : `${format(day, 'MMM d')}: No transactions`}
                >
                  <span className={`${data.count > 0 ? 'text-white' : 'text-gray-500'}`}>
                    {dayNum}
                  </span>
                  {data.count > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full text-[10px] text-white flex items-center justify-center">
                      {data.count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end mt-3 space-x-2">
        <span className="text-gray-500 text-xs">Less</span>
        <div className="w-3 h-3 rounded bg-gray-800" />
        <div className="w-3 h-3 rounded bg-green-900" />
        <div className="w-3 h-3 rounded bg-green-700" />
        <div className="w-3 h-3 rounded bg-green-500" />
        <div className="w-3 h-3 rounded bg-green-400" />
        <span className="text-gray-500 text-xs">More</span>
      </div>
    </div>
  );
};
