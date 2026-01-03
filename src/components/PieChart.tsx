import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { CATEGORY_COLORS, formatNumber } from '../constants';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

interface PieChartProps {
  data: {
    labels: string[];
    values: number[];
  };
}

// Map pie chart labels to category keys
const labelToCategoryKey: Record<string, keyof typeof CATEGORY_COLORS> = {
  'ERG': 'ERG',
  'Stables': 'Stables',
  'Tokens': 'Tokens',
  'LP Tokens': 'Liquidity/Lending',
};

export const PieChart: React.FC<PieChartProps> = ({ data }) => {
  // Map labels to consistent colors
  const backgroundColors = data.labels.map(label => {
    const categoryKey = labelToCategoryKey[label] || 'Tokens';
    return CATEGORY_COLORS[categoryKey].bg;
  });

  const borderColors = data.labels.map(label => {
    const categoryKey = labelToCategoryKey[label] || 'Tokens';
    return CATEGORY_COLORS[categoryKey].border;
  });

  const chartData = {
    labels: data.labels,
    datasets: [
      {
        data: data.values,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
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
        },
      },
      title: {
        display: true,
        text: 'Wallet Distribution',
        color: 'white',
        font: {
          size: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${formatNumber(value)} ERG (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-lg h-[300px]">
      <Pie options={options} data={chartData} />
    </div>
  );
};