// ============================================================
// BiasSnapshot — committed market context per instrument.
// The system only updates this when a structural break or
// regime shift occurs; prevents flip-flopping on every tick.
// ============================================================

export type SnapshotDirection = 'bullish' | 'bearish' | 'neutral';
export type SnapshotRegime = 'trending' | 'mean_reversion' | 'expansion' | 'choppy';

export interface HTFKeyLevel {
  price: number;
  kind: 'support' | 'resistance' | 'poi';
}

export interface HTFStructure {
  trend_4h:    'up' | 'down' | 'range';
  trend_daily: 'up' | 'down' | 'range';
  key_levels:  HTFKeyLevel[];
}

export interface BiasSnapshot {
  id:                string;
  user_id:           string;
  instrument:        string;
  direction:         SnapshotDirection;
  confidence:        number;       // 0–100
  regime:            SnapshotRegime;
  htf_structure:     HTFStructure;
  fundamental_score: number;       // 0–100 from bias-engine
  technical_score:   number;       // 0–100 from bias-engine
  inputs_hash:       string;       // hash of material inputs; used for dedup
  committed:         boolean;      // uncommitted rows exist but don't drive UI
  parent_id?:        string;       // previous committed snapshot id
  change_reason?:    string;       // why bias changed, e.g. "4H structure break below 148.00"
  created_at:        string;       // ISO
}

// ── Draft (before persisting) ──────────────────────────────

export type BiasSnapshotDraft = Omit<BiasSnapshot, 'id' | 'created_at'>;

// ── Structural break detection result ─────────────────────

export interface StructuralBreakSignals {
  structuralBreak: boolean;  // 4H close beyond prior swing high/low
  regimeShift:     boolean;  // phase transition in FullRegime
  reason?:         string;   // human-readable explanation
}
