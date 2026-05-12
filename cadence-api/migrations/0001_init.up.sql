CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_uid    text NOT NULL UNIQUE,
  email           text UNIQUE,
  display_name    text,
  handle          text UNIQUE,
  intent          text,
  pillars         text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX idx_users_firebase_uid ON users (firebase_uid);

CREATE TABLE habits (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  icon            text NOT NULL DEFAULT 'sparkles',
  schedule        jsonb NOT NULL DEFAULT '{}'::jsonb,
  time_of_day     text NOT NULL DEFAULT 'anytime',
  source_link     jsonb,
  track_context   boolean NOT NULL DEFAULT true,
  shared_with     uuid[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz
);
CREATE INDEX idx_habits_user_id ON habits (user_id);

CREATE TABLE habit_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id        uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date            date NOT NULL,
  completed       boolean NOT NULL DEFAULT true,
  value           numeric,
  source          text NOT NULL DEFAULT 'manual',
  logged_at       timestamptz NOT NULL DEFAULT now(),
  skip_reason     text,
  UNIQUE (habit_id, date)
);
CREATE INDEX idx_habit_logs_habit_id_date ON habit_logs (habit_id, date DESC);

CREATE TABLE check_ins (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            date NOT NULL,
  mood            smallint CHECK (mood BETWEEN 1 AND 5),
  sleep_hours     numeric,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
CREATE INDEX idx_check_ins_user_id_date ON check_ins (user_id, date DESC);

CREATE TABLE todos (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text            text NOT NULL,
  tag             text,
  due_date        date,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_todos_user_id_due_date ON todos (user_id, due_date);
