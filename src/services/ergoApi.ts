// Ergo Explorer API Service
// API Documentation: https://api.ergoplatform.com/docs/openapi

// Use the public Ergo Explorer API
const API_BASE_URL = 'https://api.ergoplatform.com/api/v1';

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
   * Get recent transactions (limited to avoid heavy loading)
   */
  async getRecentTransactions(
    address: string,
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
    const response = await this.getAddressTransactions(address, { limit, offset: 0 });

    const transactions = response.items.map(tx => {
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
      total: response.total,
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
   * Identify NFTs from token list (tokens with amount = 1 and no decimals)
   */
  async getNFTs(tokens: TokenBalance[]): Promise<Array<{
    tokenId: string;
    name: string;
    description: string;
    type: 'NFT' | 'Audio' | 'Video' | 'Artwork Collection';
  }>> {
    // Filter potential NFTs (amount = 1, decimals = 0)
    const potentialNFTs = tokens.filter(t => t.amount === 1 && t.decimals === 0);

    // Fetch info for each potential NFT
    const nfts = await Promise.all(
      potentialNFTs.slice(0, 20).map(async (token) => {
        const info = await this.getTokenInfo(token.tokenId);
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
}

// Export singleton instance
export const ergoApi = new ErgoApiService();

// Also export class for custom instances
export { ErgoApiService };
