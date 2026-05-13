-- Phase 5 foundations (PRD §10 + §11). Schema for the social layer:
-- Circles, members, pacts (shared weekly commitments), per-member pact
-- progress, an append-only feed of circle events, and reactions.
--
-- Privacy invariants live in the *application* layer (PRD §10): circle
-- members only see habits explicitly shared via habits.shared_with[],
-- never raw health data. The schema does not enforce that — it's the
-- handler's job — but it does enforce membership via the join table.

CREATE TABLE circles (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  description     text,
  creator_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Invite tokens are URL-safe random strings (~20 chars). UNIQUE so we
  -- can look up by token without a join. Per PRD §10 joining is via
  -- universal link or QR; both encode this token.
  invite_token    text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz
);
CREATE INDEX idx_circles_creator_id ON circles (creator_id);

CREATE TABLE circle_members (
  circle_id       uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  -- "creator" is granted on circle creation; "member" on join. Used for
  -- moderation features later (kick, transfer ownership).
  role            text NOT NULL DEFAULT 'member',
  PRIMARY KEY (circle_id, user_id)
);
CREATE INDEX idx_circle_members_user_id ON circle_members (user_id);

CREATE TABLE pacts (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id             uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  text                  text NOT NULL,
  start_date            date NOT NULL,
  end_date              date NOT NULL,
  -- Optional: serialized habit template the pact ties to (e.g.
  -- {"kind":"run","target_count":3}). Engine and feed can read this to
  -- show progress against the rule.
  linked_habit_template jsonb,
  created_by            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pacts_circle_id_end_date ON pacts (circle_id, end_date DESC);

CREATE TABLE pact_progress (
  pact_id         uuid NOT NULL REFERENCES pacts(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed       boolean NOT NULL DEFAULT false,
  completed_at    timestamptz,
  PRIMARY KEY (pact_id, user_id)
);

CREATE TABLE circle_feed_items (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id       uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- "habit_done" | "pact_complete" | "back_after_quiet" — server-emitted.
  -- Client never POSTs feed items directly; PRD §10 explicitly forbids
  -- auto-posting / open commenting.
  kind            text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_circle_feed_items_circle_id_created_at
  ON circle_feed_items (circle_id, created_at DESC);

CREATE TABLE reactions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_item_id    uuid NOT NULL REFERENCES circle_feed_items(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Only "flower" in v1 (PRD §10 "anti-performance by design").
  kind            text NOT NULL DEFAULT 'flower',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feed_item_id, user_id, kind)
);
CREATE INDEX idx_reactions_feed_item_id ON reactions (feed_item_id);
