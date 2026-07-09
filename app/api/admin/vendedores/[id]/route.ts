import { createAdminClient } from '@/lib/supabase/admin'
import { AsaasIntegrationError } from '@/lib/asaas'
import { buildComissaoResumo } from '@/lib/comissoes'
import { hydrateCadastrosWithPrimeiraMensalidadePaga } from '@/lib/comissoes-asaas'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { isValidEmail } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

async function getValidatedId(context: RouteContext) {
  const { id } = await context.params
  return id?.trim() || null
}

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

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const vendedorId = await getValidatedId(context)
    if (!vendedorId) {
      return NextResponse.json({ error: 'ID de vendedor inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: vendedor, error: vendedorError } = await supabase
      .from('vendedores')
      .select('id, nome, email, codigo_indicacao, ativo, created_at, updated_at')
      .eq('id', vendedorId)
      .maybeSingle()

    if (vendedorError) {
      const details = `${vendedorError.message || ''} ${vendedorError.details || ''}`
      if (/relation .*vendedores|does not exist|42P01|column .*vendedor_id/i.test(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/007_add_vendedores_module.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
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

    if (!vendedor) {
      return NextResponse.json({ error: 'Vendedor não encontrado.' }, { status: 404 })
    }

    const { data: clientes, error: clientesError } = await supabase
      .from('cadastros')
      .select(
        'id, nome, email, cpf, status, created_at, adesao_pago_em, mensalidade_valor, vendedor_codigo, tipo_plano, asaas_subscription_id'
      )
      .eq('vendedor_id', vendedor.id)
      .order('created_at', { ascending: false })

    if (clientesError) {
      const details = `${clientesError.message || ''} ${clientesError.details || ''}`
      if (/column .*vendedor_id|vendedor_codigo|mensalidade_valor|adesao_pago_em|status|tipo_plano|asaas_subscription_id/i.test(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/004_add_cadastro_pagamentos.sql, scripts/006_add_plan_type_pricing.sql e scripts/007_add_vendedores_module.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao buscar clientes do vendedor.' }, { status: 500 })
    }

    const { data: pagamentosComissao, error: pagamentosComissaoError } = await supabase
      .from('vendedor_comissao_pagamentos')
      .select(
        'id, vendedor_id, mes_referencia, valor_total, pago_em, comprovante_path, comprovante_url, observacao, created_at, updated_at'
      )
      .eq('vendedor_id', vendedor.id)
      .order('mes_referencia', { ascending: false })

    if (pagamentosComissaoError) {
      const details = `${pagamentosComissaoError.message || ''} ${pagamentosComissaoError.details || ''}`
      if (/relation .*vendedor_comissao_pagamentos|does not exist|42P01|column .*mes_referencia/i.test(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/008_add_vendedor_comissao_pagamentos.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao buscar pagamentos de comissão.' }, { status: 500 })
    }

    const allClientes = clientes || []
    const clientesComPrimeiraMensalidade = await hydrateCadastrosWithPrimeiraMensalidadePaga(
      allClientes
    )
    const comissaoResumo = buildComissaoResumo(
      clientesComPrimeiraMensalidade,
      pagamentosComissao || []
    )
    const totalPendentes = allClientes.length - comissaoResumo.totalVendasPagas
    const appBaseUrl = request.nextUrl.origin.replace(/\/$/, '')

    return NextResponse.json({
      success: true,
      vendedor: {
        id: vendedor.id,
        nome: vendedor.nome,
        email: vendedor.email,
        codigoIndicacao: vendedor.codigo_indicacao,
        ativo: vendedor.ativo,
        linkVenda: `${appBaseUrl}/cadastro?ref=${encodeURIComponent(vendedor.codigo_indicacao)}`,
      },
      resumo: {
        totalClientes: allClientes.length,
        vendasFechadas: comissaoResumo.totalVendasPagas,
        totalPendentes,
        comissaoMesAtual: comissaoResumo.comissaoMesAtualPendente,
        comissaoMesAtualBruta: comissaoResumo.comissaoMesAtualBruta,
        comissaoMesAtualPaga: comissaoResumo.comissaoMesAtualPaga,
        comissaoTotalBruta: comissaoResumo.comissaoTotalBruta,
        comissaoTotalPaga: comissaoResumo.comissaoTotalPaga,
        comissaoTotalDevida: comissaoResumo.comissaoTotalDevida,
      },
      comissoesMensais: comissaoResumo.comissoesMensais,
      clientes: allClientes,
    })
  } catch (error) {
    if (error instanceof AsaasIntegrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Admin vendedor detalhe error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const vendedorId = await getValidatedId(context)
    if (!vendedorId) {
      return NextResponse.json({ error: 'ID de vendedor inválido.' }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as
      | {
          ativo?: unknown
          nome?: unknown
          email?: unknown
          codigoIndicacao?: unknown
          senha?: unknown
        }
      | null

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    const hasStatusPayload = typeof body.ativo === 'boolean'
    const hasProfilePayload =
      Object.prototype.hasOwnProperty.call(body, 'nome') ||
      Object.prototype.hasOwnProperty.call(body, 'email') ||
      Object.prototype.hasOwnProperty.call(body, 'codigoIndicacao') ||
      Object.prototype.hasOwnProperty.call(body, 'senha')

    if (hasStatusPayload && hasProfilePayload) {
      return NextResponse.json(
        { error: 'Envie atualização de status e atualização cadastral em requisições separadas.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    if (hasStatusPayload) {
      const { data: vendedor, error: updateError } = await supabase
        .from('vendedores')
        .update({ ativo: body.ativo as boolean })
        .eq('id', vendedorId)
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

        if (isConnectivityIssue(details)) {
          return NextResponse.json(
            {
              error:
                'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
            },
            { status: 503 }
          )
        }

        return NextResponse.json({ error: 'Erro ao atualizar status do vendedor.' }, { status: 500 })
      }

      if (!vendedor) {
        return NextResponse.json({ error: 'Vendedor não encontrado.' }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        vendedor,
        message: vendedor.ativo ? 'Vendedor desbloqueado com sucesso.' : 'Vendedor bloqueado com sucesso.',
      })
    }

    if (!hasProfilePayload) {
      return NextResponse.json({ error: 'Nenhum dado de atualização foi enviado.' }, { status: 400 })
    }

    const { data: vendedorAtual, error: vendedorAtualError } = await supabase
      .from('vendedores')
      .select('id, nome, email, codigo_indicacao, auth_user_id')
      .eq('id', vendedorId)
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

    if (!vendedorAtual) {
      return NextResponse.json({ error: 'Vendedor não encontrado.' }, { status: 404 })
    }

    const hasNome = Object.prototype.hasOwnProperty.call(body, 'nome')
    const hasEmail = Object.prototype.hasOwnProperty.call(body, 'email')
    const hasCodigoIndicacao = Object.prototype.hasOwnProperty.call(body, 'codigoIndicacao')
    const hasSenha = Object.prototype.hasOwnProperty.call(body, 'senha')

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
        { error: 'Este vendedor não possui usuário de acesso vinculado para atualizar senha.' },
        { status: 400 }
      )
    }

    if (email !== vendedorAtual.email) {
      const { data: emailConflict, error: emailConflictError } = await supabase
        .from('vendedores')
        .select('id')
        .eq('email', email)
        .neq('id', vendedorId)
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
        .neq('id', vendedorId)
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
          { error: 'Erro ao atualizar credenciais de acesso do vendedor.' },
          { status: 500 }
        )
      }
    }

    const { data: vendedorAtualizado, error: updateProfileError } = await supabase
      .from('vendedores')
      .update({
        nome,
        email,
        codigo_indicacao: codigoIndicacao,
      })
      .eq('id', vendedorId)
      .select('id, nome, email, codigo_indicacao, ativo, created_at, updated_at')
      .maybeSingle()

    if (updateProfileError) {
      const details = `${updateProfileError.message || ''} ${updateProfileError.details || ''}`
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
      vendedor: vendedorAtualizado,
      message: 'Cadastro do vendedor atualizado com sucesso.',
    })
  } catch (error) {
    console.error('Admin vendedor PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const vendedorId = await getValidatedId(context)
    if (!vendedorId) {
      return NextResponse.json({ error: 'ID de vendedor inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: vendedor, error: vendedorError } = await supabase
      .from('vendedores')
      .select('id, nome, auth_user_id')
      .eq('id', vendedorId)
      .maybeSingle()

    if (vendedorError) {
      const details = `${vendedorError.message || ''} ${vendedorError.details || ''}`
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

      return NextResponse.json({ error: 'Erro ao buscar vendedor para exclusão.' }, { status: 500 })
    }

    if (!vendedor) {
      return NextResponse.json({ error: 'Vendedor não encontrado.' }, { status: 404 })
    }

    if (vendedor.auth_user_id) {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(vendedor.auth_user_id)
      if (authDeleteError) {
        const details = `${authDeleteError.message || ''} ${authDeleteError.status || ''}`

        if (!/user.*not found|not found/i.test(details)) {
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
            { error: 'Erro ao remover usuário de acesso do vendedor.' },
            { status: 500 }
          )
        }
      }
    }

    const { error: deleteError } = await supabase.from('vendedores').delete().eq('id', vendedorId)
    if (deleteError) {
      const details = `${deleteError.message || ''} ${deleteError.details || ''}`
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

      return NextResponse.json({ error: 'Erro ao excluir vendedor.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Vendedor "${vendedor.nome}" excluído com sucesso.`,
    })
  } catch (error) {
    console.error('Admin vendedor DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}
