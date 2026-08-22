import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_CONNECTIVITY_REGEX =
  /fetch failed|enotfound|getaddrinfo|network|ssl handshake|tls|cloudflare|error code 52\d|<html|<!doctype/i

function isSupabaseConnectivityIssue(details: string) {
  return SUPABASE_CONNECTIVITY_REGEX.test(details)
}

export async function GET(request: NextRequest) {
  try {
    const ref = String(request.nextUrl.searchParams.get('ref') || '').trim().toUpperCase()
    if (!ref) {
      return NextResponse.json({ error: 'Código de indicação é obrigatório.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fast-path: codes starting with PARCEIRO- are always parceiros
    const isParceiroRef = ref.startsWith('PARCEIRO-')

    if (!isParceiroRef) {
      // Try vendedor first
      const { data: vendedor, error } = await supabase
        .from('vendedores')
        .select('id, nome, codigo_indicacao, ativo')
        .eq('codigo_indicacao', ref)
        .maybeSingle()

      if (error) {
        const details = `${error.message || ''} ${error.details || ''}`
        if (/relation .*vendedores|does not exist|42P01|column .*vendedor_id|vendedor_codigo/i.test(details)) {
          return NextResponse.json(
            { error: 'Banco desatualizado. Execute scripts/007_add_vendedores_module.sql no Supabase SQL Editor.' },
            { status: 500 }
          )
        }
        if (isSupabaseConnectivityIssue(details)) {
          return NextResponse.json(
            { error: 'Não foi possível validar o consultor agora. Tente novamente em alguns minutos.' },
            { status: 503 }
          )
        }
        console.error('Public vendedor lookup error:', error)
        return NextResponse.json({ error: 'Erro ao consultar consultor.' }, { status: 500 })
      }

      if (vendedor && vendedor.ativo === true) {
        return NextResponse.json({
          success: true,
          tipo: 'vendedor',
          vendedor: {
            id: vendedor.id,
            nome: vendedor.nome,
            codigoIndicacao: vendedor.codigo_indicacao,
          },
        })
      }
    }

    // Try parceiro (either fast-path or vendedor not found)
    const { data: parceiro, error: parceiroError } = await supabase
      .from('parceiros')
      .select('id, nome, codigo_indicacao, ativo')
      .eq('codigo_indicacao', ref)
      .maybeSingle()

    if (parceiroError) {
      const details = `${parceiroError.message || ''} ${parceiroError.details || ''}`
      if (/relation .*parceiros|does not exist|42P01/i.test(details)) {
        return NextResponse.json(
          { error: 'Banco desatualizado. Execute scripts/015_add_parceiros_module.sql no Supabase SQL Editor.' },
          { status: 500 }
        )
      }
      if (isSupabaseConnectivityIssue(details)) {
        return NextResponse.json(
          { error: 'Não foi possível validar o consultor agora. Tente novamente em alguns minutos.' },
          { status: 503 }
        )
      }
      console.error('Public parceiro lookup error:', parceiroError)
      return NextResponse.json({ error: 'Erro ao consultar parceiro.' }, { status: 500 })
    }

    if (parceiro && parceiro.ativo === true) {
      return NextResponse.json({
        success: true,
        tipo: 'parceiro',
        vendedor: {
          id: parceiro.id,
          nome: parceiro.nome,
          codigoIndicacao: parceiro.codigo_indicacao,
        },
      })
    }

    return NextResponse.json({ error: 'Consultor não encontrado para este link.' }, { status: 404 })
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    if (isSupabaseConnectivityIssue(details)) {
      return NextResponse.json(
        { error: 'Não foi possível validar o consultor agora. Tente novamente em alguns minutos.' },
        { status: 503 }
      )
    }
    console.error('Public vendedor route error:', error)
    return NextResponse.json({ error: 'Erro ao consultar consultor.' }, { status: 500 })
  }
}
