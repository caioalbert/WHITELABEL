-- Migration 020: Identidade visual whitelabel
-- Permite alterar nome da marca e logo pela tela de configurações administrativas.

ALTER TABLE cobranca_configuracoes
  ADD COLUMN IF NOT EXISTS brand_name TEXT DEFAULT 'Nova Aliança',
  ADD COLUMN IF NOT EXISTS brand_short_name TEXT DEFAULT 'Nova Aliança',
  ADD COLUMN IF NOT EXISTS brand_logo_url TEXT DEFAULT '/logo-nova-alianca.png',
  ADD COLUMN IF NOT EXISTS brand_logo_alt TEXT DEFAULT 'Nova Aliança Consultoria e Representações';

UPDATE cobranca_configuracoes
SET
  brand_name = COALESCE(NULLIF(TRIM(brand_name), ''), 'Nova Aliança'),
  brand_short_name = COALESCE(NULLIF(TRIM(brand_short_name), ''), 'Nova Aliança'),
  brand_logo_url = COALESCE(NULLIF(TRIM(brand_logo_url), ''), '/logo-nova-alianca.png'),
  brand_logo_alt = COALESCE(NULLIF(TRIM(brand_logo_alt), ''), 'Nova Aliança Consultoria e Representações')
WHERE id = true;
