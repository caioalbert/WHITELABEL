import { put } from '@vercel/blob'
import { AsaasIntegrationError } from '@/lib/asaas'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildComissaoResumo,
  formatMonthReferenceLabel,
  getMonthRangeUTC,
  normalizeCurrencyValue,
  parseMonthReference,
  toMonthReferenceUTC,
} from '@/lib/comissoes'
import { hydrateCadastrosWithPrimeiraMensalidadePaga } from '@/lib/comissoes-asaas'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

const MAX_COMPROVANTE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_COMPROVANTE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])
const ALLOWED_COMPROVANTE_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp'])

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

function parseCurrencyInput(value: string) {
  const raw = String(value || '').trim()
  if (!raw) return null

  let normalized = raw
  if (raw.includes(',') && raw.includes('.')) {
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else if (raw.includes(',')) {
    normalized = raw.replace(',', '.')
  }

  const amount = Number(normalized)
  if (!Number.isFinite(amount)) return null
  return amount
}

function normalizeComprovanteExtension(fileName: string, mimeType: string) {
  const rawExtension = fileName.split('.').pop()?.toLowerCase() || ''
  if (ALLOWED_COMPROVANTE_EXTENSIONS.has(rawExtension)) {
    return rawExtension === 'jpeg' ? 'jpg' : rawExtension
  }

  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg'

  return null
}

async function getValidatedSellerId(context: RouteContext) {
  const { id } = await context.params
  return id?.trim() || null
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const vendedorId = await getValidatedSellerId(context)
    if (!vendedorId) {
      return NextResponse.json({ error: 'ID de vendedor inválido.' }, { status: 400 })
    }

    const formData = await request.formData()
    const mesReferenciaInput = String(formData.get('mesReferencia') || '').trim()
    const mesReferencia = parseMonthReference(mesReferenciaInput)
    const monthRange = mesReferencia ? getMonthRangeUTC(mesReferencia) : null

    if (!monthRange) {
      return NextResponse.json({ error: 'Mês de referência inválido.' }, { status: 400 })
    }

    const currentMonthReference = toMonthReferenceUTC(new Date())
    if (monthRange.monthReference > currentMonthReference) {
      return NextResponse.json(
        { error: 'Não é possível registrar comissão para meses futuros.' },
        { status: 400 }
      )
    }

    const observacaoInput = String(formData.get('observacao') || '').trim()
    const valorPagoInput = parseCurrencyInput(String(formData.get('valorPago') || ''))
    if (String(formData.get('valorPago') || '').trim() && valorPagoInput === null) {
      return NextResponse.json({ error: 'Valor de pagamento inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: vendedor, error: vendedorError } = await supabase
      .from('vendedores')
      .select('id, nome, email')
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

      return NextResponse.json({ error: 'Erro ao validar vendedor.' }, { status: 500 })
    }

    if (!vendedor) {
      return NextResponse.json({ error: 'Vendedor não encontrado.' }, { status: 404 })
    }

    const { data: cadastrosAtivos, error: cadastrosAtivosError } = await supabase
      .from('cadastros')
      .select(
        'id, status, adesao_pago_em, mensalidade_valor, asaas_subscription_id'
      )
      .eq('vendedor_id', vendedor.id)
      .eq('status', 'ATIVO')
      .not('adesao_pago_em', 'is', null)

    if (cadastrosAtivosError) {
      const details = `${cadastrosAtivosError.message || ''} ${cadastrosAtivosError.details || ''}`
      if (/column .*vendedor_id|mensalidade_valor|adesao_pago_em|status|asaas_subscription_id/i.test(details)) {
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

      return NextResponse.json({ error: 'Erro ao calcular comissão do mês.' }, { status: 500 })
    }

    const cadastrosComPrimeiraMensalidade = await hydrateCadastrosWithPrimeiraMensalidadePaga(
      cadastrosAtivos || []
    )
    const resumoCompetencias = buildComissaoResumo(cadastrosComPrimeiraMensalidade, [])
    const competenciaMes = resumoCompetencias.comissoesMensais.find(
      (item) => item.mesReferencia === monthRange.monthReference
    )
    const totalComissaoMes = normalizeCurrencyValue(competenciaMes?.valorTotal)

    if (totalComissaoMes <= 0) {
      return NextResponse.json(
        {
          error: `Sem comissão devida para ${formatMonthReferenceLabel(monthRange.monthReference)}.`,
        },
        { status: 400 }
      )
    }

    const { data: pagamentoExistente, error: pagamentoExistenteError } = await supabase
      .from('vendedor_comissao_pagamentos')
      .select('id, valor_total, pago_em, comprovante_path, comprovante_url, observacao')
      .eq('vendedor_id', vendedor.id)
      .eq('mes_referencia', monthRange.monthReference)
      .maybeSingle()

    if (pagamentoExistenteError) {
      const details = `${pagamentoExistenteError.message || ''} ${pagamentoExistenteError.details || ''}`
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

      return NextResponse.json({ error: 'Erro ao verificar pagamento existente.' }, { status: 500 })
    }

    let comprovantePath = pagamentoExistente?.comprovante_path || null
    let comprovanteUrl = pagamentoExistente?.comprovante_url || null

    const comprovanteFile = formData.get('comprovante')
    if (comprovanteFile instanceof File && comprovanteFile.size > 0) {
      if (comprovanteFile.size > MAX_COMPROVANTE_SIZE_BYTES) {
        return NextResponse.json(
          { error: 'Comprovante maior que 10MB. Envie um arquivo menor.' },
          { status: 400 }
        )
      }

      const extension = normalizeComprovanteExtension(comprovanteFile.name, comprovanteFile.type)
      const mimeTypeOk =
        !comprovanteFile.type || ALLOWED_COMPROVANTE_MIME_TYPES.has(comprovanteFile.type)

      if (!extension || !mimeTypeOk) {
        return NextResponse.json(
          { error: 'Formato de comprovante inválido. Use PDF, PNG, JPG ou WEBP.' },
          { status: 400 }
        )
      }

      const originalName = comprovanteFile.name.replace(/\.[^.]+$/, '')
      const safeName = sanitizeFileName(originalName) || 'comprovante'
      const blobPath = `comissoes/comprovantes/${vendedor.id}/${monthRange.monthReference}-${Date.now()}-${safeName}.${extension}`

      const blob = await put(blobPath, comprovanteFile, {
        access: 'public',
        contentType: comprovanteFile.type || undefined,
      })

      comprovantePath = blob.pathname
      comprovanteUrl = blob.url
    }

    const valorExistente = normalizeCurrencyValue(pagamentoExistente?.valor_total)
    const valorTotalFinal =
      valorPagoInput ?? (valorExistente > 0 ? valorExistente : normalizeCurrencyValue(totalComissaoMes))

    if (!Number.isFinite(valorTotalFinal) || valorTotalFinal <= 0) {
      return NextResponse.json({ error: 'Valor de comissão deve ser maior que zero.' }, { status: 400 })
    }

    const observacaoFinal = observacaoInput || pagamentoExistente?.observacao || null
    const pagoEmFinal = pagamentoExistente?.pago_em || new Date().toISOString()

    const { data: pagamentoSalvo, error: pagamentoSalvoError } = await supabase
      .from('vendedor_comissao_pagamentos')
      .upsert(
        {
          vendedor_id: vendedor.id,
          mes_referencia: monthRange.monthReference,
          valor_total: valorTotalFinal,
          pago_em: pagoEmFinal,
          comprovante_path: comprovantePath,
          comprovante_url: comprovanteUrl,
          observacao: observacaoFinal,
        },
        {
          onConflict: 'vendedor_id,mes_referencia',
        }
      )
      .select(
        'id, vendedor_id, mes_referencia, valor_total, pago_em, comprovante_path, comprovante_url, observacao, created_at, updated_at'
      )
      .single()

    if (pagamentoSalvoError) {
      const details = `${pagamentoSalvoError.message || ''} ${pagamentoSalvoError.details || ''}`
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

      return NextResponse.json({ error: 'Erro ao salvar pagamento de comissão.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: pagamentoExistente
        ? 'Pagamento de comissão atualizado com sucesso.'
        : 'Pagamento de comissão registrado com sucesso.',
      pagamento: pagamentoSalvo,
    })
  } catch (error) {
    if (error instanceof AsaasIntegrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    const message = error instanceof Error ? error.message : String(error)
    if (/fetch failed|enotfound|getaddrinfo|network/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
        },
        { status: 503 }
      )
    }

    console.error('Admin comissão vendedor POST error:', error)
    return NextResponse.json({ error: 'Erro ao registrar pagamento de comissão.' }, { status: 500 })
  }
}
