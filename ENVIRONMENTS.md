# Environment Organization

Real secrets must stay out of Git. Keep only templates in the repository and configure real values in Vercel or private local files.

## Recommended files

- `.env.local`: local development. Use sandbox credentials only.
- `.env.staging.local`: optional private staging file for manual tests.
- `.env.production.local`: optional private production file. Prefer Vercel Production variables instead.
- `.env.example`: canonical list of supported variables without secrets.
- `docs/env/local.env.example`: local template.
- `docs/env/staging.env.example`: staging template.
- `docs/env/production.env.example`: production template.

## Vercel mapping

- Development: local/sandbox credentials.
- Preview: staging Supabase plus sandbox Asaas/Rapidoc.
- Production: production Supabase plus production Asaas/Rapidoc.

Do not reuse the production Supabase service role in staging. Staging should have an isolated Supabase project/database.

## Required variables

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | public | Must match the deployed URL for the environment. |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL for the environment. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key. Public, but environment-specific. |
| `SUPABASE_SERVICE_ROLE_KEY` | server secret | Highly sensitive. Never expose to the browser. |
| `JWT_SECRET` | server secret | Required for client portal JWTs. Must be long and unique per environment. |
| `CRON_SECRET` | server secret | Required by admin Rapidoc sync route. |
| `BLOB_READ_WRITE_TOKEN` | server secret | Required when storing termo templates in Vercel Blob. |
| `ASAAS_API_BASE_URL` | server | Sandbox: `https://api-sandbox.asaas.com/v3`; production: `https://api.asaas.com/v3`. |
| `ASAAS_API_KEY` | server secret | Environment-specific Asaas key. |
| `ASAAS_WEBHOOK_TOKEN` | server secret | Environment-specific webhook token. |
| `RESEND_API_KEY` | server secret | Required only when sending email. |
| `RESEND_FROM_EMAIL` | server | Sender address for Resend. |
| `RAPIDOC_API_BASE_URL` | server | Sandbox or production Rapidoc API base. |
| `RAPIDOC_CLIENT_ID` | server secret | Rapidoc client id. |
| `RAPIDOC_JWT_TOKEN` | server secret | Rapidoc bearer token. |
| `RAPIDOC_ACCESS_URL` | server | Optional template URL override. |
| `RAPIDOC_FALLBACK_URL` | server | Fallback URL when Rapidoc API is unavailable. |

## Variables declared today but apparently unused

These appeared in current env files but are not read by the app code:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SUPABASE_JWT_SECRET`
- `ASAAS_API_KEY_sandbox`

Recommendation: remove them from real env files unless an external/manual script still uses them. `ADMIN_PASSWORD=admin123` should be treated as unsafe and rotated anywhere it was used.

## Optional aliases

`lib/rapidoc.ts` supports these aliases, but the server-side names above are preferred:

- `NEXT_PUBLIC_RAPIDOC_API_BASE_URL`
- `NEXT_PUBLIC_RAPIDOC_FALLBACK_URL`

Only set `NEXT_PUBLIC_*` Rapidoc values if the browser truly needs to read them.

## Migration checklist

1. Rotate any secret that has been shared or committed.
2. Move real values from local files into Vercel environment variables.
3. Create an isolated staging Supabase project before using staging with real tests.
4. Delete mixed files such as `.env.shalom` after values are migrated.
5. Ensure `.env.local` never points to production services during local development.

## Current project layout after organization

The active private env files are now:

- `.env.local`: local development. Generated from the previous staging/sandbox file.
- `.env.staging.local`: staging/preview template with real private values copied from the previous staging file where available.
- `.env.production.local`: production local file generated from the previous mixed Shalom file.

The previous files were preserved for manual comparison:

- `.env.stage.legacy`
- `.env.shalom.legacy`
- `.env.backups/2026-06-19/`

The reorganized active env files intentionally removed variables that are not read by the application code: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SUPABASE_JWT_SECRET`, and `ASAAS_API_KEY_sandbox`.

Review before deployment:

- Replace placeholder `NEXT_PUBLIC_APP_URL` values in staging and production.
- Create or configure an isolated staging Supabase project; the old staging file reused the same Supabase project as production.
- Check Rapidoc production values in `.env.production.local`; the old mixed file had sandbox Rapidoc marked as active.

## Billing configuration

Billing values and allowed payment methods are intentionally configured only in the database (`cobranca_configuracoes` and related plan tables). The app no longer reads billing prices or billing-type fallbacks from environment variables. If the database configuration is missing, the app should fail with a clear configuration error instead of inventing local values.
