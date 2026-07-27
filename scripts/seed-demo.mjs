#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

function loadEnvFile(filename) {
  const filePath = path.join(rootDir, filename)
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue

    const index = line.indexOf('=')
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const demoPassword = process.env.DEMO_SEED_PASSWORD || 'Demo@2026!'

const placeholderPatterns = [/your-project/i, /replace-with/i, /example/i]

function assertEnv() {
  const missing = []
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missing.length > 0) {
    throw new Error(
      [
        `Variaveis ausentes: ${missing.join(', ')}`,
        'Crie um .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do projeto Supabase demo.',
      ].join('\n')
    )
  }

  if (placeholderPatterns.some((pattern) => pattern.test(supabaseUrl))) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL ainda parece ser um placeholder.')
  }

  if (placeholderPatterns.some((pattern) => pattern.test(serviceRoleKey))) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ainda parece ser um placeholder.')
  }
}

try {
  assertEnv()
} catch (error) {
  console.error('')
  console.error('Seed demo falhou.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const IDS = {
  vendedor: '11111111-1111-4111-8111-111111111111',
  instituto: '22222222-2222-4222-8222-222222222222',
  institutoPlanoEssencial: '33333333-3333-4333-8333-333333333333',
  institutoPlanoFamilia: '44444444-4444-4444-8444-444444444444',
  cadastroIndividual: '55555555-5555-4555-8555-555555555555',
  cadastroFamiliar: '66666666-6666-4666-8666-666666666666',
  cadastroInstituto: '77777777-7777-4777-8777-777777777777',
  cadastroPendente: '88888888-8888-4888-8888-888888888888',
  dependentePedro: '99999999-9999-4999-8999-999999999999',
  dependenteBeatriz: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  dependenteRafaela: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
}

const ACCESS = {
  admin: {
    email: 'admin@demo.shalomsaude.com.br',
    password: demoPassword,
  },
  vendedor: {
    email: 'vendedor@demo.shalomsaude.com.br',
    password: demoPassword,
  },
  instituto: {
    email: 'instituto@demo.shalomsaude.com.br',
    password: demoPassword,
  },
}

function nowIso() {
  return new Date().toISOString()
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function monthReference(offset = 0) {
  const date = new Date()
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1))
    .toISOString()
    .slice(0, 10)
}

function formatSupabaseError(error) {
  const parts = [error.message, error.details, error.hint, error.code].filter(Boolean)
  return parts.join(' | ')
}

function isMissingSchemaError(error) {
  const details = formatSupabaseError(error)
  return /does not exist|schema cache|column .* not found|relation .* not found|42P01|42703/i.test(details)
}

async function expectData(label, operation, schemaHint) {
  const { data, error } = await operation
  if (error) {
    const hint = isMissingSchemaError(error)
      ? `\nSchema incompleto. Execute as migrations em scripts/*.sql antes do seed.${schemaHint ? `\n${schemaHint}` : ''}`
      : ''
    throw new Error(`${label}: ${formatSupabaseError(error)}${hint}`)
  }
  return data
}

async function upsertRows(table, rows, options = {}) {
  const data = await expectData(
    `upsert ${table}`,
    supabase.from(table).upsert(rows, options).select('*'),
    `Tabela/coluna afetada: ${table}`
  )
  console.log(`OK ${table}: ${Array.isArray(data) ? data.length : 1} registro(s)`)
  return data
}

async function listAllAuthUsers() {
  const users = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`listar usuarios Auth: ${error.message}`)
    }

    const pageUsers = data?.users || []
    users.push(...pageUsers)
    if (pageUsers.length < perPage) return users
    page += 1
  }
}

async function findAuthUserByEmail(email) {
  const normalized = email.trim().toLowerCase()
  const users = await listAllAuthUsers()
  return users.find((user) => String(user.email || '').trim().toLowerCase() === normalized) || null
}

async function ensureAuthUser({ email, password, userMetadata }) {
  const existing = await findAuthUserByEmail(email)

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: userMetadata,
    })

    if (error) {
      throw new Error(`atualizar usuario Auth ${email}: ${error.message}`)
    }

    console.log(`OK auth: ${email} atualizado`)
    return data.user
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  })

  if (error) {
    throw new Error(`criar usuario Auth ${email}: ${error.message}`)
  }

  console.log(`OK auth: ${email} criado`)
  return data.user
}

