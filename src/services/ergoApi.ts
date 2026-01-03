// Ergo Explorer API Service
// API Documentation: https://api.ergoplatform.com/docs/openapi

// Use the public Ergo Explorer API
const API_BASE_URL = 'https://api.ergoplatform.com/api/v1';

// Crux Finance API for token prices (uses Spectrum data)
const CRUX_API_URL = 'https://api.cruxfinance.io';

// Ergo has 10^9 nanoErgs per ERG
const NANOERG_TO_ERG = 1_000_000_000;

// Average block time in Ergo is ~2 minutes
const BLOCKS_PER_DAY = 720;
// Storage rent is charged after 4 years (~1,051,200 blocks)
const STORAGE_RENT_PERIOD_BLOCKS = 1051200;

export interface BalanceResponse {
  nanoErgs: number;
  tokens: TokenBalance[];
}

export interface TokenBalance {
  tokenId: string;
  amount: number;
  decimals: number;
  name: string | null;
}

export interface TransactionResponse {
  items: Transaction[];
  total: number;
}

export interface Transaction {
  id: string;
  timestamp: number;
  inclusionHeight: number;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
}

export interface TransactionInput {
  boxId: string;
  value: number;
  address: string;
  assets: Asset[];
}

export interface TransactionOutput {
  boxId: string;
  value: number;
  address: string;
  assets: Asset[];
  creationHeight: number;
}

export interface Asset {
  tokenId: string;
  amount: number;
  name?: string;
  decimals?: number;
}

export interface Box {
  boxId: string;
  value: number;
  creationHeight: number;
  assets: Asset[];
  address: string;
}

export interface BoxesResponse {
  items: Box[];
  total: number;
}

export interface TokenInfo {
  id: string;
  boxId: string;
  emissionAmount: number;
  name: string | null;
  description: string | null;
  type: string | null;
  decimals: number;
}

// Register value can be a string (hex) or an object with serialized/rendered values
type RegisterValue = string | {
  serializedValue?: string;
  renderedValue?: string;
  sigmaType?: string;
};

export interface IssuanceBox {
  boxId: string;
  additionalRegisters: {
    R4?: RegisterValue; // Token name (encoded)
    R5?: RegisterValue; // Token description (encoded)
    R6?: RegisterValue; // Token decimals (encoded)
    R7?: RegisterValue; // Asset type or collection ID
    R8?: RegisterValue; // SHA256 hash or additional info
    R9?: RegisterValue; // Artwork URL (encoded as Coll[Byte])
  };
}

export interface LpPairInfo {
  lpTokenId: string;
  lpName: string;
  token1: { id: string; name: string; ticker: string };
  token2: { id: string; name: string; ticker: string };
  lpTotalSupply?: number;
  lockedErg?: number;
}

export interface HistoricalPriceStats {
  token_info: {
    token_id: string;
    name: string;
    description: string;
    minted: number;
    decimals: number;
  };
  max: { erg: number; usd: number };
  min: { erg: number; usd: number };
  average: { erg: number; usd: number };
}

export interface HistoricalPriceData {
  priceInErg: number;
  priceInUsd: number;
}

// EIP-4 asset type codes (R7 register values)
// Reference: https://github.com/ergoplatform/eips/blob/master/eip-0004.md
// Serialized format: 0e02 prefix + 2 bytes
// Rendered format: just the 2 bytes (0101, 0102, 0103)
export const EIP4_ASSET_TYPES = {
  // Serialized (hex with Coll[Byte] prefix)
  NFT_PICTURE: '0e020101',
  NFT_AUDIO: '0e020102',
  NFT_VIDEO: '0e020103',
  // Rendered (decoded 2-byte values)
  NFT_PICTURE_RENDERED: '0101',
  NFT_AUDIO_RENDERED: '0102',
  NFT_VIDEO_RENDERED: '0103',
} as const;

export type Eip4AssetType = 'picture' | 'audio' | 'video' | null;

class ErgoApiService {
  private baseUrl: string;
  private currentHeight: number | null = null;
  private heightFetchedAt: number = 0;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get current blockchain height
   */
  async getCurrentHeight(): Promise<number> {
    // Cache height for 1 minute
    if (this.currentHeight && Date.now() - this.heightFetchedAt < 60000) {
      return this.currentHeight;
    }

    try {
      const response = await fetch(`${this.baseUrl}/networkState`);
      if (response.ok) {
        const data = await response.json();
        this.currentHeight = data.height;
        this.heightFetchedAt = Date.now();
        return this.currentHeight;
      }
    } catch {
      // Fallback to approximate height if API fails
    }

    // Approximate height based on launch date (July 1, 2019)
    const launchDate = new Date('2019-07-01').getTime();
    const msPerBlock = 2 * 60 * 1000; // 2 minutes
    return Math.floor((Date.now() - launchDate) / msPerBlock);
  }

