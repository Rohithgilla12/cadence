-- Until now the API was stashing each habit's Target (duration goal) inside
-- source_link, because source_link existed as a jsonb column from 0001 and
-- target didn't have a home of its own. Per PRD §11 those are different
-- concerns: source_link describes the health-source rule (e.g. "Apple Health
-- workout type=run, 15+ min"), target describes the user-set duration goal.
-- This migration gives target its own column and reclaims source_link for
-- its real purpose, copying any existing target data over.

ALTER TABLE habits ADD COLUMN target jsonb;

UPDATE habits
SET
  target = source_link -> 'target',
  source_link = NULL
WHERE source_link ? 'target';
