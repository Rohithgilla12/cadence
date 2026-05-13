-- Reverse of 0002: fold target back into source_link, then drop the column.
UPDATE habits
SET source_link = jsonb_build_object('target', target)
WHERE target IS NOT NULL AND source_link IS NULL;

ALTER TABLE habits DROP COLUMN target;
