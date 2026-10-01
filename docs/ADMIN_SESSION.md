# Sessão administrativa e revisão de segurança

A sessão administrativa tem prazo máximo de 24 horas contado no login. O token de acesso do Supabase mantém sua duração normal e é renovado no servidor; o prazo assinado não é prorrogado durante a renovação. Cookies administrativos são isolados, HttpOnly, SameSite=Lax e Secure em produção. O servidor valida o usuário no Supabase e a permissão em app_metadata.

O cookie de prazo usa uma chave derivada com SHA-256 e finalidade exclusiva a partir de SUPABASE_SERVICE_ROLE_KEY, credencial privada já obrigatória no backend. Não requer novo segredo de implantação, não reutiliza assinaturas de clientes e não aceita segredo padrão. A chave derivada e a credencial permanecem no servidor. Não há migração de banco. Sessões administrativas anteriores precisam fazer login uma vez após a publicação.

Antes, o administrador usava um cookie separado com a duração curta do token de acesso, sem renovação nesse fluxo. Além disso, qualquer erro de autenticação, inclusive indisponibilidade temporária, redirecionava para login. Agora erros temporários retornam 503 sem apagar os cookies; logout revoga a sessão de refresh.

Controles adicionais: verificação de origem nas operações administrativas, proibição de cache das respostas autenticadas e enquadramento em iframe, autenticação no diagnóstico /api/init-db, e neutralização de fórmulas em ambas as exportações CSV de clientes.

Revisão manual: não foi encontrada composição de SQL a partir de entradas nas rotas revisadas; consultas usam filtros do Supabase. Os testes de leitura anônima em produção não retornaram registros das tabelas privadas verificadas. Isso não constitui garantia de ausência de vulnerabilidades. O scan do plugin Codex Security não iniciou porque não conseguiu ler o vínculo node_modules no WSL.

Validação local usa Next.js e biblioteca Supabase reais com provedor de autenticação simulado, sem credenciais ou alterações de produção. Inclui expiração e refresh, limite de 24 horas, origem externa, falta de permissão, cookie adulterado, indisponibilidade temporária e logout. A interface administrativa também é validada em desktop e móvel.
