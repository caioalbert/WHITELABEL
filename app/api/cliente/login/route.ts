import {
  formatCpfForDb,
  verifyCpfPrefix,
} from '@/lib/cliente-login-verify'
import { getJwtSecret } from '@/lib/auth-secret'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  EMPRESA_APP_COOKIE,
  EMPRESA_FLOW_COOKIE,
  createEmpresaToken,
} from '@/lib/supabase/empresa-auth'
import { isValidCNPJ, normalizeCNPJ } from '@/lib/utils'
import { CADASTRO_FLOW_COOKIE, createCadastroFlowToken } from '@/lib/supabase/cadastro-flow-auth'
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

type CadastroLoginRow = {
  id: string
  nome: string
  email: string | null
  cpf: string | null
  status: string | null
}

type DependenteLoginRow = {
  id: string
  cadastro_id: string
  nome: string
  email: string | null
  cpf: string | null
}

type ClienteLoginIdentity = {
  tipo: 'titular' | 'dependente'
  clienteId: string
  dependenteId?: string
  nome: string
  email: string | null
  cpf: string
  cadastro: CadastroLoginRow
}

type ClienteLoginResolveResult =
  | { ok: true; identity: ClienteLoginIdentity }
  | { ok: false; error: string; status: 401 | 409 }

type SupabaseServerClient = ReturnType<typeof createAdminClient>

const INVALID_CREDENTIALS_ERROR = 'CPF ou dígitos de confirmação incorretos.'

function buildCpfCandidates(cpfClean: string) {
  return Array.from(new Set([formatCpfForDb(cpfClean), cpfClean]))
}

