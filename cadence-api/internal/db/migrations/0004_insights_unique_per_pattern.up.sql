-- Insights are upserted per (user, habit, pattern_type) on each worker run.
-- The PRD §11 schema doesn't specify a uniqueness constraint but in practice
-- we want one "current" row per pattern so the daily rotation has a clean
-- working set. Without NULLS NOT DISTINCT the unique would let two
-- cross-habit (habit_id IS NULL) rows coexist for the same pattern.
ALTER TABLE insights
  ADD CONSTRAINT insights_user_habit_pattern_key
  UNIQUE NULLS NOT DISTINCT (user_id, habit_id, pattern_type);
