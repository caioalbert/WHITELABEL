# Primeira parcela e vencimentos

Novos cadastros incluem a primeira cobrança no total do contrato. Um contrato de
12 meses gera uma primeira parcela e uma assinatura limitada a outras 11 cobranças.
O valor da primeira parcela é o valor mensal do plano; no cadastro administrativo
de empresas, é o valor total mensal negociado.

O cadastro armazena a data da primeira parcela, o dia escolhido para as seguintes,
a opção de repetir o mesmo dia e o total de meses. A segunda parcela vence no mês
seguinte ao da primeira, mesmo quando o cliente escolhe outro dia. A confirmação
antecipada ou atrasada do pagamento não redefine o calendário contratado.

O administrador pode escolher o prazo de 1 a 60 meses para empresas. O cadastro
comum mantém o prazo de 12 meses. Um contrato de parcela única não cria assinatura.
O cadastro empresarial administrativo gera BolePIX e fica pendente até a confirmação
do pagamento, quando o webhook ativa a empresa e os colaboradores.

Os campos técnicos `asaas_payment_id` e `adesao_pago_em` foram mantidos por
compatibilidade. Para novos contratos eles representam a primeira parcela.
Contratos anteriores ficam com os novos campos nulos e não são reescritos nem
recebem cancelamento ou substituição automática de cobranças. A alteração de
dependentes em novos contratos atualiza o valor sem reiniciar o prazo da assinatura.

## Banco e publicação

Antes de publicar o código, aplicar
`supabase/migrations/20260930130338_contract_installment_schedule.sql` ao mesmo
banco usado pela aplicação. O script é aditivo e pode ser executado novamente.
O `scripts/setup-db.mjs` inclui essa pasta depois dos scripts históricos.

A migração foi validada em PostgreSQL temporário com registros anteriores,
cadastros novos, execução repetida e rejeição de configurações inválidas. Os
testes das rotas usam integrações simuladas: não criam cobranças reais no Asaas.

O limite de cobranças usa `maxPayments`, e o primeiro vencimento da assinatura
usa `nextDueDate`, conforme a [referência de assinaturas do Asaas](https://docs.asaas.com/reference/criar-nova-assinatura).
