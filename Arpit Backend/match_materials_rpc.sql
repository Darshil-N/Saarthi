-- ============================================================
-- pgvector RPC: match_materials
-- Run this in Supabase SQL editor AFTER schema.sql
-- ============================================================

CREATE OR REPLACE FUNCTION match_materials(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.70,
  match_count     INT   DEFAULT 5
)
RETURNS TABLE (
  id                   UUID,
  cnmc                 TEXT,
  standard_description TEXT,
  short_description    TEXT,
  category             TEXT,
  subcategory          TEXT,
  type                 TEXT,
  spec                 TEXT,
  quality              TEXT,
  quality_grade        TEXT,
  status               TEXT,
  similarity           FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    m.id,
    m.cnmc,
    m.standard_description,
    m.short_description,
    m.category,
    m.subcategory,
    m.type,
    m.spec,
    m.quality,
    m.quality_grade,
    m.status::TEXT,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM materials m
  WHERE 1 - (m.embedding <=> query_embedding) >= match_threshold
    AND m.status != 'deprecated'
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;
