import { INSTRUMENTS } from "@/lib/utils/constants";

type PriceCallback = (instrumentId: string, price: number, timestamp: number) => void;

// Map Polygon tickers back to instrument IDs
const TICKER_TO_INSTRUMENT = new Map<string, string>();
for (const inst of INSTRUMENTS) {
  // Build reverse map from common ticker formats
  const id = inst.id;
  // Forex: "C:EURUSD" from Polygon WS comes as "C:EURUSD" or pair format
  if (inst.category === "forex") {
    TICKER_TO_INSTRUMENT.set(`C:${id.replace("_", "")}`, id);
  } else if (inst.category === "commodity") {
    if (id === "XAU_USD") TICKER_TO_INSTRUMENT.set("C:XAUUSD", id);
    if (id === "XAG_USD") TICKER_TO_INSTRUMENT.set("C:XAGUSD", id);
  } else if (inst.category === "crypto") {
    if (id === "BTC_USD") TICKER_TO_INSTRUMENT.set("X:BTCUSD", id);
    if (id === "ETH_USD") TICKER_TO_INSTRUMENT.set("X:ETHUSD", id);
  }
}

let ws: WebSocket | null = null;
let callback: PriceCallback | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getForexTickers(): string[] {
  return Array.from(TICKER_TO_INSTRUMENT.keys()).filter((t) => t.startsWith("C:"));
}

function getCryptoTickers(): string[] {
  return Array.from(TICKER_TO_INSTRUMENT.keys()).filter((t) => t.startsWith("X:"));
}

/**
 * Connect to Polygon.io WebSocket for real-time forex/crypto quotes.
 * The Currencies plan provides wss://socket.polygon.io/forex and /crypto.
 * We connect to the forex socket for the majority of instruments.
 */
export function connectPolygonWS(onPrice: PriceCallback) {
  const apiKey = process.env.NEXT_PUBLIC_MASSIVE_API_KEY;
  if (!apiKey) {
    console.warn("[Polygon WS] NEXT_PUBLIC_MASSIVE_API_KEY not set");
    return;
  }

  callback = onPrice;

  // Connect to forex socket (covers forex + commodities)
  connectSocket("forex", apiKey, getForexTickers());
  // Crypto would need a separate socket:
  // connectSocket("crypto", apiKey, getCryptoTickers());
}

function connectSocket(market: "forex" | "crypto", apiKey: string, tickers: string[]) {
  if (tickers.length === 0) return;

  const url = `wss://socket.polygon.io/${market}`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log(`[Polygon WS] Connected to ${market}`);
    // Authenticate
    ws?.send(JSON.stringify({ action: "auth", params: apiKey }));
  };

  ws.onmessage = (event) => {
    try {
      const messages = JSON.parse(event.data);
      for (const msg of Array.isArray(messages) ? messages : [messages]) {
        // Auth success → subscribe
        if (msg.ev === "status" && msg.status === "auth_success") {
          const sub = tickers.map((t) => `CA.${t}`).join(",");
          ws?.send(JSON.stringify({ action: "subscribe", params: sub }));
          console.log(`[Polygon WS] Subscribed to ${tickers.length} tickers`);
        }

        // Currency aggregate (CA) event — real-time price update
        if (msg.ev === "CA" || msg.ev === "XA") {
          const ticker = msg.pair ? `C:${msg.pair.replace("/", "")}` : "";
          const instrumentId = TICKER_TO_INSTRUMENT.get(ticker);
          if (instrumentId && callback) {
            const price = msg.c || msg.vw || msg.o || 0;
            callback(instrumentId, price, msg.s || Date.now());
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  };

  ws.onclose = () => {
    console.log(`[Polygon WS] Disconnected from ${market}`);
    // Auto-reconnect after 5s
    reconnectTimer = setTimeout(() => {
      if (callback) connectSocket(market, apiKey, tickers);
    }, 5000);
  };

  ws.onerror = (err) => {
    console.warn("[Polygon WS] Error:", err);
  };
}

export function disconnectPolygonWS() {
  callback = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function isConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}
