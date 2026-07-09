-- Atualiza uma base existente para usar a identidade visual Nova Aliança.
-- Use se a migration 020 já foi executada antes com os defaults antigos.

UPDATE cobranca_configuracoes
SET
  brand_name = 'Nova Aliança',
  brand_short_name = 'Nova Aliança',
  brand_logo_url = '/logo-nova-alianca.png',
  brand_logo_alt = 'Nova Aliança Consultoria e Representações',
  updated_at = NOW()
WHERE id = true;
