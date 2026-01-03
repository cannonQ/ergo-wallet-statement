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

export interface IssuanceBox {
  boxId: string;
  additionalRegisters: {
    R4?: string; // Token name (encoded)
    R5?: string; // Token description (encoded)
    R6?: string; // Token decimals (encoded)
    R7?: string; // Asset type or collection ID
    R8?: string; // SHA256 hash or additional info
    R9?: string; // Artwork URL (encoded as Coll[Byte])
  };
}

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

  /**
   * Get transactions for a specific month (with client-side filtering)
   */
  async getMonthTransactions(
    address: string,
    year: number,
    month: number, // 0-indexed (0 = January)
    limit: number = 20
  ): Promise<{
    transactions: Array<{
      id: string;
      timestamp: Date;
      type: 'incoming' | 'outgoing';
      amount: number;
      status: 'confirmed';
    }>;
    total: number;
  }> {
    // Calculate month start and end timestamps
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const fromTimestamp = startDate.getTime();
    const toTimestamp = endDate.getTime();

    // Fetch more transactions than limit to ensure we get enough for the month
    // The API returns transactions sorted by timestamp descending
    const response = await this.getAddressTransactions(address, {
      limit: 100, // Fetch more to filter
      offset: 0,
    });

    // Filter transactions by timestamp (client-side filtering)
    const filteredTxs = response.items.filter(tx => {
      return tx.timestamp >= fromTimestamp && tx.timestamp <= toTimestamp;
    });

    const transactions = filteredTxs.slice(0, limit).map(tx => {
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

    return {
      transactions,
      total: filteredTxs.length,
    };
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
   * Ergo registers are encoded as: 0e + length (2 hex chars) + hex string
   */
  decodeRegisterToString(hexValue: string): string | null {
    try {
      // Check for Coll[Byte] prefix (0e)
      if (!hexValue.startsWith('0e')) {
        return null;
      }
      // Skip prefix (0e) and length bytes, decode the rest as UTF-8
      const hexContent = hexValue.slice(4); // Skip '0e' + 2 length chars
      const bytes = new Uint8Array(
        hexContent.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  }

  /**
   * Get artwork URL from token's issuance box R9 register
   */
  async getTokenArtworkUrl(tokenId: string): Promise<string | null> {
    const box = await this.getTokenIssuanceBox(tokenId);
    if (!box?.additionalRegisters?.R9) {
      return null;
    }

    const artworkUrl = this.decodeRegisterToString(box.additionalRegisters.R9);
    return artworkUrl;
  }

  /**
   * Convert IPFS URL to gateway URL
   */
  ipfsToGatewayUrl(url: string): string {
    if (url.startsWith('ipfs://')) {
      const hash = url.replace('ipfs://', '');
      return `https://cloudflare-ipfs.com/ipfs/${hash}`;
    }
    return url;
  }

  /**
   * Identify NFTs from token list (tokens with amount = 1 and no decimals)
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
        const [info, artworkUrl] = await Promise.all([
          this.getTokenInfo(token.tokenId),
          this.getTokenArtworkUrl(token.tokenId),
        ]);
        if (!info) return null;

        // Determine type based on name or description
        let type: 'NFT' | 'Audio' | 'Video' | 'Artwork Collection' = 'NFT';
        const nameLower = (info.name || '').toLowerCase();
        const descLower = (info.description || '').toLowerCase();

        if (nameLower.includes('audio') || descLower.includes('audio') || descLower.includes('music')) {
          type = 'Audio';
        } else if (nameLower.includes('video') || descLower.includes('video')) {
          type = 'Video';
        } else if (nameLower.includes('collection') || descLower.includes('collection')) {
          type = 'Artwork Collection';
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
        console.error('Crux positions API error:', response.status);
        return priceMap;
      }

      const data = await response.json();
      console.log('Crux positions response:', JSON.stringify(data).slice(0, 500));

      // Parse the response - Crux returns array of position objects
      // Each position has: tokenId, amount, price (current price in ERG)
      const positions = Array.isArray(data) ? data : data.positions || data.data || [];

      for (const position of positions) {
        // Try different field names for token ID (Crux uses 'id' or 'token_id')
        const tokenId = position.tokenId || position.token_id || position.id;

        // Try different field names for price in ERG
        // Crux API uses: price_erg, priceInfo.erg, price.erg, or value_in_erg
        let price = 0;
        if (position.price_erg !== undefined) {
          price = position.price_erg;
        } else if (position.priceInfo?.erg !== undefined) {
          price = position.priceInfo.erg;
        } else if (position.price?.erg !== undefined) {
          price = position.price.erg;
        } else if (position.value_in_erg !== undefined) {
          price = position.value_in_erg;
        } else if (position.currentPrice !== undefined) {
          price = position.currentPrice;
        } else if (typeof position.price === 'number') {
          price = position.price;
        }

        if (tokenId && price > 0) {
          priceMap.set(tokenId, parseFloat(String(price)));
          console.log(`Token ${tokenId.slice(0,8)}... price: ${price} ERG`);
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
      console.log('Spectrum pools response:', JSON.stringify(pools).slice(0, 500));

      // Process pools to extract token prices - use pool with largest liquidity
      for (const pool of pools) {
        // Pools have x (ERG side) and y (token side) with reserves
        const ergReserve = pool.lockedX?.amount || pool.x?.amount || 0;
        const tokenReserve = pool.lockedY?.amount || pool.y?.amount || 0;
        const tokenId = pool.lockedY?.id || pool.y?.id;

        if (tokenId && ergReserve > 0 && tokenReserve > 0 && tokenIds.includes(tokenId)) {
          // Calculate liquidity value in ERG (TVL proxy)
          const ergDecimals = 9;
          const liquidity = ergReserve / Math.pow(10, ergDecimals);

          // Only update if this pool has more liquidity than previous best
          const currentBest = bestPoolLiquidity.get(tokenId) || 0;
          if (liquidity > currentBest) {
            bestPoolLiquidity.set(tokenId, liquidity);

            // Price = ERG reserve / token reserve (adjusted for decimals)
            const tokenDecimals = pool.lockedY?.decimals || pool.y?.decimals || 0;
            const price = (ergReserve / Math.pow(10, ergDecimals)) /
                          (tokenReserve / Math.pow(10, tokenDecimals));
            priceMap.set(tokenId, price);
            console.log(`Pool price for ${tokenId.slice(0,8)}...: ${price.toFixed(6)} ERG (liquidity: ${liquidity.toFixed(2)} ERG)`);
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
   */
  async getFullBalanceWithPrices(address: string): Promise<{
    ergBalance: number;
    tokens: Array<{
      tokenId: string;
      name: string;
      amount: number;
      decimals: number;
      valueInErg: number;
    }>;
  }> {
    // Fetch balance first
    const balance = await this.getAddressBalance(address);

    // Extract token IDs and fetch prices (pass address for Crux positions endpoint)
    const tokenIds = balance.tokens.map(t => t.tokenId);
    const priceMap = await this.getTokenPrices(tokenIds, address);

    console.log('Price map size:', priceMap.size);
    console.log('Token IDs:', tokenIds.slice(0, 5));

    const tokens = balance.tokens.map(t => {
      const amount = t.decimals > 0 ? t.amount / Math.pow(10, t.decimals) : t.amount;
      const priceInErg = priceMap.get(t.tokenId) || 0;

      return {
        tokenId: t.tokenId,
        name: t.name || t.tokenId.slice(0, 8) + '...',
        amount,
        decimals: t.decimals,
        valueInErg: amount * priceInErg,
      };
    });

    return {
      ergBalance: balance.nanoErgs / NANOERG_TO_ERG,
      tokens,
    };
  }
}

// Export singleton instance
export const ergoApi = new ErgoApiService();

// Also export class for custom instances
export { ErgoApiService };
