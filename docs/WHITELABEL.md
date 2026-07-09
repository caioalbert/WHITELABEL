# Whitelabel

Esta cópia foi preparada para permitir troca básica de identidade visual pelo painel admin.

## Banco

Execute no Supabase SQL Editor:

```sql
scripts/020_add_branding_settings.sql
```

Essa migration adiciona os campos abaixo em `cobranca_configuracoes`:

- `brand_name`
- `brand_short_name`
- `brand_logo_url`
- `brand_logo_alt`

## Trocar logo

No painel admin:

1. Acesse `Configurações`.
2. Abra `Identidade Visual`.
3. Informe uma logo em `URL ou caminho da logo`.
4. Salve em `Salvar Identidade Visual`.

Para usar uma imagem local, coloque o arquivo em `public/` e use um caminho como `/logo-nova-alianca.png`.
Para usar uma CDN/storage, use uma URL `https://...`.

## Observação

Esta etapa troca a logo e nomes usados nas telas principais. Textos contratuais, PDFs, e-mails, cobranças e manifest PWA ainda podem conter textos SHALOM e devem ser revisados por cliente antes de publicar o whitelabel.