async function seedBillingSettings() {
  await upsertRows(
    'cobranca_configuracoes',
    {
      id: true,
      adesao_value: 29.9,
      mensalidade_value: 29.9,
      mensalidade_individual_value: 29.9,
      mensalidade_familiar_value: 74.7,
      mensalidade_billing_types: ['BOLETO', 'CREDIT_CARD'],
      default_mensalidade_billing_type: 'BOLETO',
      default_plan_type: 'INDIVIDUAL',
      comissao_percentual_adesao: 50,
      comissao_percentual_mensalidade: 50,
      comissao_mensalidades_max: 1,
      telefone_emergencia: '(85) 3000-0000',
      whatsapp_url: 'https://wa.me/5585991452514',
      app_tagline: 'Sua saude completa e segura',
      brand_name: 'Nova Alianca Saude',
      brand_short_name: 'Nova Alianca',
      brand_logo_url: '/logo-nova-alianca.png',
      brand_logo_alt: 'Nova Alianca Consultoria e Representacoes',
      updated_at: nowIso(),
    },
    { onConflict: 'id' }
  )
}

async function seedPlans() {
  await upsertRows(
    'planos',
    [
      {
        codigo: 'INDIVIDUAL',
        nome: 'Plano Individual',
        descricao_publica: 'Cobertura para o titular com acesso digital aos principais servicos.',
        beneficios_publicos: [
          '+ Telemedicina 24h',
          '+ Receita e atestado digital',
          '+ Clube de vantagens Nova Alianca',
          '+ Servicos agregados Pague Menos e Grupo Zelo',
          '- Inclusao de dependentes',
        ].join('\n'),
        valor: 29.9,
        ativo: true,
        ordem: 1,
        permite_dependentes: false,
        dependentes_minimos: 0,
        max_dependentes: null,
        valor_dependente_adicional: 0,
        updated_at: nowIso(),
      },
      {
        codigo: 'FAMILIAR',
        nome: 'Plano Familiar',
        descricao_publica: 'Plano por vida para titular e dependentes da familia.',
        beneficios_publicos: [
          '+ Telemedicina 24h para todos',
          '+ Dependentes no mesmo contrato',
          '+ Saude mental e especialidades',
          '+ Servicos agregados Pague Menos e Grupo Zelo',
        ].join('\n'),
        valor: 24.9,
        ativo: true,
        ordem: 2,
        permite_dependentes: true,
        dependentes_minimos: 2,
        max_dependentes: null,
        valor_dependente_adicional: 24.9,
        updated_at: nowIso(),
      },
      {
        codigo: 'PLANO-EMPRESARIAL',
        nome: 'Plano Empresarial',
        descricao_publica: 'Plano por vida para equipes, empresas e grupos conveniados.',
        beneficios_publicos: [
          '+ Minimo de 10 vidas',
          '+ Gestao de colaboradores',
          '+ Telemedicina 24h',
          '+ Rede credenciada e beneficios agregados',
        ].join('\n'),
        valor: 21.9,
        ativo: true,
        ordem: 3,
        permite_dependentes: true,
        dependentes_minimos: 9,
        max_dependentes: null,
        valor_dependente_adicional: 21.9,
        updated_at: nowIso(),
      },
    ],
    { onConflict: 'codigo' }
  )
}

async function seedVendedorAndInstitutoBase() {
  await upsertRows(
    'vendedores',
    {
      id: IDS.vendedor,
      nome: 'Mariana Costa',
      email: ACCESS.vendedor.email,
      codigo_indicacao: 'VENDEDOR-DEMO',
      ativo: true,
      updated_at: nowIso(),
    },
    { onConflict: 'codigo_indicacao' }
  )

  await upsertRows(
    'institutos',
    {
      id: IDS.instituto,
      nome: 'Instituto Vida em Acao',
      email: ACCESS.instituto.email,
      codigo_indicacao: 'INSTITUTO-VIDA-EM-ACAO',
      ativo: true,
      sem_adesao: true,
      comissao_percentual_adesao: 0,
      comissao_percentual_mensalidade: 35,
      comissao_mensalidades_max: 6,
      updated_at: nowIso(),
    },
    { onConflict: 'codigo_indicacao' }
  )
}

