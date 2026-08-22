-- =============================================================
-- Seed: Testadores do sistema
-- Execute no SQL Editor do Supabase
-- CPF e email são fictícios — peça aos testadores para atualizarem
-- seus dados reais pela tela de edição do painel cliente.
-- =============================================================

INSERT INTO cadastros (
  id,
  nome,
  email,
  cpf,
  rg,
  data_nascimento,
  telefone,
  sexo,
  estado_civil,
  escolaridade,
  endereco,
  numero,
  bairro,
  cidade,
  estado,
  cep,
  tem_dependentes,
  tipo_plano,
  mensalidade_valor,
  mensalidade_billing_type,
  status,
  adesao_pago_em,
  created_at,
  updated_at
) VALUES
(
  gen_random_uuid(),
  'Humberto Morel',
  'humberto.morel.teste@teste.com',
  '111.111.111-11',
  '1111111',
  '1990-01-01',
  '(85) 99999-0001',
  'Masculino',
  'Solteiro(a)',
  'Superior Completo',
  'Rua dos Testadores',
  '1',
  'Centro',
  'Fortaleza',
  'CE',
  '60000-000',
  false,
  'FAMILIAR',
  12.90,
  'BOLETO',
  'ATIVO',
  NOW(),
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'Jorge Mendonça',
  'jorge.mendonca.teste@teste.com',
  '222.222.222-22',
  '2222222',
  '1990-01-01',
  '(85) 99999-0002',
  'Masculino',
  'Solteiro(a)',
  'Superior Completo',
  'Rua dos Testadores',
  '2',
  'Centro',
  'Fortaleza',
  'CE',
  '60000-000',
  false,
  'FAMILIAR',
  12.90,
  'BOLETO',
  'ATIVO',
  NOW(),
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'Elias',
  'elias.teste@teste.com',
  '333.333.333-33',
  '3333333',
  '1990-01-01',
  '(85) 99999-0003',
  'Masculino',
  'Solteiro(a)',
  'Superior Completo',
  'Rua dos Testadores',
  '3',
  'Centro',
  'Fortaleza',
  'CE',
  '60000-000',
  false,
  'FAMILIAR',
  12.90,
  'BOLETO',
  'ATIVO',
  NOW(),
  NOW(),
  NOW()
);

-- Confirmar inserção
SELECT id, nome, email, cpf, status, created_at
FROM cadastros
WHERE email IN (
  'humberto.morel.teste@teste.com',
  'jorge.mendonca.teste@teste.com',
  'elias.teste@teste.com'
);
