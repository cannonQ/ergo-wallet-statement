/**
 * Historical Price Service
 *
 * Provides historical token and LP prices from static JSON files.
 * Used for valuing wallet holdings in past months.
 *
 * Data sources:
 * - /data/token_prices_lookup_v5.json - Token prices by month
 * - /data/lp_historical_prices_v5.json - LP token prices by month
 *
 * Optimization: Uses IndexedDB to cache JSON files for faster repeat visits.
 */

import { indexedDbCache } from './indexedDbCache';

// Cache TTL: 7 days for historical data (it doesn't change)
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// Types for token price data
interface TokenPriceEntry {
  price_erg: number;
  erg_usd: number;
  price_usd: number;
}

interface TokenPriceData {
  name: string;
  prices: Record<string, TokenPriceEntry>;
}

interface TokenPricesFile {
  description: string;
  source: string;
  tokens_count: number;
  price_points: number;
  tokens: Record<string, TokenPriceData>;
}

// Types for LP price data
export interface LpPriceRecord {
  month: string;
  pool_type: 'N2T' | 'T2T';
  lp_token_id: string;
  pool_name: string;
  lp_price_usd: string; // May be "REVIEW"
  pool_value_usd: string; // May be "REVIEW"
  reserve_x: string;
  reserve_y: string;
  circulating_lp: string;
  erg_usd: string;
  token_x_erg: string;
  token_y_erg: string;
  error: string;
  decimals_x: number;
  decimals_y: number;
}

// Types for block heights data
interface BlockHeightEntry {
  year: number;
  month: number;
  date: string;
  block_height: number;
  timestamp_ms: number;
  timestamp_utc: string;
}

interface BlockHeightsFile {
  metadata: {
    description: string;
    generated: string;
    total_months: number;
    date_range: { start: string; end: string };
  };
  months: BlockHeightEntry[];
}

interface LpPricesFile {
  metadata: {
    generated: string;
    total_records: number;
    n2t_records: number;
    t2t_records: number;
    valid_records: number;
    review_records: number;
    date_range: { start: string; end: string };
  };
  records: LpPriceRecord[];
}

// Result types for price lookups
export interface TokenPriceResult {
  priceErg: number | null;
  name: string;
  unavailable: boolean;
  reason?: string;
}

export interface LpPriceResult {
  priceErg: number | null;
  poolName: string;
  poolType: 'N2T' | 'T2T' | null;
  unavailable: boolean;
  reason?: string;
}

/**
 * Format a Date to the month-end date string used in JSON files (YYYY-MM-DD)
 */
export function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed

  // Get last day of month
  const lastDay = new Date(year, month + 1, 0);
  const monthStr = String(month + 1).padStart(2, '0');
  const dayStr = String(lastDay.getDate()).padStart(2, '0');

  return `${year}-${monthStr}-${dayStr}`;
}

/**
 * Check if a date is the current month
 */
export function isCurrentMonth(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
         date.getMonth() === now.getMonth();
}

class HistoricalPriceService {
  // Raw data caches (loaded once)
  private tokenPricesData: TokenPricesFile | null = null;
  private lpPricesData: LpPricesFile | null = null;
  private blockHeightsData: BlockHeightsFile | null = null;

  // Indexed caches for fast lookup (populated on demand per month)
  // Structure: monthKey -> tokenId -> price data
  private tokenPriceIndex: Map<string, Map<string, TokenPriceEntry>> = new Map();
  private lpPriceIndex: Map<string, Map<string, LpPriceRecord>> = new Map();

  // Loading state
  private tokenPricesLoading: Promise<void> | null = null;
  private lpPricesLoading: Promise<void> | null = null;
  private blockHeightsLoading: Promise<void> | null = null;

