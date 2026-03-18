import { INSTRUMENTS } from "@/lib/utils/constants";

type PriceCallback = (instrumentId: string, price: number, timestamp: number) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let callback: PriceCallback | null = null;

// Map OANDA:EUR_USD → EUR_USD
const SYMBOL_TO_INSTRUMENT = new Map<string, string>(
  INSTRUMENTS.filter((i) => i.finnhubSymbol).map((i) => [i.finnhubSymbol!, i.id])
);

const FOREX_SYMBOLS = INSTRUMENTS.filter((i) => i.finnhubSymbol).map((i) => i.finnhubSymbol!);

export function connectFinnhubWS(onPrice: PriceCallback) {
  callback = onPrice;
  const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!apiKey) {
    console.warn("[WS] No NEXT_PUBLIC_FINNHUB_API_KEY — falling back to polling");
    return;
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);

  ws.onopen = () => {
    console.log("[WS] Connected to Finnhub — subscribing to", FOREX_SYMBOLS.length, "symbols");
    for (const sym of FOREX_SYMBOLS) {
      ws?.send(JSON.stringify({ type: "subscribe", symbol: sym }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "trade" && msg.data) {
        for (const trade of msg.data) {
          const instrumentId = SYMBOL_TO_INSTRUMENT.get(trade.s);
          if (instrumentId && callback) {
            callback(instrumentId, trade.p, trade.t);
          }
        }
      }
    } catch {
      // Ignore parse errors (heartbeats etc.)
    }
  };

  ws.onerror = (err) => {
    console.warn("[WS] Error:", err);
  };

  ws.onclose = () => {
    console.log("[WS] Disconnected — reconnecting in 5s");
    ws = null;
    reconnectTimer = setTimeout(() => {
      if (callback) connectFinnhubWS(callback);
    }, 5000);
  };
}

export function disconnectFinnhubWS() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) {
    // Unsubscribe before closing
    for (const sym of FOREX_SYMBOLS) {
      try {
        ws.send(JSON.stringify({ type: "unsubscribe", symbol: sym }));
      } catch { /* ignore */ }
    }
    ws.close();
  }
  ws = null;
  callback = null;
}

export function isConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}