  /**
   * Fetch total balance for an address (confirmed balance)
   */
  async getAddressBalance(address: string): Promise<BalanceResponse> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/addresses/${address}/balance/total`);
    } catch (error) {
      throw new Error('Network error: Unable to connect to Ergo API. Please check your internet connection.');
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Address not found or has no transaction history');
      }
      if (response.status === 403) {
        throw new Error('API access denied. The API may be temporarily unavailable.');
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      nanoErgs: data.confirmed?.nanoErgs ?? data.nanoErgs ?? 0,
      tokens: data.confirmed?.tokens ?? data.tokens ?? [],
    };
  }

  /**
   * Get full balance with tokens
   */
  async getFullBalance(address: string): Promise<{
    ergBalance: number;
    tokens: Array<{
      tokenId: string;
      name: string;
      amount: number;
      decimals: number;
    }>;
  }> {
    const balance = await this.getAddressBalance(address);

    return {
      ergBalance: balance.nanoErgs / NANOERG_TO_ERG,
      tokens: balance.tokens.map(t => ({
        tokenId: t.tokenId,
        name: t.name || t.tokenId.slice(0, 8) + '...',
        amount: t.decimals > 0 ? t.amount / Math.pow(10, t.decimals) : t.amount,
        decimals: t.decimals,
      })),
    };
  }

  /**
   * Get confirmed balance in ERG (not nanoErg)
   */
  async getErgBalance(address: string): Promise<number> {
    const balance = await this.getAddressBalance(address);
    return balance.nanoErgs / NANOERG_TO_ERG;
  }

  /**
   * Fetch transactions for an address with optional pagination
   */
  async getAddressTransactions(
    address: string,
    options: {
      offset?: number;
      limit?: number;
      fromTimestamp?: number;
      toTimestamp?: number;
    } = {}
  ): Promise<TransactionResponse> {
    const params = new URLSearchParams();

    if (options.offset !== undefined) params.append('offset', options.offset.toString());
    if (options.limit !== undefined) params.append('limit', options.limit.toString());
    if (options.fromTimestamp !== undefined) params.append('fromTs', options.fromTimestamp.toString());
    if (options.toTimestamp !== undefined) params.append('toTs', options.toTimestamp.toString());

    const queryString = params.toString();
    const url = `${this.baseUrl}/addresses/${address}/transactions${queryString ? `?${queryString}` : ''}`;

    let response: Response;

    try {
      response = await fetch(url);
    } catch (error) {
      throw new Error('Network error: Unable to fetch transactions.');
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Address not found');
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Cache for month transactions to avoid re-fetching
  private monthTxCache: {
    address: string;
    year: number;
    month: number;
    transactions: Array<{
      id: string;
      timestamp: Date;
      type: 'incoming' | 'outgoing';
      amount: number;
      status: 'confirmed';
    }>;
    fetchedAt: number;
  } | null = null;

  /**
   * Get transactions for a specific month using client-side filtering
   * The Ergo API's fromTs/toTs params don't filter reliably, so we fetch more and filter ourselves
   * Caches results for the month to support efficient pagination
   */
  async getMonthTransactions(
    address: string,
    year: number,
    month: number, // 0-indexed (0 = January)
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    transactions: Array<{
      id: string;
      timestamp: Date;
      type: 'incoming' | 'outgoing';
      amount: number;
      status: 'confirmed';
    }>;
    total: number;
    hasMore: boolean;
  }> {
    // Check cache - use cached data if same month and less than 2 minutes old
    const cacheValid = this.monthTxCache &&
      this.monthTxCache.address === address &&
      this.monthTxCache.year === year &&
      this.monthTxCache.month === month &&
      Date.now() - this.monthTxCache.fetchedAt < 120000;

    let allMonthTransactions: Array<{
      id: string;
      timestamp: Date;
      type: 'incoming' | 'outgoing';
      amount: number;
      status: 'confirmed';
    }>;

    if (cacheValid && this.monthTxCache) {
      allMonthTransactions = this.monthTxCache.transactions;
    } else {
      // Calculate month start and end timestamps
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const fromTimestamp = startDate.getTime();
      const toTimestamp = endDate.getTime();

      // Fetch enough transactions to cover the month (500 should be enough for most wallets)
      const response = await this.getAddressTransactions(address, {
        limit: 500,
        offset: 0,
      });

      // Filter transactions by timestamp (client-side filtering - API fromTs/toTs unreliable)
      const filteredTxs = response.items.filter(tx => {
        return tx.timestamp >= fromTimestamp && tx.timestamp <= toTimestamp;
      });

      allMonthTransactions = filteredTxs.map(tx => {
        // Calculate net ERG change for this address
        const inputValue = tx.inputs
          .filter(input => input.address === address)
          .reduce((sum, input) => sum + input.value, 0);

        const outputValue = tx.outputs
          .filter(output => output.address === address)
          .reduce((sum, output) => sum + output.value, 0);

        const netChange = outputValue - inputValue;

        return {
          id: tx.id,
          timestamp: new Date(tx.timestamp),
          type: (netChange >= 0 ? 'incoming' : 'outgoing') as 'incoming' | 'outgoing',
          amount: Math.abs(netChange) / NANOERG_TO_ERG,
          status: 'confirmed' as const,
        };
      });

      // Cache the results
      this.monthTxCache = {
        address,
        year,
        month,
        transactions: allMonthTransactions,
        fetchedAt: Date.now(),
      };
    }

    // Apply pagination to cached results
    const paginatedTxs = allMonthTransactions.slice(offset, offset + limit);
    const hasMore = allMonthTransactions.length > offset + limit;

    return {
      transactions: paginatedTxs,
      total: allMonthTransactions.length,
      hasMore,
    };
  }

  /**
   * Clear the month transaction cache (call when month changes)
   */
  clearMonthTxCache(): void {
    this.monthTxCache = null;
  }

  /**
   * Fetch unspent boxes for an address
   */
  async getAddressBoxes(
    address: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<BoxesResponse> {
    const params = new URLSearchParams();
    if (options.offset !== undefined) params.append('offset', options.offset.toString());
    if (options.limit !== undefined) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const url = `${this.baseUrl}/boxes/unspent/byAddress/${address}${queryString ? `?${queryString}` : ''}`;

    let response: Response;

    try {
      response = await fetch(url);
    } catch (error) {
      throw new Error('Network error: Unable to fetch boxes.');
    }

    if (!response.ok) {
      if (response.status === 404) {
        return { items: [], total: 0 };
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get boxes at risk of demurrage (storage rent)
   */
  async getDemurrageBoxes(address: string): Promise<Array<{
    boxId: string;
    valueInErg: number;
    creationHeight: number;
    currentAge: number;
    demurrageDate: Date;
    daysUntilDemurrage: number;
  }>> {
    const [boxesResponse, currentHeight] = await Promise.all([
      this.getAddressBoxes(address, { limit: 100 }),
      this.getCurrentHeight(),
    ]);

    const demurrageBoxes = boxesResponse.items
      .map(box => {
        const age = currentHeight - box.creationHeight;
        const blocksUntilDemurrage = STORAGE_RENT_PERIOD_BLOCKS - age;
        const daysUntilDemurrage = Math.floor(blocksUntilDemurrage / BLOCKS_PER_DAY);

        // Calculate approximate demurrage date
        const demurrageDate = new Date();
        demurrageDate.setDate(demurrageDate.getDate() + daysUntilDemurrage);

        return {
          boxId: box.boxId,
          valueInErg: box.value / NANOERG_TO_ERG,
          creationHeight: box.creationHeight,
          currentAge: age,
          demurrageDate,
          daysUntilDemurrage,
        };
      })
      // Only show boxes that will be demurraged within 1 year
      .filter(box => box.daysUntilDemurrage < 365 && box.daysUntilDemurrage > 0)
      .sort((a, b) => a.daysUntilDemurrage - b.daysUntilDemurrage);

    return demurrageBoxes;
  }

  /**
   * Get token info by ID
   */
  async getTokenInfo(tokenId: string): Promise<TokenInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/tokens/${tokenId}`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  // Cache for Spectrum pool data (LP token ID -> pool info)
  private spectrumPoolCache: Map<string, {
    token1: { id: string; name: string; ticker: string };
    token2: { id: string; name: string; ticker: string };
    tvl: number;
    lockedErg: number;
    lpTotalSupply: number;
    lpDecimals: number;
  }> | null = null;
  private poolCacheFetchedAt: number = 0;

