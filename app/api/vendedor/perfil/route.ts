import { createAdminClient } from '@/lib/supabase/admin'
import { requireSellerAuth } from '@/lib/supabase/seller-auth'
import { isValidEmail } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

function isConnectivityIssue(details: string) {
  return /fetch failed|enotfound|getaddrinfo|network/i.test(details)
}

function isVendedoresSchemaIssue(details: string) {
  return /relation .*vendedores|does not exist|42P01|column .*vendedor_id|auth_user_id/i.test(details)
}

function normalizeCodePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireSellerAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          nome?: unknown
          email?: unknown
          codigoIndicacao?: unknown
          senha?: unknown
        }
      | null

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    const hasNome = Object.prototype.hasOwnProperty.call(body, 'nome')
    const hasEmail = Object.prototype.hasOwnProperty.call(body, 'email')
    const hasCodigoIndicacao = Object.prototype.hasOwnProperty.call(body, 'codigoIndicacao')
    const hasSenha = Object.prototype.hasOwnProperty.call(body, 'senha')

    if (!hasNome && !hasEmail && !hasCodigoIndicacao && !hasSenha) {
      return NextResponse.json({ error: 'Nenhum dado de atualização foi enviado.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: vendedorAtual, error: vendedorAtualError } = await supabase
      .from('vendedores')
      .select('id, nome, email, codigo_indicacao, auth_user_id, ativo')
      .eq('id', authResult.vendedorId)
      .maybeSingle()

    if (vendedorAtualError) {
      const details = `${vendedorAtualError.message || ''} ${vendedorAtualError.details || ''}`
      if (isVendedoresSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/007_add_vendedores_module.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (isConnectivityIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao buscar vendedor.' }, { status: 500 })
    }

    if (!vendedorAtual || vendedorAtual.ativo !== true) {
      return NextResponse.json({ error: 'Vendedor inativo ou não encontrado.' }, { status: 403 })
    }

    const nome = hasNome ? String(body.nome || '').trim() : vendedorAtual.nome
    const email = hasEmail ? String(body.email || '').trim().toLowerCase() : vendedorAtual.email
    const codigoIndicacao = hasCodigoIndicacao
      ? normalizeCodePart(String(body.codigoIndicacao || '').trim())
      : vendedorAtual.codigo_indicacao
    const senha = hasSenha ? String(body.senha || '').trim() : ''

    if (!nome) {
      return NextResponse.json({ error: 'Nome do vendedor é obrigatório.' }, { status: 400 })
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Email do vendedor inválido.' }, { status: 400 })
    }

    if (!codigoIndicacao) {
      return NextResponse.json({ error: 'Código de indicação inválido.' }, { status: 400 })
    }

    if (senha && senha.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 })
    }

    if (senha && !vendedorAtual.auth_user_id) {
      return NextResponse.json(
        { error: 'Usuário sem vínculo de autenticação para alteração de senha.' },
        { status: 400 }
      )
    }

    if (email !== vendedorAtual.email) {
      const { data: emailConflict, error: emailConflictError } = await supabase
        .from('vendedores')
        .select('id')
        .eq('email', email)
        .neq('id', vendedorAtual.id)
        .maybeSingle()

      if (emailConflictError) {
        const details = `${emailConflictError.message || ''} ${emailConflictError.details || ''}`
        if (isVendedoresSchemaIssue(details)) {
          return NextResponse.json(
            {
              error:
                'Banco desatualizado. Execute scripts/007_add_vendedores_module.sql no Supabase SQL Editor.',
            },
            { status: 500 }
          )
        }

        if (isConnectivityIssue(details)) {
          return NextResponse.json(
            {
              error:
                'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
            },
            { status: 503 }
          )
        }

        return NextResponse.json({ error: 'Erro ao validar email do vendedor.' }, { status: 500 })
      }

      if (emailConflict) {
        return NextResponse.json({ error: 'Já existe vendedor com este email.' }, { status: 409 })
      }
    }

    if (codigoIndicacao !== vendedorAtual.codigo_indicacao) {
      const { data: codeConflict, error: codeConflictError } = await supabase
        .from('vendedores')
        .select('id')
        .eq('codigo_indicacao', codigoIndicacao)
        .neq('id', vendedorAtual.id)
        .maybeSingle()

      if (codeConflictError) {
        const details = `${codeConflictError.message || ''} ${codeConflictError.details || ''}`
        if (isVendedoresSchemaIssue(details)) {
          return NextResponse.json(
            {
              error:
                'Banco desatualizado. Execute scripts/007_add_vendedores_module.sql no Supabase SQL Editor.',
            },
            { status: 500 }
          )
        }

        if (isConnectivityIssue(details)) {
          return NextResponse.json(
            {
              error:
                'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
            },
            { status: 503 }
          )
        }

        return NextResponse.json({ error: 'Erro ao validar código de indicação.' }, { status: 500 })
      }

      if (codeConflict) {
        return NextResponse.json({ error: 'Já existe vendedor com este código de indicação.' }, { status: 409 })
      }
    }

    if (vendedorAtual.auth_user_id && (email !== vendedorAtual.email || senha)) {
      const authPayload: { email?: string; password?: string } = {}
      if (email !== vendedorAtual.email) {
        authPayload.email = email
      }
      if (senha) {
        authPayload.password = senha
      }

      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
        vendedorAtual.auth_user_id,
        authPayload
      )

      if (authUpdateError) {
        const details = `${authUpdateError.message || ''} ${authUpdateError.status || ''}`
        if (/already registered|already exists|already been registered|duplicate/i.test(details)) {
          return NextResponse.json(
            { error: 'Já existe usuário autenticado com este email.' },
            { status: 409 }
          )
        }

        if (isConnectivityIssue(details)) {
          return NextResponse.json(
            {
              error:
                'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
            },
            { status: 503 }
          )
        }

        return NextResponse.json(
          { error: 'Erro ao atualizar credenciais de acesso.' },
          { status: 500 }
        )
      }
    }

    const { data: vendedorAtualizado, error: updateError } = await supabase
      .from('vendedores')
      .update({
        nome,
        email,
        codigo_indicacao: codigoIndicacao,
      })
      .eq('id', vendedorAtual.id)
      .select('id, nome, email, codigo_indicacao, ativo, created_at, updated_at')
      .maybeSingle()

    if (updateError) {
      const details = `${updateError.message || ''} ${updateError.details || ''}`
      if (isVendedoresSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/007_add_vendedores_module.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (/duplicate key|vendedores_email_idx/i.test(details)) {
        return NextResponse.json({ error: 'Já existe vendedor com este email.' }, { status: 409 })
      }

      if (/duplicate key|vendedores_codigo_idx/i.test(details)) {
        return NextResponse.json({ error: 'Já existe vendedor com este código de indicação.' }, { status: 409 })
      }

      if (isConnectivityIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao atualizar cadastro do vendedor.' }, { status: 500 })
    }

    if (!vendedorAtualizado) {
      return NextResponse.json({ error: 'Vendedor não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      vendedor: {
        id: vendedorAtualizado.id,
        nome: vendedorAtualizado.nome,
        email: vendedorAtualizado.email,
        codigoIndicacao: vendedorAtualizado.codigo_indicacao,
        ativo: vendedorAtualizado.ativo,
      },
      message: 'Seu cadastro foi atualizado com sucesso.',
    })
  } catch (error) {
    console.error('Vendedor perfil PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}
