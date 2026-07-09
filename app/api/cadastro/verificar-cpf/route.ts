import { createClient } from '@/lib/supabase/server'
import { isValidCPF } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_CONNECTIVITY_REGEX =
  /fetch failed|enotfound|getaddrinfo|network|ssl handshake|tls|cloudflare|error code 52\d|<html|<!doctype/i

function isSupabaseConnectivityIssue(details: string) {
  return SUPABASE_CONNECTIVITY_REGEX.test(details)
}

function getCpfCheckUnavailableError() {
  return 'Não foi possível validar o CPF no momento. Tente novamente em alguns minutos.'
}

export async function GET(request: NextRequest) {
  try {
    const cpf = String(request.nextUrl.searchParams.get('cpf') || '').trim()

    if (!cpf) {
      return NextResponse.json({ error: 'CPF é obrigatório' }, { status: 400 })
    }

    if (!isValidCPF(cpf)) {
      return NextResponse.json({ exists: false, valid: false })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cadastros')
      .select('id')
      .eq('cpf', cpf)
      .limit(1)

    if (error) {
      const details = `${error.message || ''} ${error.details || ''}`
      if (isSupabaseConnectivityIssue(details)) {
        return NextResponse.json(
          { error: getCpfCheckUnavailableError() },
          { status: 503 }
        )
      }

      console.error('CPF check database error:', error)
      return NextResponse.json({ error: 'Erro ao validar CPF' }, { status: 500 })
    }

    return NextResponse.json({
      exists: Boolean((data || []).length),
      valid: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isSupabaseConnectivityIssue(message)) {
      return NextResponse.json(
        { error: getCpfCheckUnavailableError() },
        { status: 503 }
      )
    }

    console.error('CPF check error:', error)
    return NextResponse.json({ error: 'Erro ao validar CPF' }, { status: 500 })
  }
}