async function findCadastroByCpf(
  supabase: SupabaseServerClient,
  cpfCandidates: string[]
): Promise<CadastroLoginRow | null> {
  const { data, error } = await supabase
    .from('cadastros')
    .select('id, nome, email, cpf, status')
    .in('cpf', cpfCandidates)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

async function resolveClienteLogin(
  supabase: SupabaseServerClient,
  cpfClean: string
): Promise<ClienteLoginResolveResult> {
  const cpfCandidates = buildCpfCandidates(cpfClean)
  const cadastro = await findCadastroByCpf(supabase, cpfCandidates)

  if (cadastro) {
    return {
      ok: true,
      identity: {
        tipo: 'titular',
        clienteId: cadastro.id,
        nome: cadastro.nome,
        email: cadastro.email,
        cpf: String(cadastro.cpf || cpfClean),
        cadastro,
      },
    }
  }

  const { data: dependentes, error: dependenteError } = await supabase
    .from('dependentes')
    .select('id, cadastro_id, nome, email, cpf')
    .in('cpf', cpfCandidates)
    .limit(2)

  if (dependenteError) {
    throw dependenteError
  }

  if (!dependentes || dependentes.length === 0) {
    return { ok: false, error: INVALID_CREDENTIALS_ERROR, status: 401 }
  }

  if (dependentes.length > 1) {
    return {
      ok: false,
      error: 'CPF cadastrado em mais de um dependente. Procure o suporte.',
      status: 409,
    }
  }

  const dependente = dependentes[0] as DependenteLoginRow
  const { data: cadastroTitular, error: cadastroTitularError } = await supabase
    .from('cadastros')
    .select('id, nome, email, cpf, status')
    .eq('id', dependente.cadastro_id)
    .maybeSingle()

  if (cadastroTitularError) {
    throw cadastroTitularError
  }

  if (!cadastroTitular) {
    return { ok: false, error: INVALID_CREDENTIALS_ERROR, status: 401 }
  }

  return {
    ok: true,
    identity: {
      tipo: 'dependente',
      clienteId: cadastroTitular.id,
      dependenteId: dependente.id,
      nome: dependente.nome,
      email: dependente.email || cadastroTitular.email,
      cpf: String(dependente.cpf || cpfClean),
      cadastro: cadastroTitular,
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cpf, cpf_prefix, cnpj, cnpj_prefix } = body

    if (cnpj !== undefined) {
      const cnpjClean = normalizeCNPJ(String(cnpj || ''))
      const prefixClean = String(cnpj_prefix || '').replace(/\D/g, '')

      if (!isValidCNPJ(cnpjClean)) {
        return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 400 })
      }
      if (prefixClean.length !== 4 || cnpjClean.slice(0, 4) !== prefixClean) {
        return NextResponse.json({ error: 'CNPJ ou dígitos de confirmação incorretos.' }, { status: 401 })
      }

      const supabase = createAdminClient()
      const { data: empresa, error } = await supabase
        .from('empresas')
        .select('id, cnpj, razao_social, nome_fantasia, email, status')
        .eq('cnpj', cnpjClean)
        .maybeSingle()

      if (error) throw error
      if (!empresa) {
        return NextResponse.json({ error: 'CNPJ ou dígitos de confirmação incorretos.' }, { status: 401 })
      }

      const isActive = empresa.status === 'ATIVO'
      const purpose = isActive ? 'empresa-app' : 'empresa-flow'
      const token = await createEmpresaToken(empresa, purpose)
      const response = NextResponse.json({
        success: true,
        nextPath: isActive ? '/empresa/dashboard' : '/empresa/cadastro',
        empresa: {
          id: empresa.id,
          nome: empresa.nome_fantasia || empresa.razao_social,
          email: empresa.email,
          status: empresa.status,
        },
      })
      response.cookies.set(isActive ? EMPRESA_APP_COOKIE : EMPRESA_FLOW_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * (isActive ? 24 * 7 : 24),
        path: '/',
      })
      response.cookies.delete(isActive ? EMPRESA_FLOW_COOKIE : EMPRESA_APP_COOKIE)
      return response
    }

    if (!cpf) {
      return NextResponse.json({ error: 'CPF é obrigatório.' }, { status: 400 })
    }

    const hasPrefix =
      cpf_prefix !== undefined && cpf_prefix !== null && String(cpf_prefix).trim() !== ''
    if (!hasPrefix) {
      return NextResponse.json(
        {
          error: 'Informe os 4 primeiros dígitos do CPF.',
        },
        { status: 400 }
      )
    }

    const cpfClean = String(cpf).replace(/\D/g, '')
    if (cpfClean.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
    }

    const prefixClean = String(cpf_prefix).replace(/\D/g, '')
    if (prefixClean.length !== 4) {
      return NextResponse.json(
        { error: 'Informe exatamente os 4 primeiros dígitos do CPF.' },
        { status: 400 }
      )
    }
    if (cpfClean.slice(0, 4) !== prefixClean) {
      return NextResponse.json(
        { error: INVALID_CREDENTIALS_ERROR },
        { status: 401 }
      )
    }

    const supabase = createAdminClient()
    const loginResult = await resolveClienteLogin(supabase, cpfClean)

    if (!loginResult.ok) {
      return NextResponse.json(
        { error: loginResult.error },
        { status: loginResult.status }
      )
    }

    const { identity } = loginResult
    const secondFactorOk = verifyCpfPrefix(identity, String(cpf_prefix))

    if (!secondFactorOk) {
      return NextResponse.json(
        { error: INVALID_CREDENTIALS_ERROR },
        { status: 401 }
      )
    }

    if (identity.cadastro.status !== 'ATIVO') {
      const flowToken = await createCadastroFlowToken(identity.clienteId)
      const pendingResponse = NextResponse.json({
        success: true,
        nextPath: '/cadastro/status',
        status: identity.cadastro.status || 'PENDENTE_PAGAMENTO',
      })
      pendingResponse.cookies.set(CADASTRO_FLOW_COOKIE, flowToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24,
        path: '/',
      })
      return pendingResponse
    }

    const jwtPayload: Record<string, string> = {
      clienteId: identity.clienteId,
      cpf: identity.cpf,
      nome: identity.nome,
      tipo: identity.tipo,
    }

    if (identity.email) {
      jwtPayload.email = identity.email
    }

    if (identity.dependenteId) {
      jwtPayload.dependenteId = identity.dependenteId
    }

    const token = await new SignJWT({
      ...jwtPayload,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(getJwtSecret())

    const response = NextResponse.json({
      success: true,
      nextPath: '/cliente/dashboard',
      token,
      cliente: {
        id: identity.clienteId,
        dependenteId: identity.dependenteId,
        tipo: identity.tipo,
        nome: identity.nome,
        email: identity.email,
      },
    })

    response.cookies.set('cliente_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Erro no login do cliente:', error)
    return NextResponse.json({ error: 'Erro ao processar login.' }, { status: 500 })
  }
}
