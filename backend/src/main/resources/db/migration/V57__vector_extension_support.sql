SET search_path TO career_operations;

-- V57 — Enable pgvector extension if available for native vector-ready semantic search operations.
-- Allows for subsequent transition from JSONB vector storage to optimized native vector(N) columns.
CREATE EXTENSION IF NOT EXISTS vector;
