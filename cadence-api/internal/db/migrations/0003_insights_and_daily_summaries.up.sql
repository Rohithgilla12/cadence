-- Phase 3 foundations (PRD §8 + §11).
--
-- insights:        the correlation engine's output. One row per (user, habit,
--                  pattern) triple. Rendered_text is what the UI shows; the
--                  template_id + template_params + stats are kept so we can
--                  re-render if copy changes or audit a surprising claim.
--
-- daily_summaries: the per-day denormalized health rollup the client computes
--                  on-device and PUTs to the server. PRD §9: "client uploads
--                  only the daily summaries, not raw samples." This is the
--                  table the correlation worker reads against habit_logs and
--                  check_ins to find patterns.

CREATE TABLE insights (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id        uuid REFERENCES habits(id) ON DELETE CASCADE,
  pattern_type    text NOT NULL,
  effect_size     numeric NOT NULL,
  p_value         numeric NOT NULL,
  sample_size     smallint NOT NULL,
  template_id     text NOT NULL,
  template_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  rendered_text   text NOT NULL,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  shown_at        timestamptz
);
CREATE INDEX idx_insights_user_id_computed_at ON insights (user_id, computed_at DESC);
CREATE INDEX idx_insights_user_id_habit_id_pattern ON insights (user_id, habit_id, pattern_type);

CREATE TABLE daily_summaries (
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                 date NOT NULL,
  -- Sleep figures come from the client's overnight sleep-window query
  -- (yesterday 6pm to today 11am, intervals merged). Stages may be NULL on
  -- older watches that only emit asleepUnspecified.
  sleep_hours          numeric,
  sleep_deep_minutes   int,
  sleep_rem_minutes    int,
  sleep_core_minutes   int,
  steps                int,
  distance_meters      int,
  active_energy_kcal   int,
  resting_heart_rate   int,
  hrv_ms               int,
  -- The provider that produced this summary. v1 is always 'apple_health' for
  -- iOS, will be 'health_connect' once Android ships. Tracked so the
  -- correlation worker can warn about mixed-source data when devices change.
  source               text NOT NULL DEFAULT 'apple_health',
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);
CREATE INDEX idx_daily_summaries_user_id_date ON daily_summaries (user_id, date DESC);