async function seedAuthUsersAndLinks() {
  await ensureAuthUser({
    email: ACCESS.admin.email,
    password: ACCESS.admin.password,
    userMetadata: {
      is_admin: true,
      role: 'admin',
      name: 'Admin Demo',
    },
  })

  const vendedorUser = await ensureAuthUser({
    email: ACCESS.vendedor.email,
    password: ACCESS.vendedor.password,
    userMetadata: {
      is_vendedor: true,
      vendedor_id: IDS.vendedor,
      role: 'vendedor',
      name: 'Mariana Costa',
    },
  })

  const institutoUser = await ensureAuthUser({
    email: ACCESS.instituto.email,
    password: ACCESS.instituto.password,
    userMetadata: {
      is_instituto: true,
      instituto_id: IDS.instituto,
      role: 'instituto',
      name: 'Instituto Vida em Acao',
    },
  })

  await expectData(
    'vincular auth vendedor',
    supabase
      .from('vendedores')
      .update({ auth_user_id: vendedorUser.id, updated_at: nowIso() })
      .eq('id', IDS.vendedor)
      .select('id')
  )

  await expectData(
    'vincular auth instituto',
    supabase
      .from('institutos')
      .update({ auth_user_id: institutoUser.id, updated_at: nowIso() })
      .eq('id', IDS.instituto)
      .select('id')
  )
}

async function seedInstitutoPlans() {
  await upsertRows(
    'instituto_planos',
    [
      {
        id: IDS.institutoPlanoEssencial,
        instituto_id: IDS.instituto,
        nome: 'Plano Instituto Essencial',
        descricao: 'Contribuicao social por vida com mensalidade reduzida.',
        valor: 19.9,
        permite_dependentes: true,
        dependentes_minimos: 0,
        max_dependentes: null,
        valor_dependente_adicional: 19.9,
        ativo: true,
        ordem: 1,
        updated_at: nowIso(),
      },
      {
        id: IDS.institutoPlanoFamilia,
        instituto_id: IDS.instituto,
        nome: 'Plano Instituto Familia',
        descricao: 'Opcao para familias vinculadas ao instituto.',
        valor: 18.9,
        permite_dependentes: true,
        dependentes_minimos: 2,
        max_dependentes: null,
        valor_dependente_adicional: 18.9,
        ativo: true,
        ordem: 2,
        updated_at: nowIso(),
      },
    ],
    { onConflict: 'id' }
  )

  const planRows = await expectData(
    'buscar planos globais',
    supabase
      .from('planos')
      .select('id, codigo')
      .in('codigo', ['INDIVIDUAL', 'FAMILIAR', 'PLANO-EMPRESARIAL'])
  )

  const priceRows = planRows.map((plan) => ({
    instituto_id: IDS.instituto,
    plano_id: plan.id,
    valor_por_pessoa:
      plan.codigo === 'INDIVIDUAL' ? 24.9 : plan.codigo === 'FAMILIAR' ? 22.9 : 19.9,
    updated_at: nowIso(),
  }))

  if (priceRows.length > 0) {
    await upsertRows('instituto_plano_precos', priceRows, {
      onConflict: 'instituto_id,plano_id',
    })
  }
}

