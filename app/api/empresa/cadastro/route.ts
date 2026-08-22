import { EMPRESA_FLOW_COOKIE, createEmpresaToken } from '@/lib/supabase/empresa-auth'
import { EMPRESA_STATUSES, empresaNextStep, loadEmpresaPlan } from '@/lib/empresa-flow'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidCNPJ, isValidEmail, normalizeCNPJ } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })

    const empresa = {
      razao_social: text(body.razao_social),
      nome_fantasia: text(body.nome_fantasia) || null,
      cnpj: normalizeCNPJ(text(body.cnpj)),
      email: text(body.email).toLowerCase(),
      telefone: text(body.telefone),
      responsavel_nome: text(body.responsavel_nome),
      endereco: text(body.endereco),
      numero: text(body.numero),
      complemento: text(body.complemento) || null,
      bairro: text(body.bairro),
      cidade: text(body.cidade),
      estado: text(body.estado).toUpperCase(),
      cep: text(body.cep),
    }

    if (
      !empresa.razao_social || !empresa.email || !empresa.telefone ||
      !empresa.responsavel_nome || !empresa.endereco || !empresa.numero ||
      !empresa.bairro || !empresa.cidade || !empresa.estado || !empresa.cep
    ) {
      return NextResponse.json({ error: 'Preencha todos os dados obrigatórios da empresa.' }, { status: 400 })
    }

    if (!isValidCNPJ(empresa.cnpj)) {
      return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 400 })
    }

    if (!isValidEmail(empresa.email)) {
      return NextResponse.json({ error: 'Email da empresa inválido.' }, { status: 400 })
    }

    if (!/^\d{8}$/.test(empresa.cep.replace(/\D/g, '')) || !/^[A-Z]{2}$/.test(empresa.estado)) {
      return NextResponse.json({ error: 'CEP ou UF inválido.' }, { status: 400 })
    }

    const plan = await loadEmpresaPlan()
    const supabase = createAdminClient()
    const [existingCnpj, existingEmail] = await Promise.all([
      supabase.from('empresas').select('id').eq('cnpj', empresa.cnpj).limit(1),
      supabase.from('empresas').select('id').eq('email', empresa.email).limit(1),
    ])
    if (existingCnpj.error || existingEmail.error) {
      throw existingCnpj.error || existingEmail.error
    }

    if (existingCnpj.data?.length || existingEmail.data?.length) {
      return NextResponse.json(
        { error: 'CNPJ ou email já identificado. Use o login de empresa para continuar.' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('empresas')
      .insert({
        ...empresa,
        tipo_plano: plan.codigo,
        status: EMPRESA_STATUSES.cadastro,
      })
      .select('id, cnpj, razao_social, status, tipo_plano')
      .single()

    if (error || !data) {
      const details = `${error?.message || ''} ${error?.details || ''}`
      if (/duplicate|empresas_cnpj|empresas_email/i.test(details)) {
        return NextResponse.json(
          { error: 'CNPJ ou email já identificado. Use o login de empresa para continuar.' },
          { status: 409 }
        )
      }
      throw error || new Error('Não foi possível salvar a empresa.')
    }

    const token = await createEmpresaToken(data, 'empresa-flow')
    const response = NextResponse.json({
      success: true,
      empresa: data,
      nextStep: empresaNextStep(EMPRESA_STATUSES.cadastro),
    })
    response.cookies.set(EMPRESA_FLOW_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })
    return response
  } catch (error) {
    console.error('Erro no cadastro da empresa:', error)
    const message = error instanceof Error ? error.message : ''
    if (/plano empresarial/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao cadastrar empresa.' }, { status: 500 })
  }
}
