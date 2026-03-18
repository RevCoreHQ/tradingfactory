"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "@/lib/store/market-store";
import { connectFinnhubWS, disconnectFinnhubWS, isConnected } from "@/lib/websocket/finnhub-ws";

/**
 * Hook to start the Finnhub WebSocket connection.
 * Call this once at the app level (e.g., in MarketOverview or a provider).
 * Prices are pushed into the Zustand store as realtimeQuotes.
 */
export function useRealtimePrices() {
  const updateRealtimePrice = useMarketStore((s) => s.updateRealtimePrice);
  const setWsConnected = useMarketStore((s) => s.setWsConnected);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    connectFinnhubWS((instrumentId, price, timestamp) => {
      updateRealtimePrice(instrumentId, price, timestamp);
    });

    // Check connection status periodically
    const statusInterval = setInterval(() => {
      setWsConnected(isConnected());
    }, 3000);

    return () => {
      clearInterval(statusInterval);
      disconnectFinnhubWS();
      initialized.current = false;
    };
  }, [updateRealtimePrice, setWsConnected]);
}