async function seedCadastros() {
  await upsertRows(
    'cadastros',
    [
      {
        id: IDS.cadastroIndividual,
        email: 'joao.silva@demo.shalomsaude.com.br',
        nome: 'Joao Silva',
        cpf: '123.456.789-09',
        rg: '1234567',
        data_nascimento: '1988-04-12',
        telefone: '(85) 98888-1001',
        sexo: 'Masculino',
        estado_civil: 'Solteiro(a)',
        escolaridade: 'Ensino Superior',
        endereco: 'Rua das Flores',
        numero: '120',
        complemento: 'Apto 301',
        bairro: 'Aldeota',
        cidade: 'Fortaleza',
        estado: 'CE',
        cep: '60150-160',
        tem_dependentes: false,
        vendedor_id: IDS.vendedor,
        vendedor_codigo: 'VENDEDOR-DEMO',
        instituto_id: null,
        instituto_codigo: null,
        sem_adesao: false,
        tipo_plano: 'INDIVIDUAL',
        mensalidade_valor: 29.9,
        mensalidade_billing_type: 'BOLETO',
        status: 'ATIVO',
        adesao_pago_em: daysAgo(18),
        asaas_customer_id: null,
        asaas_payment_id: null,
        asaas_subscription_id: null,
        termo_pdf_path: 'demo/termos/joao-silva.pdf',
        email_enviado_em: daysAgo(17),
        created_at: daysAgo(20),
        updated_at: nowIso(),
      },
      {
        id: IDS.cadastroFamiliar,
        email: 'camila.rocha@demo.shalomsaude.com.br',
        nome: 'Camila Rocha',
        cpf: '987.654.321-00',
        rg: '7654321',
        data_nascimento: '1991-09-03',
        telefone: '(85) 98888-1002',
        sexo: 'Feminino',
        estado_civil: 'Casado(a)',
        nome_conjuge: 'Rafael Rocha',
        escolaridade: 'Ensino Superior',
        endereco: 'Avenida Beira Mar',
        numero: '900',
        complemento: 'Bloco B',
        bairro: 'Meireles',
        cidade: 'Fortaleza',
        estado: 'CE',
        cep: '60165-121',
        tem_dependentes: true,
        vendedor_id: IDS.vendedor,
        vendedor_codigo: 'VENDEDOR-DEMO',
        instituto_id: null,
        instituto_codigo: null,
        sem_adesao: false,
        tipo_plano: 'FAMILIAR',
        mensalidade_valor: 74.7,
        mensalidade_billing_type: 'CREDIT_CARD',
        status: 'ATIVO',
        adesao_pago_em: daysAgo(42),
        asaas_customer_id: null,
        asaas_payment_id: null,
        asaas_subscription_id: null,
        termo_pdf_path: 'demo/termos/camila-rocha.pdf',
        email_enviado_em: daysAgo(41),
        created_at: daysAgo(45),
        updated_at: nowIso(),
      },
      {
        id: IDS.cadastroInstituto,
        email: 'carlos.almeida@demo.shalomsaude.com.br',
        nome: 'Carlos Almeida',
        cpf: '390.533.447-05',
        rg: '3322110',
        data_nascimento: '1982-01-22',
        telefone: '(85) 98888-1003',
        sexo: 'Masculino',
        estado_civil: 'Casado(a)',
        escolaridade: 'Ensino Medio',
        endereco: 'Rua Esperanca',
        numero: '55',
        bairro: 'Parangaba',
        cidade: 'Fortaleza',
        estado: 'CE',
        cep: '60720-010',
        tem_dependentes: true,
        vendedor_id: null,
        vendedor_codigo: null,
        instituto_id: IDS.instituto,
        instituto_codigo: 'INSTITUTO-VIDA-EM-ACAO',
        sem_adesao: true,
        tipo_plano: IDS.institutoPlanoFamilia,
        mensalidade_valor: 56.7,
        mensalidade_billing_type: 'BOLETO',
        status: 'ATIVO',
        adesao_pago_em: daysAgo(12),
        asaas_customer_id: null,
        asaas_payment_id: null,
        asaas_subscription_id: null,
        termo_pdf_path: 'demo/termos/carlos-almeida.pdf',
        email_enviado_em: daysAgo(11),
        created_at: daysAgo(14),
        updated_at: nowIso(),
      },
      {
        id: IDS.cadastroPendente,
        email: 'paula.martins@demo.shalomsaude.com.br',
        nome: 'Paula Martins',
        cpf: '935.411.347-80',
        rg: '4567890',
        data_nascimento: '1996-06-18',
        telefone: '(85) 98888-1004',
        sexo: 'Feminino',
        estado_civil: 'Solteiro(a)',
        escolaridade: 'Ensino Superior',
        endereco: 'Rua Central',
        numero: '210',
        bairro: 'Centro',
        cidade: 'Fortaleza',
        estado: 'CE',
        cep: '60025-060',
        tem_dependentes: false,
        vendedor_id: IDS.vendedor,
        vendedor_codigo: 'VENDEDOR-DEMO',
        instituto_id: null,
        instituto_codigo: null,
        sem_adesao: false,
        tipo_plano: 'INDIVIDUAL',
        mensalidade_valor: 29.9,
        mensalidade_billing_type: 'BOLETO',
        status: 'PENDENTE_PAGAMENTO',
        adesao_pago_em: null,
        asaas_customer_id: null,
        asaas_payment_id: null,
        asaas_subscription_id: null,
        termo_pdf_path: null,
        email_enviado_em: null,
        created_at: daysAgo(2),
        updated_at: nowIso(),
      },
    ],
    { onConflict: 'id' }
  )
}

