export interface WalletData {
  address: string;
  balance: number;
  transactions: Transaction[];
  holdings: Holding[];
}

export interface Transaction {
  id: string;
  date: Date;
  amount: number;
  type: 'incoming' | 'outgoing';
  status: 'confirmed' | 'pending';
}

export interface Holding {
  token: string;
  tokenId: string;
  amount: number;
  valueInErg: number;
  change24h: number;
  category: 'ERG' | 'Stables' | 'Tokens' | 'Liquidity/Lending';
  beginningBalance: number;
  additions: number;
  reductions: number;
  endingBalance: number;
  lpPairInfo?: {
    lpName: string;
    token1: { id: string; ticker: string };
    token2: { id: string; ticker: string };
  };
  priceUnavailable?: boolean; // True if historical price is not available
  poolType?: 'N2T' | 'T2T'; // LP pool type indicator
}

export interface Alert {
  id: string;
  type: 'warning' | 'info' | 'error';
  message: string;
  expiresAt?: Date;
}

export interface DemurrageBox {
  boxId: string;
  currentAge: number; // in blocks
  demurrageDate: Date;
  valueInErg: number;
}

export interface Collectible {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
  type: 'NFT' | 'Audio' | 'Video' | 'Artwork Collection';
  isNSFW: boolean;
  metadata?: {
    artist?: string;
    collection?: string;
    tokenId?: string;
    duration?: string; // For audio/video tokens
    medium?: string; // For artwork
  };
}