  /**
   * Load token prices JSON (lazy, only when needed)
   * Uses IndexedDB cache for faster repeat visits
   */
  private async loadTokenPrices(): Promise<void> {
    if (this.tokenPricesData) return;

    if (this.tokenPricesLoading) {
      return this.tokenPricesLoading;
    }

    this.tokenPricesLoading = (async () => {
      try {
        // Try IndexedDB cache first
        if (indexedDbCache.isSupported()) {
          const cached = await indexedDbCache.get<TokenPricesFile>('json', 'token_prices_v5');
          if (cached) {
            console.log('Loaded token prices from IndexedDB cache');
            this.tokenPricesData = cached;
            return;
          }
        }

        console.log('Loading historical token prices from network...');
        const response = await fetch('/data/token_prices_lookup_v5.json');
        if (!response.ok) {
          throw new Error(`Failed to load token prices: ${response.status}`);
        }
        this.tokenPricesData = await response.json();
        console.log(`Loaded token prices for ${this.tokenPricesData?.tokens_count} tokens`);

        // Cache in IndexedDB for future visits
        if (indexedDbCache.isSupported() && this.tokenPricesData) {
          indexedDbCache.set('json', 'token_prices_v5', this.tokenPricesData, CACHE_TTL)
            .catch(err => console.error('Failed to cache token prices:', err));
        }
      } catch (error) {
        console.error('Error loading token prices:', error);
        this.tokenPricesData = {
          description: '',
          source: '',
          tokens_count: 0,
          price_points: 0,
          tokens: {}
        };
      }
    })();

    return this.tokenPricesLoading;
  }

  /**
   * Load LP prices JSON (lazy, only when needed)
   * Uses IndexedDB cache for faster repeat visits (6.9MB file)
   */
  private async loadLpPrices(): Promise<void> {
    if (this.lpPricesData) return;

    if (this.lpPricesLoading) {
      return this.lpPricesLoading;
    }

    this.lpPricesLoading = (async () => {
      try {
        // Try IndexedDB cache first (this is a 6.9MB file!)
        if (indexedDbCache.isSupported()) {
          const cached = await indexedDbCache.get<LpPricesFile>('json', 'lp_prices_v5');
          if (cached) {
            console.log('Loaded LP prices from IndexedDB cache');
            this.lpPricesData = cached;
            return;
          }
        }

        console.log('Loading historical LP prices from network...');
        const response = await fetch('/data/lp_historical_prices_v5.json');
        if (!response.ok) {
          throw new Error(`Failed to load LP prices: ${response.status}`);
        }
        this.lpPricesData = await response.json();
        console.log(`Loaded LP prices: ${this.lpPricesData?.metadata.total_records} records`);

        // Cache in IndexedDB for future visits
        if (indexedDbCache.isSupported() && this.lpPricesData) {
          indexedDbCache.set('json', 'lp_prices_v5', this.lpPricesData, CACHE_TTL)
            .catch(err => console.error('Failed to cache LP prices:', err));
        }
      } catch (error) {
        console.error('Error loading LP prices:', error);
        this.lpPricesData = {
          metadata: {
            generated: '',
            total_records: 0,
            n2t_records: 0,
            t2t_records: 0,
            valid_records: 0,
            review_records: 0,
            date_range: { start: '', end: '' }
          },
          records: []
        };
      }
    })();

    return this.lpPricesLoading;
  }

  /**
   * Load block heights JSON (lazy, only when needed)
   */
  private async loadBlockHeights(): Promise<void> {
    if (this.blockHeightsData) return;

    if (this.blockHeightsLoading) {
      return this.blockHeightsLoading;
    }

    this.blockHeightsLoading = (async () => {
      try {
        console.log('Loading month-end block heights...');
        const response = await fetch('/data/month_end_block_heights.json');
        if (!response.ok) {
          throw new Error(`Failed to load block heights: ${response.status}`);
        }
        this.blockHeightsData = await response.json();
        console.log(`Loaded block heights for ${this.blockHeightsData?.months?.length ?? 0} months`);
      } catch (error) {
        console.error('Error loading block heights:', error);
        this.blockHeightsData = {
          metadata: {
            description: '',
            generated: '',
            total_months: 0,
            date_range: { start: '', end: '' }
          },
          months: []
        };
      }
    })();

    return this.blockHeightsLoading;
  }