async function seedDependentes() {
  await upsertRows(
    'dependentes',
    [
      {
        id: IDS.dependentePedro,
        cadastro_id: IDS.cadastroFamiliar,
        nome: 'Pedro Rocha',
        rg: '9988771',
        cpf: '111.444.777-35',
        data_nascimento: '2014-02-10',
        relacao: 'Filho(a)',
        email: 'pedro.rocha@demo.shalomsaude.com.br',
        telefone_celular: '(85) 98888-2001',
        sexo: 'Masculino',
        created_at: daysAgo(45),
      },
      {
        id: IDS.dependenteBeatriz,
        cadastro_id: IDS.cadastroFamiliar,
        nome: 'Beatriz Rocha',
        rg: '9988772',
        cpf: '529.982.247-25',
        data_nascimento: '2017-11-05',
        relacao: 'Filho(a)',
        email: 'beatriz.rocha@demo.shalomsaude.com.br',
        telefone_celular: '(85) 98888-2002',
        sexo: 'Feminino',
        created_at: daysAgo(45),
      },
      {
        id: IDS.dependenteRafaela,
        cadastro_id: IDS.cadastroInstituto,
        nome: 'Rafaela Almeida',
        rg: '5544332',
        cpf: '246.813.579-28',
        data_nascimento: '2016-08-19',
        relacao: 'Filho(a)',
        email: 'rafaela.almeida@demo.shalomsaude.com.br',
        telefone_celular: '(85) 98888-2003',
        sexo: 'Feminino',
        created_at: daysAgo(14),
      },
    ],
    { onConflict: 'id' }
  )
}

async function seedCommissionPayments() {
  await upsertRows(
    'vendedor_comissao_pagamentos',
    [
      {
        vendedor_id: IDS.vendedor,
        mes_referencia: monthReference(-1),
        valor_total: 52.3,
        pago_em: daysAgo(8),
        comprovante_path: 'demo/comissoes/vendedor-mes-passado.pdf',
        comprovante_url: 'https://example.com/demo/vendedor-mes-passado.pdf',
        observacao: 'Pagamento demo referente aos contratos ativos do mes anterior.',
        updated_at: nowIso(),
      },
      {
        vendedor_id: IDS.vendedor,
        mes_referencia: monthReference(0),
        valor_total: 14.95,
        pago_em: daysAgo(1),
        comprovante_path: 'demo/comissoes/vendedor-mes-atual.pdf',
        comprovante_url: 'https://example.com/demo/vendedor-mes-atual.pdf',
        observacao: 'Pagamento demo parcial do mes atual.',
        updated_at: nowIso(),
      },
    ],
    { onConflict: 'vendedor_id,mes_referencia' }
  )

  await upsertRows(
    'instituto_comissao_pagamentos',
    [
      {
        instituto_id: IDS.instituto,
        mes_referencia: monthReference(-1),
        valor_total: 39.69,
        pago_em: daysAgo(6),
        comprovante_path: 'demo/comissoes/instituto-mes-passado.pdf',
        comprovante_url: 'https://example.com/demo/instituto-mes-passado.pdf',
        observacao: 'Pagamento demo de comissao do instituto.',
        updated_at: nowIso(),
      },
    ],
    { onConflict: 'instituto_id,mes_referencia' }
  )
}

function printSummary() {
  console.log('')
  console.log('Seed demo concluido.')
  console.log('')
  console.log('Acessos:')
  console.log(`- Admin:     ${ACCESS.admin.email} / ${ACCESS.admin.password}`)
  console.log(`- Vendedor:  ${ACCESS.vendedor.email} / ${ACCESS.vendedor.password}`)
  console.log(`- Instituto: ${ACCESS.instituto.email} / ${ACCESS.instituto.password}`)
  console.log('')
  console.log('Login cliente demo:')
  console.log('- Titular individual: CPF 123.456.789-09 / prefixo 1234')
  console.log('- Titular familiar:   CPF 987.654.321-00 / prefixo 9876')
  console.log('')
  console.log('Links de indicacao:')
  console.log('- Vendedor:  /cadastro?ref=VENDEDOR-DEMO')
  console.log('- Instituto: /cadastro?ref=INSTITUTO-VIDA-EM-ACAO')
}

async function main() {
  console.log('Populando banco demo do SHALOM_SAUDE_WHITELABEL...')
  await seedBillingSettings()
  await seedPlans()
  await seedVendedorAndInstitutoBase()
  await seedAuthUsersAndLinks()
  await seedInstitutoPlans()
  await seedCadastros()
  await seedDependentes()
  await seedCommissionPayments()
  printSummary()
}

main().catch((error) => {
  console.error('')
  console.error('Seed demo falhou.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
