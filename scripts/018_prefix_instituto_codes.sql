-- Migration 018: Prefix all instituto codigo_indicacao with "INSTITUTO-"
-- This prevents collisions with vendedor codes.
-- Run once in Supabase SQL Editor.

-- Update existing institutos that don't already have the prefix
UPDATE institutos
SET codigo_indicacao = 'INSTITUTO-' || codigo_indicacao,
    updated_at = NOW()
WHERE codigo_indicacao NOT LIKE 'INSTITUTO-%';

-- Verify
SELECT id, nome, codigo_indicacao FROM institutos ORDER BY created_at;