  /**
   * Build index for a specific month's token prices
   */
  private buildTokenPriceIndexForMonth(monthKey: string): void {
    if (this.tokenPriceIndex.has(monthKey)) return;
    if (!this.tokenPricesData) return;

    const monthIndex = new Map<string, TokenPriceEntry>();

    for (const [tokenId, tokenData] of Object.entries(this.tokenPricesData.tokens)) {
      const priceEntry = tokenData.prices[monthKey];
      if (priceEntry) {
        monthIndex.set(tokenId, priceEntry);
      }
    }

    this.tokenPriceIndex.set(monthKey, monthIndex);
    console.log(`Indexed ${monthIndex.size} token prices for ${monthKey}`);
  }

  /**
   * Build index for a specific month's LP prices
   */
  private buildLpPriceIndexForMonth(monthKey: string): void {
    if (this.lpPriceIndex.has(monthKey)) return;
    if (!this.lpPricesData) return;

    const monthIndex = new Map<string, LpPriceRecord>();

    for (const record of this.lpPricesData.records) {
      if (record.month === monthKey) {
        monthIndex.set(record.lp_token_id, record);
      }
    }

    this.lpPriceIndex.set(monthKey, monthIndex);
    console.log(`Indexed ${monthIndex.size} LP prices for ${monthKey}`);
  }

  /**
   * Get token price in ERG for a specific month
   */
  async getTokenPrice(tokenId: string, month: Date): Promise<TokenPriceResult> {
    await this.loadTokenPrices();

    const monthKey = formatMonthKey(month);
    this.buildTokenPriceIndexForMonth(monthKey);

    const monthIndex = this.tokenPriceIndex.get(monthKey);
    if (!monthIndex) {
      return {
        priceErg: null,
        name: tokenId.slice(0, 8) + '...',
        unavailable: true,
        reason: 'Month data not available'
      };
    }

    const priceEntry = monthIndex.get(tokenId);
    const tokenData = this.tokenPricesData?.tokens[tokenId];

    if (!priceEntry) {
      return {
        priceErg: null,
        name: tokenData?.name || tokenId.slice(0, 8) + '...',
        unavailable: true,
        reason: 'Price not available for this month'
      };
    }

    return {
      priceErg: priceEntry.price_erg,
      name: tokenData?.name || tokenId.slice(0, 8) + '...',
      unavailable: false
    };
  }

  /**
   * Get LP token price in ERG for a specific month
   * Calculates: lp_price_erg = (pool_value_usd / erg_usd) / circulating_lp
   */
  async getLpPrice(lpTokenId: string, month: Date): Promise<LpPriceResult> {
    await this.loadLpPrices();

    const monthKey = formatMonthKey(month);
    this.buildLpPriceIndexForMonth(monthKey);

    const monthIndex = this.lpPriceIndex.get(monthKey);
    if (!monthIndex) {
      return {
        priceErg: null,
        poolName: lpTokenId.slice(0, 8) + '...',
        poolType: null,
        unavailable: true,
        reason: 'Month data not available'
      };
    }

    const record = monthIndex.get(lpTokenId);

    if (!record) {
      return {
        priceErg: null,
        poolName: lpTokenId.slice(0, 8) + '...',
        poolType: null,
        unavailable: true,
        reason: 'LP not found for this month'
      };
    }

    // Check for error or REVIEW status
    if (record.error || record.lp_price_usd === 'REVIEW' || record.pool_value_usd === 'REVIEW') {
      return {
        priceErg: null,
        poolName: record.pool_name,
        poolType: record.pool_type,
        unavailable: true,
        reason: record.error || 'Data under review'
      };
    }

    // Calculate LP price in ERG using reserve values and token prices
    // Formula: pool_value_erg = reserve_x_erg + reserve_y_erg
    //          lp_price_erg = pool_value_erg / circulating_lp
    const reserveX = parseFloat(record.reserve_x);
    const reserveY = parseFloat(record.reserve_y);
    const circulatingLp = parseFloat(record.circulating_lp);
    const tokenXErg = parseFloat(record.token_x_erg);
    const tokenYErg = parseFloat(record.token_y_erg);
    const decimalsX = record.decimals_x;
    const decimalsY = record.decimals_y;

    if (isNaN(reserveX) || isNaN(reserveY) || isNaN(circulatingLp) ||
        isNaN(tokenXErg) || isNaN(tokenYErg) || circulatingLp === 0) {
      return {
        priceErg: null,
        poolName: record.pool_name,
        poolType: record.pool_type,
        unavailable: true,
        reason: 'Invalid price data'
      };
    }

    let poolValueErg: number;

    if (record.pool_type === 'N2T') {
      // N2T pools: reserve_x is ERG in nanoERG (always decimals=9)
      const reserveXErg = reserveX / Math.pow(10, decimalsX); // decimals_x should be 9 for ERG
      const reserveYErg = (reserveY / Math.pow(10, decimalsY)) * tokenYErg;
      poolValueErg = reserveXErg + reserveYErg;
    } else {
      // T2T pools: both reserves are tokens
      const reserveXErg = (reserveX / Math.pow(10, decimalsX)) * tokenXErg;
      const reserveYErg = (reserveY / Math.pow(10, decimalsY)) * tokenYErg;
      poolValueErg = reserveXErg + reserveYErg;
    }

    const lpPriceErg = poolValueErg / circulatingLp;

    return {
      priceErg: lpPriceErg,
      poolName: record.pool_name,
      poolType: record.pool_type,
      unavailable: false
    };
  }

