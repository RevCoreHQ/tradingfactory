"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "@/lib/store/market-store";
import { connectPolygonWS, disconnectPolygonWS, isConnected } from "@/lib/websocket/polygon-ws";

/**
 * Hook to start the Polygon WebSocket connection for real-time prices.
 * Call this once at the app level. Prices are pushed into Zustand store.
 */
export function useRealtimePrices() {
  const updateRealtimePrice = useMarketStore((s) => s.updateRealtimePrice);
  const setWsConnected = useMarketStore((s) => s.setWsConnected);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    connectPolygonWS((instrumentId, price, timestamp) => {
      updateRealtimePrice(instrumentId, price, timestamp);
    });

    const statusInterval = setInterval(() => {
      setWsConnected(isConnected());
    }, 3000);

    return () => {
      clearInterval(statusInterval);
      disconnectPolygonWS();
      initialized.current = false;
    };
  }, [updateRealtimePrice, setWsConnected]);
}
