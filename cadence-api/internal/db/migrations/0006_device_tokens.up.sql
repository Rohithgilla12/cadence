-- Push notification routing table. One row per (user, FCM token) — a user
-- can have multiple devices, and a single device's token rotates when the
-- OS rolls APNs/FCM credentials, so we upsert by token rather than by
-- (user, device-id-we-don't-have).
--
-- last_seen_at is bumped on every register call; the sender can prune
-- tokens that haven't been seen in N days as a cheap garbage-collect.

CREATE TABLE device_tokens (
  token        text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform     text NOT NULL,            -- 'ios' | 'android'
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_device_tokens_user_id ON device_tokens (user_id);
