"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body style={{ padding: "2rem", fontFamily: "monospace", color: "#fff", background: "#111" }}>
        <h2 style={{ color: "#ef4444", marginBottom: "1rem" }}>Global Error</h2>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", padding: "1rem", background: "#1a1a1a", borderRadius: "8px", fontSize: "13px", maxHeight: "400px", overflow: "auto" }}>
          {error.message}
          {"\n\n"}
          {error.stack}
        </pre>
        <button
          onClick={reset}
          style={{ marginTop: "1rem", padding: "0.5rem 1rem", background: "#333", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
