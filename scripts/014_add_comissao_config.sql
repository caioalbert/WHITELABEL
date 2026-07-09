-- Migration 014: Add commission configuration columns to cobranca_configuracoes
-- Idempotent: uses ADD COLUMN IF NOT EXISTS

ALTER TABLE cobranca_configuracoes
  -- % de comissão sobre a adesão (padrão 50%)
  ADD COLUMN IF NOT EXISTS comissao_percentual_adesao NUMERIC(5,2) DEFAULT 50,
  -- % de comissão sobre a mensalidade (padrão 50%)
  ADD COLUMN IF NOT EXISTS comissao_percentual_mensalidade NUMERIC(5,2) DEFAULT 50,
  -- Quantas mensalidades geram comissão; NULL = vitalício (todas)
  ADD COLUMN IF NOT EXISTS comissao_mensalidades_max INTEGER DEFAULT 1;
