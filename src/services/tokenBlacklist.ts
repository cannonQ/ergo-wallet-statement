/**
 * Token Blacklist Service
 *
 * Fetches and caches the NSFW/Scam token blacklist from Sigmanauts.
 * Source: https://github.com/sigmanauts/token-id-blacklist
 */

const BLACKLIST_URL = 'https://raw.githubusercontent.com/sigmanauts/token-id-blacklist/main/blacklist.json';

interface BlacklistData {
  nsfw: string[];
  scam: string[];
  scam_address: string[];
}

class TokenBlacklistService {
  private blacklist: Set<string> | null = null;
  private scamAddresses: Set<string> | null = null;
  private loading: Promise<void> | null = null;
  private lastFetched: number = 0;

  // Cache for 1 hour (can be refreshed on page reload)
  private readonly CACHE_DURATION = 60 * 60 * 1000;

  /**
   * Load the blacklist from GitHub
   */
  private async loadBlacklist(): Promise<void> {
    // Return cached if still valid
    if (this.blacklist && Date.now() - this.lastFetched < this.CACHE_DURATION) {
      return;
    }

    // Avoid duplicate fetches
    if (this.loading) {
      return this.loading;
    }

    this.loading = (async () => {
      try {
        console.log('Fetching token blacklist from Sigmanauts...');
        const response = await fetch(BLACKLIST_URL, {
          cache: 'no-store', // Always get fresh from GitHub
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch blacklist: ${response.status}`);
        }

        const data: BlacklistData = await response.json();

        // Combine nsfw and scam into a single set for easy lookup
        this.blacklist = new Set([
          ...(data.nsfw || []),
          ...(data.scam || []),
        ]);

        this.scamAddresses = new Set(data.scam_address || []);
        this.lastFetched = Date.now();

        console.log(`Loaded blacklist: ${this.blacklist.size} tokens, ${this.scamAddresses.size} addresses`);
      } catch (error) {
        console.error('Error loading token blacklist:', error);
        // Initialize empty sets on error so app continues working
        this.blacklist = this.blacklist || new Set();
        this.scamAddresses = this.scamAddresses || new Set();
      } finally {
        this.loading = null;
      }
    })();

    return this.loading;
  }

  /**
   * Check if a token ID is blacklisted (NSFW or scam)
   */
  async isBlacklisted(tokenId: string): Promise<boolean> {
    await this.loadBlacklist();
    return this.blacklist?.has(tokenId) ?? false;
  }

  /**
   * Check if an address is a known scam address
   */
  async isScamAddress(address: string): Promise<boolean> {
    await this.loadBlacklist();
    return this.scamAddresses?.has(address) ?? false;
  }

  /**
   * Get the full set of blacklisted token IDs
   */
  async getBlacklistedTokenIds(): Promise<Set<string>> {
    await this.loadBlacklist();
    return this.blacklist || new Set();
  }

  /**
   * Filter an array of items, removing any with blacklisted token IDs
   */
  async filterBlacklisted<T extends { tokenId: string }>(items: T[]): Promise<T[]> {
    await this.loadBlacklist();
    if (!this.blacklist || this.blacklist.size === 0) {
      return items;
    }
    return items.filter(item => !this.blacklist!.has(item.tokenId));
  }

  /**
   * Clear the cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.blacklist = null;
    this.scamAddresses = null;
    this.lastFetched = 0;
    this.loading = null;
  }
}

// Export singleton instance
export const tokenBlacklist = new TokenBlacklistService();

// Also export class for testing
export { TokenBlacklistService };
