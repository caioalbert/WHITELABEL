# Farmácia Popular

O catálogo inicial contém 207 medicamentos e itens do PDF fornecido (atualização 03/08/2026) e 530 lojas PAGUE MENOS da aba BASE_LOJAS da planilha fornecida. As 63 lojas EXTRAFARMA e contatos internos de outras abas não são importados. Nomes, códigos e indicações são preservados; não há orientação de dose.

## Administração e cliente

`/admin/farmacia-popular` permite cadastrar, editar, ativar e desativar medicamentos e lojas. `/cliente/farmacia-popular` mostra apenas registros ativos, com busca, categorias, UF e cidade. Alterações aparecem na próxima consulta, atualização ou retorno à tela. A API administrativa exige administrador; a API do cliente exige cadastro ativo. As tabelas têm RLS e não concedem acesso direto aos papéis anon/authenticated. A credencial service_role permanece no servidor. Não existe catálogo de fallback quando o banco está indisponível.

## Mapa

Configure no servidor `GOOGLE_MAPS_BROWSER_KEY` e `GOOGLE_MAPS_MAP_ID`. A chave é de navegador e aparece intencionalmente na página; restrinja-a aos domínios autorizados e às APIs Maps JavaScript/Geocoding. Configure faturamento, quotas e alertas no projeto Google. Use Map ID próprio de produção. Documentação: https://developers.google.com/maps/documentation/javascript/advanced-markers/start

O mapa abre mediante ação do cliente. Aplicar filtros ao mapa é uma ação explícita para evitar consultas em cada tecla. Endereços são geocodificados sequencialmente, aceitando somente resultados sem correspondência parcial, com precisão ROOFTOP/RANGE_INTERPOLATED e UF correspondente. Resultados Google ficam apenas na memória da visualização; não são gravados no banco. Endereços ambíguos continuam disponíveis na lista, sem marcador inventado. O administrador pode informar coordenadas obtidas de fonte autorizada. Alterar endereço no formulário limpa coordenadas antigas. Nenhuma identidade ou token de cliente é incluído nos dados enviados ao Google.

## Implantação

1. Aplicar `supabase/migrations/20261002134802_farmacia_popular.sql` no projeto correto.
2. Carregar o catálogo com `node scripts/seed-farmacia-popular.mjs --project=mqybhwzdcstojxmyovcn`, usando as variáveis privadas do servidor. O carregamento ignora duplicados e preserva edições administrativas.
3. Configurar o serviço de mapas e publicar a versão web.
4. Gerar nova versão nativa: a dependência react-native-webview requer binário compatível, além das alterações da tela e navegação.
5. Validar mapas reais, endereços sem resolução e fluxo autenticado em dispositivo.

O SQL combinado de migração e carga é entregue separadamente para execução única. Não reaplicar DDL após a migração; o script de carga é idempotente.

## Validação e limites

117 testes web passaram; build web, TypeScript e lint passaram. TypeScript, lint e exportação Android/Hermes local passaram no app nativo. A exportação não equivale a APK/AAB assinado nem a teste em aparelho.

Teste de interface usa Next.js otimizado, APIs do catálogo e SQL PostgreSQL reais em banco temporário. Autenticação/provedor Supabase são simulados localmente; o SDK Google também é simulado. Esse teste não valida coordenadas reais, faturamento, chave/referrers ou renderização do fornecedor Google em produção.

Em 02/10/2026 a migração e carga foram executadas no SQL Editor de produção após autorização explícita. Conferência confirmou 207 produtos, 530 lojas, RLS ativo nas duas tabelas, sem SELECT para anon/authenticated e com SELECT para service_role. O conector ainda não tem permissão para esse projeto. Aplicação via SQL Editor não registra automaticamente a migração no histórico do CLI; não reaplicar este DDL. Publicação e validação dos mapas reais continuam pendentes da configuração Google e do deploy.
