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
}

export const Chart: React.FC<ChartProps> = ({ data }) => {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        fill: true,
        label: 'ERG',
        data: data.erg,
        borderColor: 'rgb(234, 179, 8)',
        backgroundColor: 'rgba(234, 179, 8, 0.6)',
        stack: 'stack0',
      },
      {
        fill: true,
        label: 'Stables',
        data: data.stables,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        stack: 'stack0',
      },
      {
        fill: true,
        label: 'LP Tokens',
        data: data.liquidity,
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.6)',
        stack: 'stack0',
      },
      {
        fill: true,
        label: 'Tokens',
        data: data.tokens,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
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
          footer: (tooltipItems: any[]) => {
            const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0);
            return `Total: ${total.toFixed(2)} ERG`;
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
          callback: (value: any) => `${value} ERG`,
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
    <div className="bg-gray-900 p-6 rounded-lg shadow-lg h-[300px]">
      <Line options={options} data={chartData} />
    </div>
  );
};
