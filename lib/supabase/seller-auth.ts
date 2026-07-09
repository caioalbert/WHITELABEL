import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'

type SellerAuthSuccess = {
  ok: true
  token: string
  user: User
  vendedorId: string
}

type SellerAuthFailure = {
  ok: false
  status: 401 | 403 | 503 | 500
  error: string
}

export type SellerAuthResult = SellerAuthSuccess | SellerAuthFailure

export async function requireSellerAuth(request: NextRequest): Promise<SellerAuthResult> {
  const token = request.cookies.get('supabase-vendedor-auth-token')?.value

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: 'Não autenticado',
    }
  }

  try {
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !data.user) {
      const details = `${error?.message || ''} ${error?.status || ''}`
      if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
        return {
          ok: false,
          status: 503,
          error:
            'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
        }
      }

      return {
        ok: false,
        status: 401,
        error: 'Sessão inválida ou expirada',
      }
    }

    if (data.user.user_metadata?.is_vendedor !== true) {
      return {
        ok: false,
        status: 403,
        error: 'Acesso restrito a vendedores',
      }
    }

    const vendedorId = String(data.user.user_metadata?.vendedor_id || '').trim()
    if (!vendedorId) {
      return {
        ok: false,
        status: 403,
        error: 'Usuário sem vínculo de vendedor',
      }
    }

    const { data: vendedor, error: vendedorError } = await supabaseAdmin
      .from('vendedores')
      .select('id, ativo')
      .eq('id', vendedorId)
      .maybeSingle()

    if (vendedorError) {
      const details = `${vendedorError.message || ''} ${vendedorError.details || ''}`
      if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
        return {
          ok: false,
          status: 503,
          error:
            'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
        }
      }

      if (/relation .*vendedores|does not exist|42P01|column .*vendedor_id/i.test(details)) {
        return {
          ok: false,
          status: 500,
          error: 'Banco desatualizado. Execute scripts/007_add_vendedores_module.sql no Supabase SQL Editor.',
        }
      }

      return {
        ok: false,
        status: 500,
        error: 'Erro ao validar vendedor.',
      }
    }

    if (!vendedor || vendedor.ativo !== true) {
      return {
        ok: false,
        status: 403,
        error: 'Vendedor inativo ou não encontrado.',
      }
    }

    return {
      ok: true,
      token,
      user: data.user,
      vendedorId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/fetch failed|enotfound|getaddrinfo|network/i.test(message)) {
      return {
        ok: false,
        status: 503,
        error:
          'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
      }
    }

    console.error('Seller auth validation error:', error)
    return {
      ok: false,
      status: 500,
      error: 'Erro ao validar sessão do vendedor',
    }
  }
}
