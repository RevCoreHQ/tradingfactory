-- ============================================================
-- Decision Engine Schema — Trade Ideas, Bias Snapshots, Audit Log
-- Run in Supabase SQL Editor after 001_auth_tables.sql
-- ============================================================

-- 1. bias_snapshots — committed market context per instrument
CREATE TABLE IF NOT EXISTS public.bias_snapshots (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument        TEXT        NOT NULL,
  direction         TEXT        NOT NULL CHECK (direction IN ('bullish', 'bearish', 'neutral')),
  confidence        NUMERIC     NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  regime            TEXT        NOT NULL CHECK (regime IN ('trending', 'mean_reversion', 'expansion', 'choppy')),
  htf_structure     JSONB       NOT NULL DEFAULT '{}',
  fundamental_score NUMERIC     NOT NULL DEFAULT 50,
  technical_score   NUMERIC     NOT NULL DEFAULT 50,
  inputs_hash       TEXT        NOT NULL,
  committed         BOOLEAN     NOT NULL DEFAULT false,
  parent_id         UUID        REFERENCES public.bias_snapshots(id),
  change_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one committed snapshot per user+instrument+inputs_hash
-- This deduplicates unchanged market conditions
CREATE UNIQUE INDEX IF NOT EXISTS bias_snapshots_dedup
  ON public.bias_snapshots (user_id, instrument, inputs_hash)
  WHERE committed = true;

CREATE INDEX IF NOT EXISTS bias_snapshots_lookup
  ON public.bias_snapshots (user_id, instrument, committed, created_at DESC);

-- 2. trade_ideas — canonical stateful trade objects
CREATE TABLE IF NOT EXISTS public.trade_ideas (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument               TEXT        NOT NULL,
  direction                TEXT        NOT NULL CHECK (direction IN ('long', 'short')),
  trade_type               TEXT        NOT NULL CHECK (trade_type IN ('scalp', 'intraday', 'swing')),
  priority                 TEXT        NOT NULL DEFAULT 'primary' CHECK (priority IN ('primary', 'secondary')),
  origin                   TEXT        NOT NULL CHECK (origin IN ('analyst', 'mechanical', 'hybrid', 'manual')),

  state                    TEXT        NOT NULL DEFAULT 'idea' CHECK (
                             state IN ('idea', 'watching', 'ready', 'executed', 'managing', 'scaled', 'exited', 'invalidated')
                           ),
  state_since              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Levels
  entry_zone               JSONB       NOT NULL DEFAULT '{}',
  stop_loss                NUMERIC     NOT NULL,
  take_profits             JSONB       NOT NULL DEFAULT '[]',

  -- Thesis
  thesis                   TEXT        NOT NULL DEFAULT '',
  entry_conditions         JSONB       NOT NULL DEFAULT '[]',
  invalidation             JSONB       NOT NULL DEFAULT '{}',

  confidence               NUMERIC     NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  source_bias_snapshot_id  UUID        REFERENCES public.bias_snapshots(id),
  source_candidate_refs    JSONB       NOT NULL DEFAULT '[]',

  -- Execution state (populated from state=executed onward)
  executed_at              TIMESTAMPTZ,
  avg_entry_price          NUMERIC,
  current_size_r           NUMERIC,
  scale_events             JSONB       NOT NULL DEFAULT '[]',
  realized_r               NUMERIC,
  exited_at                TIMESTAMPTZ,

  tags                     JSONB       NOT NULL DEFAULT '[]',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_ideas_by_state
  ON public.trade_ideas (user_id, state);

CREATE INDEX IF NOT EXISTS trade_ideas_by_instrument_state
  ON public.trade_ideas (user_id, instrument, state);

CREATE INDEX IF NOT EXISTS trade_ideas_by_created
  ON public.trade_ideas (user_id, created_at DESC);

-- 3. decision_log — full immutable audit trail
CREATE TABLE IF NOT EXISTS public.decision_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event        TEXT        NOT NULL CHECK (
                 event IN (
                   'bias_uncommitted',
                   'bias_committed',
                   'bias_flip_blocked',
                   'idea_created',
                   'idea_transition',
                   'idea_invalidated',
                   'idea_executed',
                   'idea_scaled',
                   'idea_exited',
                   'conflict_blocked'
                 )
               ),
  idea_id      UUID        REFERENCES public.trade_ideas(id),
  snapshot_id  UUID        REFERENCES public.bias_snapshots(id),
  from_state   TEXT,
  to_state     TEXT,
  actor        TEXT        NOT NULL DEFAULT 'system' CHECK (actor IN ('system', 'user')),
  reason       TEXT        NOT NULL DEFAULT '',
  payload      JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decision_log_by_created
  ON public.decision_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS decision_log_by_idea
  ON public.decision_log (idea_id, created_at DESC);

-- 4. Auto-update updated_at on trade_ideas
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trade_ideas_updated_at ON public.trade_ideas;
CREATE TRIGGER trade_ideas_updated_at
  BEFORE UPDATE ON public.trade_ideas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Enable RLS
ALTER TABLE public.bias_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_ideas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_log   ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies — bias_snapshots
CREATE POLICY "Users read own snapshots" ON public.bias_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins read all snapshots" ON public.bias_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Writes are service-role only (from API routes); no direct client insert/update/delete.

-- 7. RLS Policies — trade_ideas
CREATE POLICY "Users read own ideas" ON public.trade_ideas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins read all ideas" ON public.trade_ideas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 8. RLS Policies — decision_log
CREATE POLICY "Users read own log" ON public.decision_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins read all log" ON public.decision_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
