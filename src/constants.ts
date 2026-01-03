// Category colors - consistent across all displays
// ERG = Red, Stables = Green, Tokens = Blue, LP = Purple
export const CATEGORY_COLORS = {
  ERG: {
    primary: '#ef4444',      // red-500
    bg: 'rgba(239, 68, 68, 0.6)',
    bgFaded: 'rgba(239, 68, 68, 0.2)',
    border: '#dc2626',       // red-600
    text: 'text-red-400',
    bgClass: 'bg-red-500',
    bgFadedClass: 'bg-red-500/20',
  },
  Stables: {
    primary: '#22c55e',      // green-500
    bg: 'rgba(34, 197, 94, 0.6)',
    bgFaded: 'rgba(34, 197, 94, 0.2)',
    border: '#16a34a',       // green-600
    text: 'text-green-400',
    bgClass: 'bg-green-500',
    bgFadedClass: 'bg-green-500/20',
  },
  Tokens: {
    primary: '#3b82f6',      // blue-500
    bg: 'rgba(59, 130, 246, 0.6)',
    bgFaded: 'rgba(59, 130, 246, 0.2)',
    border: '#2563eb',       // blue-600
    text: 'text-blue-400',
    bgClass: 'bg-blue-500',
    bgFadedClass: 'bg-blue-500/20',
  },
  'Liquidity/Lending': {
    primary: '#a855f7',      // purple-500
    bg: 'rgba(168, 85, 247, 0.6)',
    bgFaded: 'rgba(168, 85, 247, 0.2)',
    border: '#9333ea',       // purple-600
    text: 'text-purple-400',
    bgClass: 'bg-purple-500',
    bgFadedClass: 'bg-purple-500/20',
  },
} as const;

// Get color config by category name
export function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.Tokens;
}

// Format number with commas and decimal places
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Format ERG value (with ERG suffix)
export function formatErg(value: number, decimals: number = 2): string {
  return `${formatNumber(value, decimals)} ERG`;
}
