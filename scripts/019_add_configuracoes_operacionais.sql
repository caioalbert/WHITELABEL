-- Migration 019: Configurações operacionais (telefone de emergência, WhatsApp, tagline)
-- Adiciona campos configuráveis pelo admin ao invés de hardcoded no código

ALTER TABLE cobranca_configuracoes
  ADD COLUMN IF NOT EXISTS telefone_emergencia TEXT DEFAULT '(85) 3000-0000',
  ADD COLUMN IF NOT EXISTS whatsapp_url TEXT DEFAULT 'https://wa.me/5585991452514',
  ADD COLUMN IF NOT EXISTS app_tagline TEXT DEFAULT 'Sua saúde completa e segura';
