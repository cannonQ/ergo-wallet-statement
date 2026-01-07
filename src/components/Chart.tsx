import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Loader2 } from 'lucide-react';
import { CATEGORY_COLORS, formatNumber } from '../constants';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

interface ChartProps {
  data: {
    labels: string[];
    erg: number[];
    stables: number[];
    liquidity: number[];
    tokens: number[];
  };
  range: 3 | 6 | 12;
  onRangeChange: (range: 3 | 6 | 12) => void;
  isLoading?: boolean;
}

export const Chart: React.FC<ChartProps> = ({ data, range, onRangeChange, isLoading }) => {
  const ranges: Array<3 | 6 | 12> = [3, 6, 12];

  const chartData = {
    labels: data.labels,
    datasets: [
      {
        fill: true,
        label: 'ERG',
        data: data.erg,
        borderColor: CATEGORY_COLORS.ERG.border,
        backgroundColor: CATEGORY_COLORS.ERG.bg,
        stack: 'stack0',
      },
      {
        fill: true,
        label: 'Stables',
        data: data.stables,
        borderColor: CATEGORY_COLORS.Stables.border,
        backgroundColor: CATEGORY_COLORS.Stables.bg,
        stack: 'stack0',
      },
      {
        fill: true,
        label: 'LP Tokens',
        data: data.liquidity,
        borderColor: CATEGORY_COLORS['Liquidity/Lending'].border,
        backgroundColor: CATEGORY_COLORS['Liquidity/Lending'].bg,
        stack: 'stack0',
      },
      {
        fill: true,
        label: 'Tokens',
        data: data.tokens,
        borderColor: CATEGORY_COLORS.Tokens.border,
        backgroundColor: CATEGORY_COLORS.Tokens.bg,
        stack: 'stack0',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'white',
          usePointStyle: true,
          padding: 15,
        },
      },
      title: {
        display: true,
        text: 'Wallet History (Total Value in ERG)',
        color: 'white',
        font: {
          size: 16,
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${formatNumber(value)} ERG`;
          },
          footer: (tooltipItems: any[]) => {
            const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0);
            return `Total: ${formatNumber(total)} ERG`;
          },
        },
      },
    },
    scales: {
      y: {
        stacked: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'white',
          callback: (value: any) => `${formatNumber(value, 0)} ERG`,
        },
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'white',
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  return (
    <div className="bg-gray-900 p-4 md:p-6 rounded-lg shadow-lg h-[250px] sm:h-[300px] flex flex-col">
      {/* Range selector */}
      <div className="flex justify-end gap-1.5 mb-2">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            disabled={isLoading}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded transition-colors min-h-[36px] min-w-[44px] ${
              range === r
                ? 'bg-orange-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-600'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {r}m
          </button>
        ))}
        {isLoading && (
          <Loader2 size={14} className="animate-spin text-gray-400 ml-2 self-center" />
        )}
      </div>
      {/* Chart */}
      <div className="flex-1 min-h-0">
        <Line options={options} data={chartData} />
      </div>
    </div>
  );
};