  /**
   * Fetch and cache Spectrum pool data
   * Maps LP token ID to pool pair information
   */
  private async getSpectrumPoolCache(): Promise<Map<string, {
    token1: { id: string; name: string; ticker: string };
    token2: { id: string; name: string; ticker: string };
    tvl: number;
    lockedErg: number;
    lpTotalSupply: number;
    lpDecimals: number;
  }>> {
    // Cache for 5 minutes
    if (this.spectrumPoolCache && Date.now() - this.poolCacheFetchedAt < 300000) {
      return this.spectrumPoolCache;
    }

    const poolMap = new Map<string, {
      token1: { id: string; name: string; ticker: string };
      token2: { id: string; name: string; ticker: string };
      tvl: number;
      lockedErg: number;
      lpTotalSupply: number;
      lpDecimals: number;
    }>();
    const ERG_ID = '0000000000000000000000000000000000000000000000000000000000000000';

    try {
      const response = await fetch('https://api.spectrum.fi/v1/amm/pools/stats', {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.log('Failed to fetch Spectrum pools for LP info');
        return poolMap;
      }

      const pools = await response.json();

      for (const pool of pools) {
        // Get LP token ID from pool data
        const lpTokenId = pool.lp?.id || pool.lpToken?.id || pool.lpId;
        if (!lpTokenId) continue;

        // Get X token (first in pair)
        const xId = pool.lockedX?.id || pool.x?.id || '';
        const xTicker = pool.lockedX?.ticker || pool.x?.ticker || '';
        const xName = pool.lockedX?.name || pool.x?.name || xTicker;
        const xAmount = pool.lockedX?.amount || pool.x?.amount || 0;

        // Get Y token (second in pair)
        const yId = pool.lockedY?.id || pool.y?.id || '';
        const yTicker = pool.lockedY?.ticker || pool.y?.ticker || '';
        const yName = pool.lockedY?.name || pool.y?.name || yTicker;
        const yAmount = pool.lockedY?.amount || pool.y?.amount || 0;

        // Get LP token info
        const lpAmount = pool.lp?.amount || pool.lpToken?.amount || 0;
        const lpDecimals = pool.lp?.decimals ?? pool.lpToken?.decimals ?? 0;

        // Get TVL for value calculation
        const tvl = pool.tvl || pool.liquidity || 0;

        // Calculate locked ERG (need to identify which side is ERG)
        let lockedErg = 0;
        if (xId === ERG_ID || xTicker === 'ERG') {
          lockedErg = xAmount / 1e9; // ERG has 9 decimals
        } else if (yId === ERG_ID || yTicker === 'ERG') {
          lockedErg = yAmount / 1e9;
        }

        // Determine token1 and token2 (ERG always first if present)
        let token1, token2;
        if (xId === ERG_ID || xTicker === 'ERG') {
          token1 = { id: xId, name: 'ERG', ticker: 'ERG' };
          token2 = { id: yId, name: yName, ticker: yTicker || yId.slice(0, 5) };
        } else if (yId === ERG_ID || yTicker === 'ERG') {
          token1 = { id: yId, name: 'ERG', ticker: 'ERG' };
          token2 = { id: xId, name: xName, ticker: xTicker || xId.slice(0, 5) };
        } else {
          // Token/Token pair - use TVL / 2 as ERG estimate (both sides valued equally)
          lockedErg = tvl / 2;
          token1 = { id: xId, name: xName, ticker: xTicker || xId.slice(0, 5) };
          token2 = { id: yId, name: yName, ticker: yTicker || yId.slice(0, 5) };
        }

        // LP total supply in decimal form
        const lpTotalSupply = lpDecimals > 0 ? lpAmount / Math.pow(10, lpDecimals) : lpAmount;

        poolMap.set(lpTokenId, { token1, token2, tvl, lockedErg, lpTotalSupply, lpDecimals });
      }

      console.log(`Cached ${poolMap.size} Spectrum pools for LP info lookup`);
    } catch (error) {
      console.error('Error fetching Spectrum pool cache:', error);
    }

    this.spectrumPoolCache = poolMap;
    this.poolCacheFetchedAt = Date.now();
    return poolMap;
  }

  /**
   * Get LP token pair information from Spectrum pool data
   * Returns the two tokens that make up the LP pair
   */
  async getLpPairInfo(lpTokenId: string): Promise<LpPairInfo | null> {
    try {
      // First check Spectrum pool cache for accurate pair info
      const poolCache = await this.getSpectrumPoolCache();
      const poolInfo = poolCache.get(lpTokenId);

      if (poolInfo) {
        return {
          lpTokenId,
          lpName: `${poolInfo.token1.ticker}/${poolInfo.token2.ticker} LP`,
          token1: poolInfo.token1,
          token2: poolInfo.token2,
          lpTotalSupply: poolInfo.lpTotalSupply,
          lockedErg: poolInfo.lockedErg,
        };
      }

      // Fallback: Check if token looks like an LP token and get basic info
      const tokenInfo = await this.getTokenInfo(lpTokenId);
      if (!tokenInfo) return null;

      const tokenName = tokenInfo.name || '';
      const isLikelyLp = tokenName.toLowerCase().includes('lp') ||
                         tokenName.toLowerCase().includes('fund') ||
                         tokenName.includes('_');

      if (!isLikelyLp) return null;

      // Parse name for pair info (e.g., "ERG_Rugged_LP" or "Rugged/ERG LP")
      const ERG_ID = '0000000000000000000000000000000000000000000000000000000000000000';
      const nameParts = tokenName.replace(/_LP$/i, '').replace(/ LP$/i, '').split(/[_\/]/);

      if (nameParts.length >= 2) {
        const ticker1 = nameParts[0].trim();
        const ticker2 = nameParts[1].trim();

        // Put ERG first if present
        if (ticker2.toUpperCase() === 'ERG') {
          return {
            lpTokenId,
            lpName: `ERG/${ticker1} LP`,
            token1: { id: ERG_ID, name: 'ERG', ticker: 'ERG' },
            token2: { id: '', name: ticker1, ticker: ticker1 },
          };
        }

        return {
          lpTokenId,
          lpName: `${ticker1}/${ticker2} LP`,
          token1: { id: ticker1.toUpperCase() === 'ERG' ? ERG_ID : '', name: ticker1, ticker: ticker1 },
          token2: { id: '', name: ticker2, ticker: ticker2 },
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching LP pair info:', error);
      return null;
    }
  }

  /**
   * Get LP token value in ERG from Spectrum pool data
   * Returns the share of pool's ERG based on LP token amount
   * For ERG/token pools: value = user's share * 2 * lockedErg (both sides valued)
   * For token/token pools: uses TVL estimate
   */
  async getLpTokenValue(lpTokenId: string, lpAmount: number): Promise<number> {
    try {
      const poolCache = await this.getSpectrumPoolCache();
      const poolInfo = poolCache.get(lpTokenId);

      if (poolInfo && poolInfo.lpTotalSupply > 0) {
        // User's share of the pool
        const shareOfPool = lpAmount / poolInfo.lpTotalSupply;

        // For ERG pools, value = share * 2 * lockedErg (both sides of LP)
        // For token/token pools, use TVL
        let valueInErg: number;
        if (poolInfo.lockedErg > 0) {
          // ERG pool - both sides worth approx same, so 2x the ERG side
          valueInErg = shareOfPool * 2 * poolInfo.lockedErg;
        } else if (poolInfo.tvl > 0) {
          // Token/token pool - use TVL
          valueInErg = shareOfPool * poolInfo.tvl;
        } else {
          valueInErg = 0;
        }

        console.log(`LP ${lpTokenId.slice(0,8)}: amount=${lpAmount}, totalSupply=${poolInfo.lpTotalSupply}, lockedErg=${poolInfo.lockedErg}, share=${(shareOfPool * 100).toFixed(4)}%, value=${valueInErg.toFixed(4)} ERG`);
        return valueInErg;
      }
    } catch (error) {
      console.error('Error calculating LP token value:', error);
    }
    return 0;
  }

  /**
   * Get LP pool share percentage
   */
  async getLpPoolShare(lpTokenId: string, lpAmount: number): Promise<number> {
    try {
      const poolCache = await this.getSpectrumPoolCache();
      const poolInfo = poolCache.get(lpTokenId);

      if (poolInfo && poolInfo.lpTotalSupply > 0) {
        const sharePercent = (lpAmount / poolInfo.lpTotalSupply) * 100;
        return sharePercent;
      }
    } catch (error) {
      console.error('Error calculating LP pool share:', error);
    }
    return 0;
  }

  /**
   * Get the issuance box for a token (contains registers with artwork URL)
   */
  async getTokenIssuanceBox(tokenId: string): Promise<IssuanceBox | null> {
    try {
      // The issuance box ID is the same as the token ID
      const response = await fetch(`${this.baseUrl}/boxes/${tokenId}`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  /**
   * Decode a hex-encoded register value to string
   * Ergo registers are encoded as: 0e + VLQ length + bytes
   * VLQ (Variable Length Quantity): if high bit set, continue reading
   */
  decodeRegisterToString(hexValue: string): string | null {
    try {
      // Check for Coll[Byte] prefix (0e)
      if (!hexValue.startsWith('0e')) {
        return null;
      }

      // Parse VLQ length starting at position 2 (after '0e')
      let pos = 2;
      let length = 0;
      let shift = 0;

      while (pos < hexValue.length) {
        const byte = parseInt(hexValue.slice(pos, pos + 2), 16);
        pos += 2;
        length |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break; // High bit not set = last byte
        shift += 7;
      }

      // Now extract 'length' bytes from position 'pos'
      const hexContent = hexValue.slice(pos, pos + length * 2);
      const bytes = new Uint8Array(
        hexContent.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );

      const decoded = new TextDecoder().decode(bytes);
      console.log(`Decoded R9 for token: "${decoded}" (length: ${length})`);
      return decoded;
    } catch (err) {
      console.error('Error decoding register:', err);
      return null;
    }
  }

  /**
   * Check if a token is an EIP-4 artwork type by examining the R7 register
   * R7 contains asset type for EIP-4 tokens:
   * - 0e020101 / 0101 = NFT picture
   * - 0e020102 / 0102 = NFT audio
   * - 0e020103 / 0103 = NFT video
   * Returns the asset type or null if not an EIP-4 artwork
   */
  async getTokenEip4AssetType(tokenId: string): Promise<Eip4AssetType> {
    try {
      // First, get token info to find the actual issuance box ID
      const tokenInfo = await this.getTokenInfo(tokenId);
      if (!tokenInfo?.boxId) {
        return null;
      }

      // Fetch the issuance box (which contains R7)
      const box = await this.getTokenIssuanceBox(tokenInfo.boxId);
      if (!box?.additionalRegisters?.R7) {
        return null;
      }

      const r7Value = box.additionalRegisters.R7;

      // R7 might be a string (serialized hex) or an object with serializedValue/renderedValue
      let serializedValue: string | null = null;
      let renderedValue: string | null = null;

      if (typeof r7Value === 'string') {
        serializedValue = r7Value;
      } else if (typeof r7Value === 'object' && r7Value !== null) {
        serializedValue = r7Value.serializedValue || null;
        renderedValue = r7Value.renderedValue || null;
      }

      // Check serialized format (0e020101, etc.)
      if (serializedValue) {
        if (serializedValue === EIP4_ASSET_TYPES.NFT_PICTURE) return 'picture';
        if (serializedValue === EIP4_ASSET_TYPES.NFT_AUDIO) return 'audio';
        if (serializedValue === EIP4_ASSET_TYPES.NFT_VIDEO) return 'video';
      }

      // Check rendered format (0101, 0102, 0103)
      if (renderedValue) {
        if (renderedValue === EIP4_ASSET_TYPES.NFT_PICTURE_RENDERED) return 'picture';
        if (renderedValue === EIP4_ASSET_TYPES.NFT_AUDIO_RENDERED) return 'audio';
        if (renderedValue === EIP4_ASSET_TYPES.NFT_VIDEO_RENDERED) return 'video';
      }

      return null;
    } catch (error) {
      console.error(`Error checking R7 for token ${tokenId.slice(0, 8)}:`, error);
      return null;
    }
  }

  /**
   * Get artwork URL from token's issuance box R9 register
   * Note: The issuance box ID comes from token info, not the token ID itself
   */
  async getTokenArtworkUrl(tokenId: string): Promise<string | null> {
    // First, get token info to find the actual issuance box ID
    const tokenInfo = await this.getTokenInfo(tokenId);
    if (!tokenInfo?.boxId) {
      console.log(`No box ID found for token ${tokenId.slice(0, 8)}`);
      return null;
    }

    // Fetch the issuance box (which contains R9)
    const box = await this.getTokenIssuanceBox(tokenInfo.boxId);
    if (!box?.additionalRegisters?.R9) {
      console.log(`No R9 register for token ${tokenId.slice(0, 8)} (box: ${tokenInfo.boxId.slice(0, 8)})`);
      return null;
    }

    const r9Value = box.additionalRegisters.R9;

    // R9 might be a string (serialized hex) or an object with renderedValue
    let hexValue: string | null = null;

    if (typeof r9Value === 'string') {
      hexValue = r9Value;
    } else if (typeof r9Value === 'object' && r9Value !== null) {
      // Explorer API might return { serializedValue: "...", renderedValue: "..." }
      hexValue = r9Value.serializedValue || r9Value.renderedValue || null;
      // If renderedValue is already decoded, use it directly
      if (r9Value.renderedValue && typeof r9Value.renderedValue === 'string') {
        const rendered = r9Value.renderedValue;
        console.log(`R9 renderedValue for ${tokenId.slice(0, 8)}: "${rendered.slice(0, 60)}..."`);
        // Check if it looks like a URL or CID
        if (rendered.startsWith('http') || rendered.startsWith('ipfs://') ||
            rendered.startsWith('bafy') || rendered.startsWith('Qm')) {
          return rendered;
        }
      }
    }

    if (!hexValue || typeof hexValue !== 'string') {
      console.log(`R9 is not a valid string for token ${tokenId.slice(0, 8)}:`, typeof r9Value);
      return null;
    }

    console.log(`R9 raw value for ${tokenId.slice(0, 8)}: ${hexValue.slice(0, 50)}...`);
    const artworkUrl = this.decodeRegisterToString(hexValue);
    return artworkUrl;
  }

  /**
   * Convert IPFS URL or CID to gateway URL
   * Using ipfs.io gateway as it's the most stable
   * Handles: ipfs:// URLs, raw CIDv0 (Qm...), raw CIDv1 (bafy...), http URLs
   */
  ipfsToGatewayUrl(url: string): string {
    if (!url) return url;

    // Upgrade http to https for ipfs.io URLs
    if (url.startsWith('http://ipfs.io')) {
      return url.replace('http://', 'https://');
    }

    // Already a full HTTPS URL
    if (url.startsWith('https://')) {
      return url;
    }

    // http URLs (non-ipfs) - return as-is, browser will handle
    if (url.startsWith('http://')) {
      return url;
    }

    // ipfs:// protocol URL
    if (url.startsWith('ipfs://')) {
      const hash = url.replace('ipfs://', '');
      return `https://ipfs.io/ipfs/${hash}`;
    }

    // Raw CIDv1 (starts with 'bafy' for base32)
    if (url.startsWith('bafy')) {
      return `https://ipfs.io/ipfs/${url}`;
    }

    // Raw CIDv0 (starts with 'Qm')
    if (url.startsWith('Qm')) {
      return `https://ipfs.io/ipfs/${url}`;
    }

    // Unknown format, return as-is
    return url;
  }

  /**
   * Identify NFTs from token list (tokens with amount = 1 and no decimals)
   * Uses R7 register (EIP-4) for accurate type detection when available
   */
  async getNFTs(tokens: TokenBalance[]): Promise<Array<{
    tokenId: string;
    name: string;
    description: string;
    type: 'NFT' | 'Audio' | 'Video' | 'Artwork Collection';
    artworkUrl: string | null;
  }>> {
    // Filter potential NFTs (amount = 1, decimals = 0)
    const potentialNFTs = tokens.filter(t => t.amount === 1 && t.decimals === 0);

    // Fetch info for each potential NFT
    const nfts = await Promise.all(
      potentialNFTs.slice(0, 20).map(async (token) => {
        const [info, artworkUrl, eip4AssetType] = await Promise.all([
          this.getTokenInfo(token.tokenId),
          this.getTokenArtworkUrl(token.tokenId),
          this.getTokenEip4AssetType(token.tokenId),
        ]);
        if (!info) return null;

        // Determine type - prefer R7 (EIP-4) if available, fallback to name/description
        let type: 'NFT' | 'Audio' | 'Video' | 'Artwork Collection' = 'NFT';

        if (eip4AssetType) {
          // Use EIP-4 R7 register for accurate type
          if (eip4AssetType === 'audio') {
            type = 'Audio';
          } else if (eip4AssetType === 'video') {
            type = 'Video';
          } else {
            type = 'NFT'; // picture
          }
        } else {
          // Fallback: Determine type based on name or description
          const nameLower = (info.name || '').toLowerCase();
          const descLower = (info.description || '').toLowerCase();

          if (nameLower.includes('audio') || descLower.includes('audio') || descLower.includes('music')) {
            type = 'Audio';
          } else if (nameLower.includes('video') || descLower.includes('video')) {
            type = 'Video';
          } else if (nameLower.includes('collection') || descLower.includes('collection')) {
            type = 'Artwork Collection';
          }
        }

        return {
          tokenId: token.tokenId,
          name: info.name || token.tokenId.slice(0, 8) + '...',
          description: info.description || 'No description',
          type,
          artworkUrl: artworkUrl ? this.ipfsToGatewayUrl(artworkUrl) : null,
        };
      })
    );

    return nfts.filter((nft): nft is NonNullable<typeof nft> => nft !== null);
  }

  /**
   * Validate if a string is a valid Ergo address
   */
  isValidAddress(address: string): boolean {
    // Ergo mainnet addresses start with '9' and are 51 characters long
    // This is a basic validation - the API will do full validation
    return /^9[a-zA-Z0-9]{50}$/.test(address);
  }

  /**
   * Get token positions with prices from Crux Finance API
   * Uses POST /crux/positions endpoint that returns all token data with prices
   */
  async getCruxPositions(addresses: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();

    try {
      const response = await fetch(`${CRUX_API_URL}/crux/positions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(addresses),
      });

      if (!response.ok) {
        // 422 is common when API doesn't have data for this address - fall back to other price sources
        console.log('Crux positions API unavailable, using fallback price sources');
        return priceMap;
      }

      const data = await response.json();
      console.log('Crux positions response:', JSON.stringify(data).slice(0, 500));

      // Parse the response - Crux returns array of position objects
      // Each position has: tokenId, amount, price (current price in ERG)
      const positions = Array.isArray(data) ? data : data.positions || data.data || [];

      // Debug tokens we're investigating
      const DEBUG_TOKENS = [
        '0779ec04f2fae64e87418a1ad917639d4668f78484f45df962b0dec14a2591d2', // Mi Goreng
        'b0b312cde931c8bbdac0dac5bfd8e2c03bf4611275dc967988c8d15bd5ec20e0', // Bober
      ];

      for (const position of positions) {
        // Try different field names for token ID (Crux uses 'id' or 'token_id')
        const tokenId = position.tokenId || position.token_id || position.id;

        // Debug: Log full position object for problem tokens
        if (tokenId && DEBUG_TOKENS.includes(tokenId)) {
          console.log(`[DEBUG] Full position object for ${tokenId.slice(0, 8)}:`, JSON.stringify(position, null, 2));
        }

        // Get the amount for this position (needed to calculate price from total value)
        const amount = position.amount || position.tokenAmount || 0;

        // Try different field names for PRICE PER TOKEN in ERG
        // NOTE: value_in_erg is TOTAL VALUE (amount * price), not per-token price!
        // Crux API uses: price_erg, priceInfo.erg, price.erg for per-token price
        let price = 0;
        let priceSource = '';

        // First, try direct price per token fields
        if (position.price_erg !== undefined && position.price_erg > 0) {
          price = position.price_erg;
          priceSource = 'price_erg';
        } else if (position.priceInfo?.erg !== undefined && position.priceInfo.erg > 0) {
          price = position.priceInfo.erg;
          priceSource = 'priceInfo.erg';
        } else if (position.price?.erg !== undefined && position.price.erg > 0) {
          price = position.price.erg;
          priceSource = 'price.erg';
        } else if (position.currentPrice !== undefined && position.currentPrice > 0) {
          price = position.currentPrice;
          priceSource = 'currentPrice';
        } else if (typeof position.price === 'number' && position.price > 0) {
          price = position.price;
          priceSource = 'price (number)';
        }
        // If we have value_in_erg (total value) and amount, calculate per-token price
        else if (position.value_in_erg !== undefined && amount > 0) {
          price = position.value_in_erg / amount;
          priceSource = `value_in_erg/${amount}`;
          console.log(`Calculated price from value_in_erg: ${position.value_in_erg} / ${amount} = ${price}`);
        }

        // Debug: Log price source for problem tokens
        if (tokenId && DEBUG_TOKENS.includes(tokenId)) {
          console.log(`[DEBUG] ${tokenId.slice(0, 8)}: price=${price}, source=${priceSource}, amount=${amount}`);
        }

        if (tokenId && price > 0) {
          priceMap.set(tokenId, parseFloat(String(price)));
          console.log(`Token ${tokenId.slice(0,8)}... price: ${price.toFixed(6)} ERG (source: ${priceSource})`);
        }
      }
    } catch (err) {
      console.error('Error fetching positions from Crux:', err);
    }

    return priceMap;
  }

  /**
   * Get token prices from Spectrum DEX pools
   * Fetches pool data and calculates token prices from liquidity ratios
   * Uses the pool with the largest liquidity for each token
   */
  async getSpectrumPoolPrices(tokenIds: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    // Track the best pool (highest liquidity) for each token
    const bestPoolLiquidity = new Map<string, number>();

    try {
      // Try the Spectrum pools endpoint
      const response = await fetch('https://api.spectrum.fi/v1/amm/pools/stats', {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.log('Spectrum pools API not available:', response.status);
        return priceMap;
      }

      const pools = await response.json();
      console.log('Spectrum pools count:', pools?.length || 0);

      // ERG token ID is all zeros (native token)
      const ERG_TOKEN_ID = '0000000000000000000000000000000000000000000000000000000000000000';

      // Debug tokens we're investigating
      const DEBUG_TOKENS = [
        '0779ec04f2fae64e87418a1ad917639d4668f78484f45df962b0dec14a2591d2', // Mi Goreng
        'b0b312cde931c8bbdac0dac5bfd8e2c03bf4611275dc967988c8d15bd5ec20e0', // Bober
      ];

      // Process pools to extract token prices - use pool with largest liquidity
      // IMPORTANT: Only consider ERG/token pools, not token/token pools
      for (const pool of pools) {
        // Get the X side (should be ERG for us to use it)
        const xId = pool.lockedX?.id || pool.x?.id;
        const xAmount = pool.lockedX?.amount || pool.x?.amount || 0;
        const xTicker = pool.lockedX?.ticker || pool.x?.ticker || '';

        // Get the Y side (the token we want to price)
        const yId = pool.lockedY?.id || pool.y?.id;
        const yAmount = pool.lockedY?.amount || pool.y?.amount || 0;
        const yDecimals = pool.lockedY?.decimals || pool.y?.decimals || 0;

        // ONLY use pools where X is ERG (native token)
        const isErgPool = xId === ERG_TOKEN_ID || xTicker === 'ERG';

        // Debug: Log all pools for problem tokens
        if (yId && DEBUG_TOKENS.includes(yId)) {
          console.log(`[DEBUG POOL] ${yId.slice(0, 8)}:`, {
            xId: xId?.slice(0, 8),
            xTicker,
            xAmount,
            yAmount,
            yDecimals,
            isErgPool,
            poolId: pool.id,
          });
        }

        // Skip non-ERG pools
        if (!isErgPool) {
          continue;
        }

        if (yId && xAmount > 0 && yAmount > 0 && tokenIds.includes(yId)) {
          // Calculate liquidity value in ERG (TVL proxy)
          const ergDecimals = 9;
          const liquidity = xAmount / Math.pow(10, ergDecimals);

          // Only update if this pool has more liquidity than previous best
          const currentBest = bestPoolLiquidity.get(yId) || 0;
          if (liquidity > currentBest) {
            bestPoolLiquidity.set(yId, liquidity);

            // Price = ERG reserve / token reserve (adjusted for decimals)
            const price = (xAmount / Math.pow(10, ergDecimals)) /
                          (yAmount / Math.pow(10, yDecimals));
            priceMap.set(yId, price);

            // Debug: Extra logging for problem tokens
            if (DEBUG_TOKENS.includes(yId)) {
              console.log(`[DEBUG PRICE] ${yId.slice(0, 8)}:`, {
                ergReserveERG: xAmount / Math.pow(10, ergDecimals),
                tokenReserveAdj: yAmount / Math.pow(10, yDecimals),
                calculatedPrice: price,
                liquidity
              });
            }

            console.log(`Pool price for ${yId.slice(0,8)}...: ${price.toFixed(6)} ERG (liquidity: ${liquidity.toFixed(2)} ERG)`);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching Spectrum pool prices:', error);
    }

    return priceMap;
  }

  /**
   * Get ERG/USD price from SigUSD oracle pool
   * This provides a reliable USD price for ERG from on-chain data
   */
  async getSigUsdOraclePrice(): Promise<number | null> {
    try {
      const response = await fetch('https://api.ergoplatform.com/api/v1/boxes/unspent/byErgoTree/100604000e20011d3364de07e5a26f0c4eef0852cddb387039a921b7154ef3cab22c6eda887f0400040204020402040204000402040004000402050005000580dac409040205c0d40105c0b4020504000e200ef9a5c723d58cc219cfba86c8a8ff010d0cede007e1a04893bd2c1fe6fa0c2c040004040400d808d601e4c6a70407d602b2a5dc64ed99a37300929dc1a7730191a39a72017302017303d63ed8058972027304d603b2db6308a773059593c272037306d801d604c27203e4c6a70511d1ed93b0b5a5d9010463edededede6720493e47204830200e6c6a70611e6c6a706089490720493e4c672040804eded93e4c6720408057307d801d605b2db63087204730800938c720501d801d606db63087205ede6c6720506089493c17205730993c27205d0720693e4c6720506050ec1a793e4c67205040e7204edededda720293c27202730a93db63087202db6308a7ded902030e7204720393c17202730b97a50992a3a1b27202730c00e4c67202050e93c2b2a5730d00d0cde4c6a7050e93e4c6a70407d805d603e4c6a7050ed60499b27203730e0073');

      if (!response.ok) {
        console.log('Oracle pool API not available:', response.status);
        return null;
      }

      const data = await response.json();
      if (data.items && data.items.length > 0) {
        // Parse oracle box to get ERG/USD rate
        const oracleBox = data.items[0];
        // Oracle stores rate in R4 register
        if (oracleBox.additionalRegisters?.R4) {
          const r4 = oracleBox.additionalRegisters.R4;
          // R4 contains the nanERG per USD (as Long encoded as 05 + hex)
          if (r4.startsWith('05')) {
            // Decode VLQ Long
            const hex = r4.slice(2);
            let value = 0;
            let shift = 0;
            for (let i = 0; i < hex.length; i += 2) {
              const byte = parseInt(hex.slice(i, i + 2), 16);
              value |= (byte & 0x7f) << shift;
              shift += 7;
              if ((byte & 0x80) === 0) break;
            }
            // Convert nanoERG per USD to ERG per USD
            const ergPerUsd = value / NANOERG_TO_ERG;
            console.log(`SigUSD oracle: 1 USD = ${ergPerUsd.toFixed(6)} ERG`);
            return ergPerUsd;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching SigUSD oracle price:', error);
    }

    return null;
  }

  // SigUSD token IDs (both old and new versions)
  private readonly SIGUSD_TOKEN_IDS = [
    '03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04', // Original SigUSD
    'a55b8735ed1a99e46c2c89f8994aacdf4b1109bdcf682f1e5b34479c6e392669', // USE (newer stable)
  ];

  /**
   * Known stable token IDs and their approximate ERG prices
   * Used as fallback when APIs are unavailable
   */
  getKnownTokenPrices(): Map<string, number> {
    const priceMap = new Map<string, number>();

    // SigRSV - reserve token, variable price but typically 0.001-0.01 ERG
    priceMap.set('003bd19d0187117f130b62e1bcab0939929ff5c7709f843c5c4dd158949285d0', 0.003);

    // NETA - community token
    priceMap.set('472c3d4ecaa08fb7392ff041ee2e6af75f4a558810a74b28600549d5392810e8', 0.0001);

    // Ergopad - launchpad token
    priceMap.set('d71693c49a84fbbecd4908c94813b46514b18b67a99952dc1e6e4791556de413', 0.02);

    // COMET
    priceMap.set('0cd8c9f416e5b1ca9f986a7f10a84191dfb85941619e49e53c0dc30ebf83324b', 0.0001);

    return priceMap;
  }

  /**
   * Get token prices from Crux Finance API (uses Spectrum data)
   * Returns a map of tokenId -> price in ERG
   */
  async getTokenPrices(tokenIds: string[], address?: string): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();

    // If we have an address, try the Crux positions endpoint first (most reliable)
    if (address) {
      const positions = await this.getCruxPositions([address]);
      if (positions.size > 0) {
        console.log(`Got ${positions.size} prices from Crux positions API`);
        // Add SigUSD oracle price for any missing stables
        await this.addOraclePricesForStables(positions, tokenIds);
        return positions;
      }
    }

    // Fallback: try Spectrum pool prices (uses largest LP pool)
    const poolPrices = await this.getSpectrumPoolPrices(tokenIds);
    if (poolPrices.size > 0) {
      console.log(`Got ${poolPrices.size} prices from Spectrum pools`);
      // Add SigUSD oracle price for any missing stables
      await this.addOraclePricesForStables(poolPrices, tokenIds);
      return poolPrices;
    }

    // Try SigUSD oracle for stablecoins
    const oraclePrice = await this.getSigUsdOraclePrice();
    if (oraclePrice) {
      for (const tokenId of tokenIds) {
        if (this.SIGUSD_TOKEN_IDS.includes(tokenId)) {
          // SigUSD/USE = $1, so price in ERG = oracle ERG/USD rate
          priceMap.set(tokenId, oraclePrice);
          console.log(`Using oracle price for ${tokenId.slice(0,8)}...: ${oraclePrice.toFixed(6)} ERG`);
        }
      }
    }

    // Add known token prices for common tokens
    const knownPrices = this.getKnownTokenPrices();
    for (const tokenId of tokenIds) {
      if (!priceMap.has(tokenId) && knownPrices.has(tokenId)) {
        priceMap.set(tokenId, knownPrices.get(tokenId)!);
      }
    }

    if (priceMap.size > 0) {
      console.log(`Using ${priceMap.size} prices from oracle/fallback`);
      return priceMap;
    }

    console.log('No prices available from external APIs');
    return priceMap;
  }

  /**
   * Get historical price for a token at a specific point in time
   * Uses local API route that proxies to Crux Finance API (avoids CORS issues)
   * @param tokenId The token ID to get historical price for
   * @param timePoint Unix timestamp (in milliseconds) for the price point
   * @param timeWindow Unix timestamp in milliseconds for the time window (typically same as timePoint for point-in-time)
   * @returns Historical price data or null if not available
   */
  async getHistoricalTokenPrice(
    tokenId: string,
    timePoint: number,
    timeWindow?: number
  ): Promise<HistoricalPriceData | null> {
    try {
      const window = timeWindow || timePoint;
      // Use local API route to avoid CORS issues
      const url = `/api/historical-price?token_id=${tokenId}&time_point=${timePoint}&time_window=${window}`;

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.log(`Historical price not available for ${tokenId.slice(0, 8)}: ${response.status}`);
        return null;
      }

      const data: HistoricalPriceStats = await response.json();

      if (data.average && data.average.erg > 0) {
        return {
          priceInErg: data.average.erg,
          priceInUsd: data.average.usd,
        };
      }

      return null;
    } catch (error) {
      console.error(`Error fetching historical price for ${tokenId.slice(0, 8)}:`, error);
      return null;
    }
  }

  /**
   * Get historical prices for multiple tokens at end of a specific month
   * @param tokenIds Array of token IDs to fetch prices for
   * @param year The year of the month
   * @param month The month (0-indexed, 0 = January)
   * @returns Map of tokenId -> price data
   */
  async getHistoricalPricesForMonth(
    tokenIds: string[],
    year: number,
    month: number
  ): Promise<Map<string, HistoricalPriceData>> {
    const priceMap = new Map<string, HistoricalPriceData>();

    // Calculate end of month timestamp (last day, 23:59:59) - in milliseconds
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
    const timePointMs = endOfMonth.getTime();

    // Calculate time window - from start of month to end of month (in milliseconds)
    const startOfMonth = new Date(year, month, 1);
    const timeWindowMs = startOfMonth.getTime();

    console.log(`Fetching historical prices for ${tokenIds.length} tokens at ${endOfMonth.toISOString()}`);

    // Fetch prices in parallel with a reasonable batch size
    const BATCH_SIZE = 5;
    for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
      const batch = tokenIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(tokenId =>
          this.getHistoricalTokenPrice(tokenId, timePointMs, timeWindowMs)
            .then(data => ({ tokenId, data }))
        )
      );

      for (const { tokenId, data } of results) {
        if (data) {
          priceMap.set(tokenId, data);
        }
      }
    }

    console.log(`Got historical prices for ${priceMap.size}/${tokenIds.length} tokens`);
    return priceMap;
  }

  /**
   * Get historical prices at start and end of month for change calculation
   * @param tokenIds Array of token IDs
   * @param year The year
   * @param month The month (0-indexed)
   * @returns Map of tokenId -> { startPrice, endPrice } for change % calculation
   */
  async getHistoricalPriceChange(
    tokenIds: string[],
    year: number,
    month: number
  ): Promise<Map<string, { startPrice: number; endPrice: number }>> {
    const changeMap = new Map<string, { startPrice: number; endPrice: number }>();

    // Start of month timestamp (in milliseconds)
    const startOfMonth = new Date(year, month, 1, 0, 0, 0);
    const startTimeMs = startOfMonth.getTime();

    // End of month timestamp (in milliseconds)
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
    const endTimeMs = endOfMonth.getTime();

    console.log(`Fetching price change: ${startOfMonth.toDateString()} to ${endOfMonth.toDateString()}`);

    // Fetch start and end prices in parallel
    const BATCH_SIZE = 3;
    for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
      const batch = tokenIds.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async tokenId => {
          const [startData, endData] = await Promise.all([
            this.getHistoricalTokenPrice(tokenId, startTimeMs, startTimeMs),
            this.getHistoricalTokenPrice(tokenId, endTimeMs, endTimeMs),
          ]);
          return { tokenId, startData, endData };
        })
      );

      for (const { tokenId, startData, endData } of results) {
        if (startData && endData && startData.priceInErg > 0) {
          changeMap.set(tokenId, {
            startPrice: startData.priceInErg,
            endPrice: endData.priceInErg,
          });
        }
      }
    }

    return changeMap;
  }

  /**
   * Add oracle prices for stablecoins if not already in the price map
   */
  private async addOraclePricesForStables(priceMap: Map<string, number>, tokenIds: string[]): Promise<void> {
    const missingStables = tokenIds.filter(
      id => this.SIGUSD_TOKEN_IDS.includes(id) && !priceMap.has(id)
    );

    if (missingStables.length > 0) {
      const oraclePrice = await this.getSigUsdOraclePrice();
      if (oraclePrice) {
        for (const tokenId of missingStables) {
          priceMap.set(tokenId, oraclePrice);
          console.log(`Added oracle price for stable ${tokenId.slice(0,8)}...: ${oraclePrice.toFixed(6)} ERG`);
        }
      }
    }
  }

  /**
   * Calculate token movements (additions and reductions) for a given month
   * Returns per-token In/Out values based on transaction history
   */
  async getTokenMovements(
    address: string,
    year: number,
    month: number // 0-indexed (0 = January)
  ): Promise<Map<string, { additions: number; reductions: number }>> {
    const movements = new Map<string, { additions: number; reductions: number }>();

    // Calculate month start and end timestamps
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const fromTimestamp = startDate.getTime();
    const toTimestamp = endDate.getTime();

    try {
      // Fetch transactions for the month
      const response = await this.getAddressTransactions(address, {
        limit: 200,
        offset: 0,
      });

      // Filter to transactions within the month
      const monthTxs = response.items.filter(tx => {
        return tx.timestamp >= fromTimestamp && tx.timestamp <= toTimestamp;
      });

      // Process each transaction
      for (const tx of monthTxs) {
        // Calculate token inputs (what we sent FROM this address)
        const tokenInputs = new Map<string, number>();
        for (const input of tx.inputs) {
          if (input.address === address) {
            for (const asset of input.assets || []) {
              const current = tokenInputs.get(asset.tokenId) || 0;
              tokenInputs.set(asset.tokenId, current + asset.amount);
            }
          }
        }

        // Calculate token outputs (what we received TO this address)
        const tokenOutputs = new Map<string, number>();
        for (const output of tx.outputs) {
          if (output.address === address) {
            for (const asset of output.assets || []) {
              const current = tokenOutputs.get(asset.tokenId) || 0;
              tokenOutputs.set(asset.tokenId, current + asset.amount);
            }
          }
        }

        // Calculate net changes per token
        const allTokenIds = new Set([...tokenInputs.keys(), ...tokenOutputs.keys()]);

        for (const tokenId of allTokenIds) {
          const inputAmount = tokenInputs.get(tokenId) || 0;
          const outputAmount = tokenOutputs.get(tokenId) || 0;
          const netChange = outputAmount - inputAmount;

          // Get or create movement record
          let movement = movements.get(tokenId);
          if (!movement) {
            movement = { additions: 0, reductions: 0 };
            movements.set(tokenId, movement);
          }

          // Positive net = addition (received tokens)
          // Negative net = reduction (sent tokens)
          if (netChange > 0) {
            movement.additions += netChange;
          } else if (netChange < 0) {
            movement.reductions += Math.abs(netChange);
          }
        }
      }

      // Also track ERG movements (pseudo token ID for ERG)
      const ERG_PSEUDO_ID = '__ERG__';
      let ergAdditions = 0;
      let ergReductions = 0;

      for (const tx of monthTxs) {
        const inputValue = tx.inputs
          .filter(input => input.address === address)
          .reduce((sum, input) => sum + input.value, 0);

        const outputValue = tx.outputs
          .filter(output => output.address === address)
          .reduce((sum, output) => sum + output.value, 0);

        const netErg = outputValue - inputValue;
        if (netErg > 0) {
          ergAdditions += netErg;
        } else if (netErg < 0) {
          ergReductions += Math.abs(netErg);
        }
      }

      // Store ERG movements (in nanoERG for now, will convert when using)
      movements.set(ERG_PSEUDO_ID, {
        additions: ergAdditions / NANOERG_TO_ERG,
        reductions: ergReductions / NANOERG_TO_ERG,
      });

    } catch (error) {
      console.error('Error calculating token movements:', error);
    }

    return movements;
  }

  /**
   * Get monthly ending balances for the past N months
   * Works backwards from current balance using transaction history
   */
  async getMonthlyBalanceHistory(
    address: string,
    months: number = 6
  ): Promise<Array<{ month: string; balance: number }>> {
    // Get current balance
    const currentBalance = await this.getErgBalance(address);

    // Get transactions for the past N months
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // Fetch all transactions in the date range
    const response = await this.getAddressTransactions(address, {
      limit: 500, // Fetch enough to cover history
      offset: 0,
    });

    // Filter to transactions within our date range
    const transactions = response.items.filter(
      tx => tx.timestamp >= startDate.getTime()
    );

    // Calculate net change for each transaction
    const txChanges = transactions.map(tx => {
      const inputValue = tx.inputs
        .filter(input => input.address === address)
        .reduce((sum, input) => sum + input.value, 0);
      const outputValue = tx.outputs
        .filter(output => output.address === address)
        .reduce((sum, output) => sum + output.value, 0);
      return {
        timestamp: tx.timestamp,
        change: (outputValue - inputValue) / NANOERG_TO_ERG,
      };
    });

    // Build monthly balances working backwards
    const monthlyData: Array<{ month: string; balance: number }> = [];
    let runningBalance = currentBalance;

    for (let i = 0; i < months; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthStart = monthDate.getTime();
      const monthEndTs = monthEnd.getTime();

      // For current month, use current balance
      if (i === 0) {
        monthlyData.unshift({
          month: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          balance: runningBalance,
        });
      } else {
        // Subtract all changes from months after this one to get ending balance
        const changesAfterMonth = txChanges.filter(tx => tx.timestamp > monthEndTs);
        const totalChangeAfter = changesAfterMonth.reduce((sum, tx) => sum + tx.change, 0);
        const balanceAtMonthEnd = currentBalance - totalChangeAfter;

        monthlyData.unshift({
          month: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          balance: Math.max(0, balanceAtMonthEnd),
        });
      }
    }

    return monthlyData;
  }

  /**
   * Get full balance with tokens and their ERG values
   * Marks artwork tokens so they can be filtered from Holdings:
   * - Tokens with amount=1 and decimals=0 (classic NFTs)
   * - Tokens with decimals=0 and EIP-4 R7 artwork type (multi-copy NFTs)
   */
  async getFullBalanceWithPrices(address: string): Promise<{
    ergBalance: number;
    tokens: Array<{
      tokenId: string;
      name: string;
      amount: number;
      decimals: number;
      valueInErg: number;
      isArtwork: boolean;
    }>;
  }> {
    // Fetch balance first
    const balance = await this.getAddressBalance(address);

    // Start with tokens that are definitely NFT-like (amount=1, decimals=0)
    const artworkTokenIds = new Set(
      balance.tokens
        .filter(t => t.amount === 1 && t.decimals === 0)
        .map(t => t.tokenId)
    );

    // Also check R7 for tokens with decimals=0 but amount > 1 (multi-copy NFTs like "Rocket Wolf")
    const potentialMultiCopyNfts = balance.tokens.filter(
      t => t.decimals === 0 && t.amount > 1 && !artworkTokenIds.has(t.tokenId)
    );

    if (potentialMultiCopyNfts.length > 0) {
      console.log(`Checking R7 for ${potentialMultiCopyNfts.length} potential multi-copy NFTs...`);
      const BATCH_SIZE = 5;
      for (let i = 0; i < potentialMultiCopyNfts.length; i += BATCH_SIZE) {
        const batch = potentialMultiCopyNfts.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async t => {
            const assetType = await this.getTokenEip4AssetType(t.tokenId);
            return { tokenId: t.tokenId, isArtwork: assetType !== null };
          })
        );
        for (const { tokenId, isArtwork } of results) {
          if (isArtwork) {
            artworkTokenIds.add(tokenId);
          }
        }
      }
    }

    console.log(`Found ${artworkTokenIds.size} artwork tokens to filter from Holdings`);

    // Extract token IDs for price fetching, excluding artwork tokens
    const tokenIdsForPricing = balance.tokens
      .filter(t => !artworkTokenIds.has(t.tokenId))
      .map(t => t.tokenId);
    const priceMap = await this.getTokenPrices(tokenIdsForPricing, address);

    // Pre-fetch pool cache for LP token value calculation
    const poolCache = await this.getSpectrumPoolCache();

    console.log('Price map size:', priceMap.size);
    console.log('Token IDs:', tokenIdsForPricing.slice(0, 5));

    // Process tokens, calculating LP values separately
    const tokensWithValues = await Promise.all(balance.tokens.map(async t => {
      const amount = t.decimals > 0 ? t.amount / Math.pow(10, t.decimals) : t.amount;
      const isArtwork = artworkTokenIds.has(t.tokenId);
      let valueInErg = 0;

      // Skip value calculation for artwork tokens (they don't have meaningful prices)
      if (!isArtwork) {
        // Check if this is an LP token
        const poolInfo = poolCache.get(t.tokenId);
        if (poolInfo) {
          // This is an LP token - calculate value from pool TVL
          valueInErg = await this.getLpTokenValue(t.tokenId, amount);
          console.log(`LP token ${t.name || t.tokenId.slice(0,8)}: amount=${amount}, value=${valueInErg} ERG`);
        } else {
          // Regular token - use price from priceMap
          const priceInErg = priceMap.get(t.tokenId) || 0;
          valueInErg = amount * priceInErg;
        }
      }

      return {
        tokenId: t.tokenId,
        name: t.name || t.tokenId.slice(0, 8) + '...',
        amount,
        decimals: t.decimals,
        valueInErg,
        isArtwork,
      };
    }));

    return {
      ergBalance: balance.nanoErgs / NANOERG_TO_ERG,
      tokens: tokensWithValues,
    };
  }
}

// Export singleton instance
export const ergoApi = new ErgoApiService();

// Also export class for custom instances
export { ErgoApiService };
