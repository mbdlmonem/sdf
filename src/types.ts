export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
}

export interface PriceAlert {
  id: string;
  pairAddress: string;
  symbol: string;
  targetPrice: number;
  condition: "above" | "below";
  createdAt: number;
  triggered?: boolean;
}

export interface PortfolioItem {
  pairAddress: string;
  symbol: string;
  amount: number;
  chainId: string;
}

export interface TradeLog {
  id: string;
  pairAddress: string;
  symbol: string;
  price: number;
  type: "entry" | "exit";
  timestamp: number;
}

export interface SearchResponse {
  schemaVersion: string;
  pairs: DexPair[];
}