  /**
   * Get LP record details for a specific month (for additional info like pool type)
   */
  async getLpRecord(lpTokenId: string, month: Date): Promise<LpPriceRecord | null> {
    await this.loadLpPrices();

    const monthKey = formatMonthKey(month);
    this.buildLpPriceIndexForMonth(monthKey);

    const monthIndex = this.lpPriceIndex.get(monthKey);
    return monthIndex?.get(lpTokenId) || null;
  }

  /**
   * Check if a token ID is a known LP token
   */
  async isLpToken(tokenId: string): Promise<boolean> {
    await this.loadLpPrices();

    if (!this.lpPricesData) return false;

    return this.lpPricesData.records.some(r => r.lp_token_id === tokenId);
  }

  /**
   * Get all LP token IDs
   */
  async getLpTokenIds(): Promise<Set<string>> {
    await this.loadLpPrices();

    const ids = new Set<string>();
    if (this.lpPricesData) {
      for (const record of this.lpPricesData.records) {
        ids.add(record.lp_token_id);
      }
    }
    return ids;
  }

  /**
   * Get batch token prices for a month (more efficient than individual calls)
   */
  async getTokenPrices(tokenIds: string[], month: Date): Promise<Map<string, TokenPriceResult>> {
    await this.loadTokenPrices();

    const monthKey = formatMonthKey(month);
    this.buildTokenPriceIndexForMonth(monthKey);

    const results = new Map<string, TokenPriceResult>();
    const monthIndex = this.tokenPriceIndex.get(monthKey);

    for (const tokenId of tokenIds) {
      const priceEntry = monthIndex?.get(tokenId);
      const tokenData = this.tokenPricesData?.tokens[tokenId];

      if (priceEntry) {
        results.set(tokenId, {
          priceErg: priceEntry.price_erg,
          name: tokenData?.name || tokenId.slice(0, 8) + '...',
          unavailable: false
        });
      } else {
        results.set(tokenId, {
          priceErg: null,
          name: tokenData?.name || tokenId.slice(0, 8) + '...',
          unavailable: true,
          reason: 'Price not available'
        });
      }
    }

    return results;
  }

