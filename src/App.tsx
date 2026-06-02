/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Search, History, TrendingUp, Flame, Star, Menu, X, Coins, ExternalLink, ArrowUpRight, ArrowDownLeft, Activity, BarChart3, Clock, Bell, Trash2, ChevronRight, Briefcase, Plus, Minus, Save, Wallet, TrendingDown, FileText, CheckCircle2, RefreshCcw, ArrowDown } from "lucide-react";
import { useState, useEffect, useMemo, useCallback, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, ReferenceLine, Label } from 'recharts';
import { DexPair, SearchResponse, PriceAlert, PortfolioItem, TradeLog } from "./types";
import { cn, formatUsd, formatNumber } from "./utils";
import { formatDistanceToNow } from "date-fns";

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPair, setSelectedPair] = useState<DexPair | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("trending");

  // Cache for trending data to prevent slow re-loads
  const trendingCache = useMemo<{ data: DexPair[] | null; lastFetched: number }>(() => ({
    data: null,
    lastFetched: 0
  }), []);

  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem("watchlist");
    return saved ? JSON.parse(saved) : [];
  });
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    const saved = localStorage.getItem("price_alerts");
    return saved ? JSON.parse(saved) : [];
  });
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() => {
    const saved = localStorage.getItem("portfolio");
    return saved ? JSON.parse(saved) : [];
  });
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>(() => {
    const saved = localStorage.getItem("trade_logs");
    return saved ? JSON.parse(saved) : [];
  });
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: "alert" }[]>([]);

  // Alert Modal state
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCondition, setAlertCondition] = useState<"above" | "below">("above");

  // Portfolio Modal state
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const [portfolioAmount, setPortfolioAmount] = useState("");

  // Trade Log Modal state
  const [isTradeLogModalOpen, setIsTradeLogModalOpen] = useState(false);
  const [tradePrice, setTradePrice] = useState("");
  const [tradeType, setTradeType] = useState<"entry" | "exit">("entry");

  // Swap Modal state
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapAmountIn, setSwapAmountIn] = useState("");
  const [swapInToken, setSwapInToken] = useState<"SOL" | "TOKEN">("SOL");

  const addNotification = (message: string) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message, type: "alert" }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const fetchPairs = useCallback(async (query: string, useCache = false) => {
    // If it's a "trending" request and we have fresh cache (within 2 mins), use it
    if (useCache && trendingCache.data && Date.now() - trendingCache.lastFetched < 120000) {
      setPairs(trendingCache.data);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    setLoading(true);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal
      });
      const data: SearchResponse = await res.json();
      const results = data.pairs || [];
      
      setPairs(results);
      
      // Update cache forTrending
      if (useCache) {
        trendingCache.data = results;
        trendingCache.lastFetched = Date.now();
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted - newer request or timeout');
      } else {
        console.error("Failed to fetch pairs:", error);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [trendingCache]);

  // Fetch some initial trending pairs
  useEffect(() => {
    fetchPairs("solana", true); // Use cache for initial load
  }, [fetchPairs]);

  useEffect(() => {
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem("price_alerts", JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem("portfolio", JSON.stringify(portfolio));
  }, [portfolio]);

  useEffect(() => {
    localStorage.setItem("trade_logs", JSON.stringify(tradeLogs));
  }, [tradeLogs]);

  // Price Monitoring Effect
  useEffect(() => {
    const checkAlerts = () => {
      const activeAlerts = alerts.filter(a => !a.triggered);
      if (activeAlerts.length === 0) return;

      let triggeredAny = false;
      const newAlerts = alerts.map(alert => {
        const pair = pairs.find(p => p.pairAddress === alert.pairAddress);
        if (!pair || alert.triggered) return alert;

        const currentPrice = parseFloat(pair.priceUsd);
        const targetPrice = alert.targetPrice;

        const isTriggered = alert.condition === "above" 
          ? currentPrice >= targetPrice 
          : currentPrice <= targetPrice;

        if (isTriggered) {
          triggeredAny = true;
          addNotification(`${alert.symbol} hit your target of ${formatUsd(targetPrice)}!`);
          return { ...alert, triggered: true };
        }
        return alert;
      });

      if (triggeredAny) {
        setAlerts(newAlerts);
      }
    };

    const interval = setInterval(checkAlerts, 5000);
    return () => clearInterval(interval);
  }, [alerts, pairs]);


  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchPairs(searchQuery, false);
      setActiveTab("search");
    }
  };

  const toggleWatchlist = (pairAddress: string) => {
    setWatchlist(prev => 
      prev.includes(pairAddress) 
        ? prev.filter(a => a !== pairAddress) 
        : [...prev, pairAddress]
    );
  };

  const addAlert = () => {
    if (!selectedPair || !alertPrice) return;
    
    const newAlert: PriceAlert = {
      id: Math.random().toString(36).substring(7),
      pairAddress: selectedPair.pairAddress,
      symbol: selectedPair.baseToken.symbol,
      targetPrice: parseFloat(alertPrice),
      condition: alertCondition,
      createdAt: Date.now(),
    };

    setAlerts(prev => [...prev, newAlert]);
    setIsAlertModalOpen(false);
    setAlertPrice("");
    addNotification(`Alert set for ${selectedPair.baseToken.symbol} at ${formatUsd(newAlert.targetPrice)}`);
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const addTradeLog = () => {
    if (!selectedPair || !tradePrice) return;
    
    const newLog: TradeLog = {
      id: Math.random().toString(36).substring(7),
      pairAddress: selectedPair.pairAddress,
      symbol: selectedPair.baseToken.symbol,
      price: parseFloat(tradePrice),
      type: tradeType,
      timestamp: Date.now(),
    };

    setTradeLogs(prev => [...prev, newLog]);
    setIsTradeLogModalOpen(false);
    setTradePrice("");
    addNotification(`${tradeType === "entry" ? "Entry" : "Exit"} price logged for ${selectedPair.baseToken.symbol}`);
  };

  const executeSwap = () => {
    if (!selectedPair || !swapAmountIn) return;
    
    const amountIn = parseFloat(swapAmountIn);
    const price = parseFloat(selectedPair.priceUsd);
    // Rough simulation of a SOL price for simplicity if swapInToken is SOL
    const solPrice = 145.50; 
    
    let amountOut = 0;
    let symbolOut = "";
    
    if (swapInToken === "SOL") {
      amountOut = (amountIn * solPrice) / price;
      symbolOut = selectedPair.baseToken.symbol;
      
      // Update portfolio (add token)
      setPortfolio(prev => {
        const existing = prev.find(item => item.pairAddress === selectedPair.pairAddress);
        if (existing) {
          return prev.map(item => item.pairAddress === selectedPair.pairAddress ? { ...item, amount: item.amount + amountOut } : item);
        }
        return [...prev, {
          pairAddress: selectedPair.pairAddress,
          symbol: selectedPair.baseToken.symbol,
          amount: amountOut,
          chainId: selectedPair.chainId
        }];
      });
    } else {
      amountOut = (amountIn * price) / solPrice;
      symbolOut = "SOL";
      
      // Update portfolio (reduce token)
      setPortfolio(prev => {
        const existing = prev.find(item => item.pairAddress === selectedPair.pairAddress);
        if (existing) {
          const newAmount = Math.max(0, existing.amount - amountIn);
          if (newAmount === 0) return prev.filter(item => item.pairAddress !== selectedPair.pairAddress);
          return prev.map(item => item.pairAddress === selectedPair.pairAddress ? { ...item, amount: newAmount } : item);
        }
        return prev;
      });
    }

    setIsSwapModalOpen(false);
    setSwapAmountIn("");
    addNotification(`Successfully swapped ${swapAmountIn} ${swapInToken === "SOL" ? "SOL" : selectedPair.baseToken.symbol} for ${amountOut.toFixed(4)} ${symbolOut}`);
  };

  const removeTradeLog = (id: string) => {
    setTradeLogs(prev => prev.filter(l => l.id !== id));
  };

  const updatePortfolio = () => {
    if (!selectedPair || !portfolioAmount) return;
    
    const amount = parseFloat(portfolioAmount);
    setPortfolio(prev => {
      const existing = prev.find(item => item.pairAddress === selectedPair.pairAddress);
      if (existing) {
        if (amount === 0) return prev.filter(item => item.pairAddress !== selectedPair.pairAddress);
        return prev.map(item => item.pairAddress === selectedPair.pairAddress ? { ...item, amount } : item);
      }
      return [...prev, {
        pairAddress: selectedPair.pairAddress,
        symbol: selectedPair.baseToken.symbol,
        amount,
        chainId: selectedPair.chainId
      }];
    });
    setIsPortfolioModalOpen(false);
    setPortfolioAmount("");
    addNotification(`Portfolio updated for ${selectedPair.baseToken.symbol}`);
  };

  const sidebarItems = [
    { id: "trending", icon: TrendingUp, label: "Trending" },
    { id: "watchlist", icon: Star, label: "Watchlist" },
    { id: "portfolio", icon: Briefcase, label: "Portfolio" },
    { id: "alerts", icon: Bell, label: "Price Alerts" },
    { id: "history", icon: History, label: "Multichart" },
  ];

  const portfolioStats = useMemo(() => {
    let totalValue = 0;
    const items = portfolio.map(item => {
      const pair = pairs.find(p => p.pairAddress === item.pairAddress);
      const price = pair ? parseFloat(pair.priceUsd) : 0;
      const value = item.amount * price;
      totalValue += value;
      return { ...item, price, value };
    });
    return { items, totalValue };
  }, [portfolio, pairs]);

  const filteredPairs = useMemo(() => {
    if (activeTab === "watchlist") {
      return pairs.filter(p => watchlist.includes(p.pairAddress));
    }
    return pairs;
  }, [pairs, activeTab, watchlist]);

  const sparklineData = useMemo(() => {
    if (!selectedPair) return [];
    
    const currentPrice = parseFloat(selectedPair.priceUsd);
    const change24h = selectedPair.priceChange.h24;
    const startPrice = currentPrice / (1 + change24h / 100);
    
    const points = 24;
    const data = [];
    
    for (let i = 0; i <= points; i++) {
      // Linear interpolation with a bit of "noise"
      const t = i / points;
      const basePrice = startPrice + (currentPrice - startPrice) * t;
      // Add +/- 1.5% random noise except for the last point which must be exact
      const noise = i === points ? 0 : (Math.random() - 0.5) * (basePrice * 0.015);
      data.push({
        time: `${i}h`,
        price: basePrice + noise
      });
    }
    return data;
  }, [selectedPair]);

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      {/* Notifications Portal */}
      <div className="fixed top-20 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="bg-blue-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 pointer-events-auto border border-white/20"
            >
              <Bell className="w-5 h-5" />
              <span className="text-sm font-semibold">{n.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-[#0d0e11] border-r border-subtle transition-all duration-300 flex flex-col z-50",
          isSidebarOpen ? "w-64" : "w-16"
        )}
      >
        <div className="p-4 flex items-center gap-3 border-b border-subtle h-16 shrink-0">
          <div className="bg-blue-600 p-1.5 rounded-lg shrink-0">
            <Coins className="w-5 h-5 text-white" />
          </div>
          {isSidebarOpen && <span className="font-bold text-lg tracking-tight">DEXSCREENER</span>}
        </div>

        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 hover:bg-[#1c2128] transition-colors group relative",
                activeTab === item.id && "text-blue-500 bg-blue-500/5"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              {!isSidebarOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-black text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
              {item.id === "alerts" && alerts.filter(a => !a.triggered).length > 0 && (
                <div className="absolute right-4 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>
          ))}
        </nav>

        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-4 hover:bg-[#1c2128] border-t border-subtle flex items-center justify-center shrink-0"
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0b0e11]">
        {/* Header */}
        <header className="h-16 border-b border-subtle bg-[#0b0e11]/80 backdrop-blur-md flex items-center px-6 gap-6 sticky top-0 z-40 shrink-0">
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text"
              placeholder="Search by token, pair or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1c2128] border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
            />
          </form>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 text-xs text-secondary">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Mainnet</span>
              <span className="flex items-center gap-1.5 underline cursor-pointer">Connect Wallet</span>
            </div>
          </div>
        </header>

        {/* Dynamic Layout */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Token List or Alerts List */}
          <div className={cn(
            "flex-1 overflow-y-auto p-6 scrollbar-hide",
            selectedPair ? "md:max-w-[40%] border-r border-subtle" : "w-full"
          )}>
            {activeTab === "alerts" ? (
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <h1 className="text-2xl font-bold flex items-center gap-3">
                    <Bell className="w-6 h-6 text-blue-500" />
                    Price Alerts
                  </h1>
                </div>

                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-secondary text-center p-8 border border-dashed border-subtle rounded-3xl">
                    <Bell className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-medium">No alerts set yet</p>
                    <p className="text-xs mt-1">Select a token to set your first custom price alert</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.sort((a, b) => b.createdAt - a.createdAt).map(alert => (
                      <div key={alert.id} className="bg-[#1c2128]/40 border border-subtle p-4 rounded-2xl flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                            alert.triggered ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-500"
                          )}>
                            {alert.symbol[0]}
                          </div>
                          <div>
                            <div className="font-bold flex items-center gap-2">
                              {alert.symbol}
                              {alert.triggered && <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded uppercase">Triggered</span>}
                            </div>
                            <div className="text-xs text-secondary flex items-center gap-1">
                              Price {alert.condition} <span className="text-white font-mono">{formatUsd(alert.targetPrice)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right text-[10px] text-secondary hidden sm:block">
                            {formatDistanceToNow(alert.createdAt)} ago
                          </div>
                          <button 
                            onClick={() => removeAlert(alert.id)}
                            className="p-2 hover:bg-red-500/20 text-secondary hover:text-red-500 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === "portfolio" ? (
              <div className="max-w-4xl mx-auto">
                <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 p-8 rounded-3xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h1 className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-2">Total Portfolio Value</h1>
                    <div className="text-5xl font-mono font-bold tracking-tighter">{formatUsd(portfolioStats.totalValue)}</div>
                  </div>
                  <div className="bg-[#0b0e11]/50 backdrop-blur-md border border-white/5 p-4 rounded-2xl flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Assets</div>
                      <div className="text-xl font-mono font-bold">{portfolio.length}</div>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">24h Change</div>
                      <div className="text-xl font-mono font-bold text-green-500">+12.4%</div>
                    </div>
                  </div>
                </div>

                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-secondary" />
                  Your Assets
                </h2>

                {portfolio.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-secondary text-center p-8 border border-dashed border-subtle rounded-3xl">
                    <Briefcase className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-medium">Portfolio is empty</p>
                    <p className="text-xs mt-1">Select a token to add it to your holdings</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {portfolioStats.items.map(item => (
                      <div 
                        key={item.pairAddress} 
                        onClick={() => {
                          const pair = pairs.find(p => p.pairAddress === item.pairAddress);
                          if (pair) setSelectedPair(pair);
                        }}
                        className="bg-[#1c2128]/40 border border-subtle p-5 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-blue-500/30 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-600/10 text-blue-500 flex items-center justify-center font-bold text-lg">
                            {item.symbol[0]}
                          </div>
                          <div>
                            <div className="font-bold flex items-center gap-2">
                              {item.symbol}
                              <span className="text-[10px] text-secondary font-mono tracking-tighter uppercase">{item.chainId}</span>
                            </div>
                            <div className="text-xs text-secondary font-mono">
                              {item.amount} {item.symbol}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-lg">{formatUsd(item.value)}</div>
                          <div className="text-[10px] text-secondary font-mono">@ {formatUsd(item.price)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold capitalize">{activeTab} Pairs</h1>
                  <div className="flex gap-2">
                    {['5M', '1H', '6H', '24H'].map(tf => (
                      <button key={tf} className="px-3 py-1 text-[10px] font-bold bg-[#1c2128] rounded-md hover:bg-blue-600 transition-colors uppercase">
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPairs.length === 0 ? (
                      <div className="text-center py-20 text-secondary">No pairs found in this view</div>
                    ) : (
                      filteredPairs.map((pair) => (
                        <motion.div
                          layout
                          key={pair.pairAddress}
                          onClick={() => setSelectedPair(pair)}
                          className={cn(
                            "group p-4 rounded-2xl border border-subtle hover:border-blue-500/50 cursor-pointer transition-all",
                            selectedPair?.pairAddress === pair.pairAddress ? "bg-blue-500/10 border-blue-500/50" : "bg-[#1c2128]/40"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-sm shadow-lg">
                                {pair.baseToken.symbol[0]}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{pair.baseToken.symbol}</span>
                                  <span className="text-xs text-secondary">/ {pair.quoteToken.symbol}</span>
                                </div>
                                <div className="text-[10px] text-secondary uppercase tracking-wider">{pair.chainId}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold">{formatUsd(pair.priceUsd)}</div>
                              <div className={cn(
                                "text-xs font-medium flex items-center justify-end gap-1",
                                pair.priceChange.h24 >= 0 ? "text-green-500" : "text-red-500"
                              )}>
                                {pair.priceChange.h24 >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                                {Math.abs(pair.priceChange.h24).toFixed(2)}%
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-subtle/50">
                            <div>
                              <div className="text-[10px] text-secondary mb-1">Vol 24H</div>
                              <div className="text-xs font-mono">{formatUsd(pair.volume.h24)}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-secondary mb-1">Liquidity</div>
                              <div className="text-xs font-mono">{formatUsd(pair.liquidity?.usd)}</div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                              <div className="text-[10px] text-secondary mb-1">Alerts</div>
                              <div className="flex items-center gap-1">
                                {alerts.filter(a => a.pairAddress === pair.pairAddress).map(a => (
                                  <div key={a.id} className={cn("w-1.5 h-1.5 rounded-full", a.triggered ? "bg-green-500" : "bg-blue-500")} />
                                ))}
                                {alerts.filter(a => a.pairAddress === pair.pairAddress).length === 0 && <span className="text-secondary opacity-30">—</span>}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Details Pane */}
          <AnimatePresence>
            {selectedPair && (
              <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                className="flex-1 flex flex-col overflow-hidden bg-[#0b0e11]"
              >
                <div className="p-6 border-b border-subtle flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setSelectedPair(null)}
                      className="md:hidden p-2 hover:bg-[#1c2128] rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold">{selectedPair.baseToken.name}</h2>
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleWatchlist(selectedPair.pairAddress); }}
                          className={cn(
                            "p-1.5 rounded-full transition-colors",
                            watchlist.includes(selectedPair.pairAddress) ? "text-yellow-500 bg-yellow-500/10" : "text-secondary hover:bg-[#1c2128]"
                          )}
                        >
                          <Star className="w-4 h-4 fill-current" />
                        </button>
                        <button 
                          onClick={() => setIsAlertModalOpen(true)}
                          className="p-1.5 text-secondary hover:text-blue-500 hover:bg-[#1c2128] rounded-full transition-colors"
                        >
                          <Bell className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            const existing = portfolio.find(item => item.pairAddress === selectedPair.pairAddress);
                            setPortfolioAmount(existing ? existing.amount.toString() : "");
                            setIsPortfolioModalOpen(true);
                          }}
                          className={cn(
                            "p-1.5 rounded-full transition-colors",
                            portfolio.find(item => item.pairAddress === selectedPair.pairAddress) ? "text-blue-500 bg-blue-500/10" : "text-secondary hover:bg-[#1c2128]"
                          )}
                        >
                          <Briefcase className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setTradePrice(selectedPair.priceUsd);
                            setIsTradeLogModalOpen(true);
                          }}
                          className="p-1.5 text-secondary hover:text-green-500 hover:bg-[#1c2128] rounded-full transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setSwapAmountIn("");
                            setIsSwapModalOpen(true);
                          }}
                          className="p-1.5 text-secondary hover:text-blue-400 hover:bg-[#1c2128] rounded-full transition-colors"
                        >
                          <RefreshCcw className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-secondary">
                        <span className="font-mono">{selectedPair.pairAddress.slice(0, 6)}...{selectedPair.pairAddress.slice(-4)}</span>
                        <ExternalLink className="w-3 h-3 cursor-pointer hover:text-white" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-2xl font-mono font-bold">{formatUsd(selectedPair.priceUsd)}</div>
                      <div className="text-xs text-secondary font-mono tracking-wider uppercase">Price USD</div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto relative">
                  {/* Swap UI Overlay */}
                  <AnimatePresence>
                    {isSwapModalOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute inset-x-0 top-0 z-50 p-6 bg-[#0d0e11]/95 backdrop-blur-md border-b border-blue-500/30"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-bold flex items-center gap-2"><RefreshCcw className="w-4 h-4 text-blue-500" /> Swap Tokens</h3>
                          <button onClick={() => setIsSwapModalOpen(false)}><X className="w-4 h-4" /></button>
                        </div>
                        
                        <div className="space-y-2 mb-6">
                          {/* Pay Section */}
                          <div className="bg-[#1c2128] p-4 rounded-2xl border border-subtle">
                            <div className="flex justify-between mb-2">
                              <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">You Pay</span>
                              <span className="text-[10px] text-secondary">Balance: {swapInToken === "SOL" ? "1.42 SOL" : `${portfolio.find(i => i.pairAddress === selectedPair.pairAddress)?.amount?.toFixed(2) || '0'} ${selectedPair.baseToken.symbol}`}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input 
                                type="number"
                                value={swapAmountIn}
                                onChange={e => setSwapAmountIn(e.target.value)}
                                placeholder="0.00"
                                className="flex-1 bg-transparent text-xl font-mono font-bold outline-none"
                              />
                              <div className="flex items-center gap-2 bg-[#0b0e11] px-3 py-1.5 rounded-xl border border-subtle">
                                <span className="font-bold text-sm">{swapInToken === "SOL" ? "SOL" : selectedPair.baseToken.symbol}</span>
                              </div>
                            </div>
                          </div>

                          {/* Reverse Button */}
                          <div className="flex justify-center -my-4 relative z-10">
                            <button 
                              onClick={() => setSwapInToken(prev => prev === "SOL" ? "TOKEN" : "SOL")}
                              className="bg-[#1c2128] p-2 rounded-xl border border-subtle hover:border-blue-500/50 transition-colors shadow-xl"
                            >
                              <ArrowDown className="w-4 h-4 text-blue-500" />
                            </button>
                          </div>

                          {/* Receive Section */}
                          <div className="bg-[#1c2128] p-4 rounded-2xl border border-subtle">
                            <div className="flex justify-between mb-2">
                              <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">You Receive</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 text-xl font-mono font-bold text-white/40">
                                {swapAmountIn ? (swapInToken === "SOL" ? (parseFloat(swapAmountIn) * 145.5 / parseFloat(selectedPair.priceUsd)).toFixed(4) : (parseFloat(swapAmountIn) * parseFloat(selectedPair.priceUsd) / 145.5).toFixed(6)) : "0.00"}
                              </div>
                              <div className="flex items-center gap-2 bg-[#0b0e11] px-3 py-1.5 rounded-xl border border-subtle">
                                <span className="font-bold text-sm">{swapInToken === "SOL" ? selectedPair.baseToken.symbol : "SOL"}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={executeSwap}
                          disabled={!swapAmountIn}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-colors text-sm shadow-lg shadow-blue-500/20"
                        >
                          Swap Now
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Trade Log UI Overlay */}
                  <AnimatePresence>
                    {isTradeLogModalOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute inset-x-0 top-0 z-50 p-6 bg-[#0d0e11]/95 backdrop-blur-md border-b border-green-500/30"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-green-500" /> Log Trade Price</h3>
                          <button onClick={() => setIsTradeLogModalOpen(false)}><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex gap-4 mb-4">
                          <div className="flex-1">
                            <label className="text-[10px] text-secondary uppercase font-bold tracking-widest block mb-1">Price (USD)</label>
                            <input 
                              type="number" 
                              value={tradePrice}
                              onChange={e => setTradePrice(e.target.value)}
                              className="w-full bg-[#1c2128] border border-subtle rounded-xl py-2 px-4 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow font-mono"
                            />
                          </div>
                          <div className="w-32">
                            <label className="text-[10px] text-secondary uppercase font-bold tracking-widest block mb-1">Type</label>
                            <select 
                              value={tradeType}
                              onChange={e => setTradeType(e.target.value as any)}
                              className="w-full bg-[#1c2128] border border-subtle rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none appearance-none"
                            >
                              <option value="entry">Entry</option>
                              <option value="exit">Exit</option>
                            </select>
                          </div>
                        </div>
                        <button 
                          onClick={addTradeLog}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
                        >
                          Log Trade Point
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Portfolio Asset UI Overlay */}
                  <AnimatePresence>
                    {isPortfolioModalOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute inset-x-0 top-0 z-50 p-6 bg-[#0d0e11]/95 backdrop-blur-md border-b border-blue-500/30"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold flex items-center gap-2"><Briefcase className="w-4 h-4 text-blue-500" /> Track Holdings</h3>
                          <button onClick={() => setIsPortfolioModalOpen(false)}><X className="w-4 h-4" /></button>
                        </div>
                        <div className="mb-4">
                          <label className="text-[10px] text-secondary uppercase font-bold tracking-widest block mb-1">Amount of {selectedPair.baseToken.symbol}</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              value={portfolioAmount}
                              onChange={e => setPortfolioAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-[#1c2128] border border-subtle rounded-xl py-3 px-4 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow font-mono"
                            />
                          </div>
                          <p className="text-[10px] text-secondary mt-2">Current Value: <span className="text-white font-mono">{formatUsd(parseFloat(portfolioAmount || "0") * parseFloat(selectedPair.priceUsd))}</span></p>
                        </div>
                        <div className="flex gap-3">
                           <button 
                            onClick={() => setIsPortfolioModalOpen(false)}
                            className="flex-1 bg-[#1c2128] hover:bg-[#252a33] text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={updatePortfolio}
                            className="flex-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Save Position
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Alert Creation UI Overlay (Conditional) */}
                  <AnimatePresence>
                    {isAlertModalOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute inset-x-0 top-0 z-50 p-6 bg-[#0d0e11]/95 backdrop-blur-md border-b border-blue-500/30"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold flex items-center gap-2"><Bell className="w-4 h-4 text-blue-500" /> Set Price Alert</h3>
                          <button onClick={() => setIsAlertModalOpen(false)}><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex gap-4 mb-4">
                          <div className="flex-1">
                            <label className="text-[10px] text-secondary uppercase font-bold tracking-widest block mb-1">Target Price (USD)</label>
                            <input 
                              type="number" 
                              value={alertPrice}
                              onChange={e => setAlertPrice(e.target.value)}
                              placeholder={selectedPair.priceUsd}
                              className="w-full bg-[#1c2128] border border-subtle rounded-xl py-2 px-4 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
                            />
                          </div>
                          <div className="w-32">
                            <label className="text-[10px] text-secondary uppercase font-bold tracking-widest block mb-1">Condition</label>
                            <select 
                              value={alertCondition}
                              onChange={e => setAlertCondition(e.target.value as any)}
                              className="w-full bg-[#1c2128] border border-subtle rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none appearance-none"
                            >
                              <option value="above">Above</option>
                              <option value="below">Below</option>
                            </select>
                          </div>
                        </div>
                        <button 
                          onClick={addAlert}
                          disabled={!alertPrice}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
                        >
                          Create Alert
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Chart Container */}
                  <div className="aspect-video bg-[#0d0e11] w-full relative">
                    <iframe 
                      title="TradingView Chart"
                      src={`https://www.tradingview.com/widgetembed/?frameElementId=tradingview_762ae&symbol=${selectedPair.chainId}:${selectedPair.baseToken.symbol}${selectedPair.quoteToken.symbol}&interval=1&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=Etc%2FUTC`}
                      className="w-full h-full border-none"
                    />
                  </div>

                  {/* Token Details Matrix */}
                  <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Market Cap" value={formatUsd(selectedPair.fdv)} icon={BarChart3} />
                    <StatCard label="Liquidity" value={formatUsd(selectedPair.liquidity?.usd)} icon={Activity} />
                    <StatCard label="24h Volume" value={formatUsd(selectedPair.volume.h24)} icon={BarChart3} />
                    <StatCard label="Pooled {symbol}" value={formatNumber(selectedPair.liquidity?.base)} symbol={selectedPair.baseToken.symbol} icon={Coins} />
                  </div>

                  {/* Active Alerts for this Token */}
                  {alerts.filter(a => a.pairAddress === selectedPair.pairAddress).length > 0 && (
                    <div className="px-6 pb-6">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-3 flex items-center gap-2">Active Alerts for {selectedPair.baseToken.symbol}</h3>
                      <div className="space-y-2">
                        {alerts.filter(a => a.pairAddress === selectedPair.pairAddress).map(alert => (
                          <div key={alert.id} className="p-3 bg-[#1c2128]/40 border border-subtle rounded-xl flex items-center justify-between text-xs">
                           <span>Price {alert.condition} <span className="font-mono font-bold text-blue-500">{formatUsd(alert.targetPrice)}</span></span>
                           <button onClick={() => removeAlert(alert.id)} className="text-secondary hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trade Logs List */}
                  {tradeLogs.filter(l => l.pairAddress === selectedPair.pairAddress).length > 0 && (
                    <div className="px-6 pb-6">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-3 flex items-center gap-2">Trade Markers for {selectedPair.baseToken.symbol}</h3>
                      <div className="space-y-2">
                        {tradeLogs.filter(a => a.pairAddress === selectedPair.pairAddress).map(log => (
                          <div key={log.id} className="p-3 bg-[#1c2128]/40 border border-subtle rounded-xl flex items-center justify-between text-xs">
                           <span className="flex items-center gap-2">
                             <span className={cn("px-1.5 py-0.5 rounded-[4px] font-bold text-[9px] uppercase", log.type === "entry" ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500")}>{log.type}</span>
                             <span className="font-mono font-bold">{formatUsd(log.price)}</span>
                           </span>
                           <button onClick={() => removeTradeLog(log.id)} className="text-secondary hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Performance Grid */}
                  <div className="px-6 pb-6">
                    <div className="bg-[#1c2128]/40 rounded-2xl border border-subtle overflow-hidden">
                      <div className="grid grid-cols-4 border-b border-subtle">
                        {['5M', '1H', '6H', '24H'].map(label => (
                          <div key={label} className="p-3 text-[10px] font-bold text-center border-r last:border-r-0 border-subtle uppercase tracking-widest text-secondary">{label}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-4">
                        {[selectedPair.priceChange.m5, selectedPair.priceChange.h1, selectedPair.priceChange.h6, selectedPair.priceChange.h24].map((change, i) => (
                          <div key={i} className={cn(
                            "p-4 text-center border-r last:border-r-0 border-subtle font-mono font-bold",
                            change >= 0 ? "text-green-500" : "text-red-500"
                          )}>
                            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* TX History Placeholder */}
                  <div className="px-6 pb-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-secondary mb-4 flex items-center gap-2">
                       Recent Transactions
                    </h3>
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[#1c2128]/20 border border-subtle/30 text-xs text-secondary/80">
                          <div className="flex items-center gap-3">
                            <span className={cn("px-1.5 py-0.5 rounded font-bold", i % 2 === 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                              {i % 2 === 0 ? 'BUY' : 'SELL'}
                            </span>
                            <span className="font-mono">0x{Math.random().toString(16).slice(2, 8)}...</span>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              <div className="font-mono font-bold text-white">{(Math.random() * 5).toFixed(2)} {selectedPair.baseToken.symbol}</div>
                              <div className="text-[10px]">{formatUsd(Math.random() * 500)}</div>
                            </div>
                            <div className="opacity-50"><Clock className="w-3 h-3" /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sparkline Section */}
                  <div className="px-6 pb-12">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-secondary flex items-center gap-2">
                        24H Price Trend
                      </h3>
                      <div className={cn(
                        "text-xs font-mono font-bold px-2 py-1 rounded-lg bg-opacity-10",
                        selectedPair.priceChange.h24 >= 0 ? "text-green-500 bg-green-500" : "text-red-500 bg-red-500"
                      )}>
                        {selectedPair.priceChange.h24 >= 0 ? '+' : ''}{selectedPair.priceChange.h24.toFixed(2)}%
                      </div>
                    </div>
                    
                    <div className="h-32 w-full bg-[#1c2128]/20 rounded-2xl border border-subtle overflow-hidden p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparklineData}>
                          <YAxis hide domain={['auto', 'auto']} />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-[#0d0e11] border border-subtle p-2 rounded-lg text-[10px] shadow-2xl">
                                    <p className="font-mono font-bold">{formatUsd(payload[0].value as number)}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          {tradeLogs.filter(l => l.pairAddress === selectedPair.pairAddress).map(log => (
                            <ReferenceLine 
                              key={log.id} 
                              y={log.price} 
                              stroke={log.type === "entry" ? "#3b82f6" : "#ef4444"} 
                              strokeDasharray="3 3"
                            >
                              <Label 
                                value={log.type === "entry" ? "ENTRY" : "EXIT"} 
                                position="insideLeft" 
                                fill={log.type === "entry" ? "#3b82f6" : "#ef4444"}
                                fontSize={8}
                                fontWeight="bold"
                              />
                            </ReferenceLine>
                          ))}
                          <Line 
                            type="monotone" 
                            dataKey="price" 
                            stroke={selectedPair.priceChange.h24 >= 0 ? "#10b981" : "#ef4444"} 
                            strokeWidth={2} 
                            dot={false}
                            animationDuration={1500}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-between mt-2 px-1">
                      <span className="text-[10px] text-secondary font-mono tracking-tighter uppercase">24h ago</span>
                      <span className="text-[10px] text-secondary font-mono tracking-tighter uppercase">Now</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, symbol, icon: Icon }: { label: string; value: string; symbol?: string; icon: any }) {
  return (
    <div className="p-4 rounded-2xl bg-[#1c2128]/40 border border-subtle flex flex-col gap-1">
      <div className="flex items-center gap-2 text-secondary">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-lg font-mono font-bold truncate" id={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
        {value} <span className="text-xs text-secondary font-normal">{symbol}</span>
      </div>
    </div>
  );
}
