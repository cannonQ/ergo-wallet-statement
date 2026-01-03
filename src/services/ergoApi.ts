// Ergo Explorer API Service
// API Documentation: https://api.ergoplatform.com/docs/openapi

const API_BASE_URL = 'https://api-p2p.ergoplatform.com/api/v1';

// Ergo has 10^9 nanoErgs per ERG
const NANOERG_TO_ERG = 1_000_000_000;

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
}

export interface Asset {
  tokenId: string;
  amount: number;
  name?: string;
  decimals?: number;
}

export interface AddressInfo {
  address: string;
  balance: {
    nanoErgs: number;
    tokens: TokenBalance[];
  };
}

class ErgoApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch total balance for an address (confirmed balance)
   */
  async getAddressBalance(address: string): Promise<BalanceResponse> {
    const response = await fetch(`${this.baseUrl}/addresses/${address}/balance/total`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Address not found or has no transaction history');
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

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Address not found');
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get transactions for a specific month
   */
  async getMonthlyTransactions(
    address: string,
    year: number,
    month: number // 0-indexed (0 = January)
  ): Promise<Transaction[]> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const fromTimestamp = startDate.getTime();
    const toTimestamp = endDate.getTime();

    const allTransactions: Transaction[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getAddressTransactions(address, {
        offset,
        limit,
        fromTimestamp,
        toTimestamp,
      });

      allTransactions.push(...response.items);
      offset += limit;
      hasMore = response.items.length === limit && allTransactions.length < response.total;
    }

    return allTransactions;
  }

  /**
   * Calculate ERG flow for an address from transactions
   * Returns { additions: total ERG received, reductions: total ERG sent }
   */
  calculateErgFlow(
    transactions: Transaction[],
    address: string
  ): { additions: number; reductions: number } {
    let additions = 0;
    let reductions = 0;

    for (const tx of transactions) {
      // Sum ERG from inputs belonging to this address (money leaving)
      const inputValue = tx.inputs
        .filter(input => input.address === address)
        .reduce((sum, input) => sum + input.value, 0);

      // Sum ERG from outputs belonging to this address (money coming in)
      const outputValue = tx.outputs
        .filter(output => output.address === address)
        .reduce((sum, output) => sum + output.value, 0);

      // Net change for this transaction
      const netChange = outputValue - inputValue;

      if (netChange > 0) {
        additions += netChange;
      } else {
        reductions += Math.abs(netChange);
      }
    }

    return {
      additions: additions / NANOERG_TO_ERG,
      reductions: reductions / NANOERG_TO_ERG,
    };
  }

  /**
   * Get statement data for a specific month
   */
  async getMonthlyStatement(
    address: string,
    year: number,
    month: number
  ): Promise<{
    endingBalance: number;
    additions: number;
    reductions: number;
    beginningBalance: number;
    transactions: Transaction[];
  }> {
    // Get current balance and transactions in parallel
    const [currentBalance, transactions] = await Promise.all([
      this.getErgBalance(address),
      this.getMonthlyTransactions(address, year, month),
    ]);

    // Calculate flow from transactions
    const flow = this.calculateErgFlow(transactions, address);

    // The ending balance is the current balance (assuming we're looking at current month)
    // For historical months, we'd need to calculate backwards
    const endingBalance = currentBalance;
    const beginningBalance = endingBalance - flow.additions + flow.reductions;

    return {
      endingBalance,
      additions: flow.additions,
      reductions: flow.reductions,
      beginningBalance,
      transactions,
    };
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