  /**
   * Get batch LP prices for a month (more efficient than individual calls)
   */
  async getLpPrices(lpTokenIds: string[], month: Date): Promise<Map<string, LpPriceResult>> {
    await this.loadLpPrices();

    const monthKey = formatMonthKey(month);
    this.buildLpPriceIndexForMonth(monthKey);

    const results = new Map<string, LpPriceResult>();
    const monthIndex = this.lpPriceIndex.get(monthKey);

    for (const lpTokenId of lpTokenIds) {
      const record = monthIndex?.get(lpTokenId);

      if (!record) {
        results.set(lpTokenId, {
          priceErg: null,
          poolName: lpTokenId.slice(0, 8) + '...',
          poolType: null,
          unavailable: true,
          reason: 'LP not found'
        });
        continue;
      }

      if (record.error || record.lp_price_usd === 'REVIEW') {
        results.set(lpTokenId, {
          priceErg: null,
          poolName: record.pool_name,
          poolType: record.pool_type,
          unavailable: true,
          reason: record.error || 'Data under review'
        });
        continue;
      }

      // Calculate LP price in ERG using reserve values and token prices
      const reserveX = parseFloat(record.reserve_x);
      const reserveY = parseFloat(record.reserve_y);
      const circulatingLp = parseFloat(record.circulating_lp);
      const tokenXErg = parseFloat(record.token_x_erg);
      const tokenYErg = parseFloat(record.token_y_erg);
      const decimalsX = record.decimals_x;
      const decimalsY = record.decimals_y;

      if (isNaN(reserveX) || isNaN(reserveY) || isNaN(circulatingLp) ||
          isNaN(tokenXErg) || isNaN(tokenYErg) || circulatingLp === 0) {
        results.set(lpTokenId, {
          priceErg: null,
          poolName: record.pool_name,
          poolType: record.pool_type,
          unavailable: true,
          reason: 'Invalid data'
        });
        continue;
      }

      let poolValueErg: number;

      if (record.pool_type === 'N2T') {
        // N2T pools: reserve_x is ERG in nanoERG
        const reserveXErg = reserveX / Math.pow(10, decimalsX);
        const reserveYErg = (reserveY / Math.pow(10, decimalsY)) * tokenYErg;
        poolValueErg = reserveXErg + reserveYErg;
      } else {
        // T2T pools: both reserves are tokens
        const reserveXErg = (reserveX / Math.pow(10, decimalsX)) * tokenXErg;
        const reserveYErg = (reserveY / Math.pow(10, decimalsY)) * tokenYErg;
        poolValueErg = reserveXErg + reserveYErg;
      }

      const lpPriceErg = poolValueErg / circulatingLp;

      results.set(lpTokenId, {
        priceErg: lpPriceErg,
        poolName: record.pool_name,
        poolType: record.pool_type,
        unavailable: false
      });
    }

    return results;
  }

  /**
   * Get available months in the data
   */
  async getAvailableMonths(): Promise<string[]> {
    await this.loadLpPrices();

    if (!this.lpPricesData) return [];

    const months = new Set<string>();
    for (const record of this.lpPricesData.records) {
      months.add(record.month);
    }

    return Array.from(months).sort();
  }

  /**
   * Get block height for end of a specific month
   * Used for querying wallet balance at historical block heights
   */
  async getBlockHeight(month: Date): Promise<number | null> {
    await this.loadBlockHeights();

    const monthKey = formatMonthKey(month);
    const entry = this.blockHeightsData?.months.find(m => m.date === monthKey);
    return entry?.block_height ?? null;
  }

  /**
   * Get full block height entry for a specific month (includes timestamp, etc.)
   */
  async getBlockHeightEntry(month: Date): Promise<BlockHeightEntry | null> {
    await this.loadBlockHeights();

    const monthKey = formatMonthKey(month);
    return this.blockHeightsData?.months.find(m => m.date === monthKey) ?? null;
  }

  /**
   * Get all available block heights as a simple date -> height map
   */
  async getBlockHeights(): Promise<Record<string, number>> {
    await this.loadBlockHeights();

    const result: Record<string, number> = {};
    for (const entry of this.blockHeightsData?.months || []) {
      result[entry.date] = entry.block_height;
    }
    return result;
  }

  /**
   * Get all block height entries with full details
   */
  async getBlockHeightEntries(): Promise<BlockHeightEntry[]> {
    await this.loadBlockHeights();
    return this.blockHeightsData?.months ?? [];
  }

  /**
   * Clear all caches (useful for testing or refreshing data)
   */
  clearCache(): void {
    this.tokenPricesData = null;
    this.lpPricesData = null;
    this.blockHeightsData = null;
    this.tokenPriceIndex.clear();
    this.lpPriceIndex.clear();
    this.tokenPricesLoading = null;
    this.lpPricesLoading = null;
    this.blockHeightsLoading = null;
  }
}

// Export singleton instance
export const historicalPrices = new HistoricalPriceService();

// Also export class for testing
export { HistoricalPriceService };
