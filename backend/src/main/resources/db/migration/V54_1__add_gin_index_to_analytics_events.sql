CREATE INDEX IF NOT EXISTS idx_analytics_events_metadata_gin
    ON analytics_events USING GIN (metadata);
