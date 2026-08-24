import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getParceiroId } from '@/lib/supabase/auth-roles'

type ParceiroAuthSuccess = {
  ok: true
  token: string
  user: User
  parceiroId: string
}

type ParceiroAuthFailure = {
  ok: false
  status: 401 | 403 | 503 | 500
  error: string
}

export type ParceiroAuthResult = ParceiroAuthSuccess | ParceiroAuthFailure

export async function requireParceiroAuth(request: NextRequest): Promise<ParceiroAuthResult> {
  const token = request.cookies.get('supabase-parceiro-auth-token')?.value

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

    const parceiroId = getParceiroId(data.user)
    if (!parceiroId) {
      return {
        ok: false,
        status: 403,
        error: 'Usuário sem vínculo de parceiro',
      }
    }

    const { data: parceiro, error: parceiroError } = await supabaseAdmin
      .from('parceiros')
      .select('id, ativo')
      .eq('id', parceiroId)
      .eq('auth_user_id', data.user.id)
      .maybeSingle()

    if (parceiroError) {
      const details = `${parceiroError.message || ''} ${parceiroError.details || ''}`
      if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
        return {
          ok: false,
          status: 503,
          error:
            'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
        }
      }

      if (/relation .*parceiros|does not exist|42P01|column .*parceiro_id/i.test(details)) {
        return {
          ok: false,
          status: 500,
          error: 'Banco desatualizado. Execute scripts/015_add_parceiros_module.sql no Supabase SQL Editor.',
        }
      }

      return {
        ok: false,
        status: 500,
        error: 'Erro ao validar parceiro.',
      }
    }

    if (!parceiro || parceiro.ativo !== true) {
      return {
        ok: false,
        status: 403,
        error: 'Parceiro inativo ou não encontrado.',
      }
    }

    return {
      ok: true,
      token,
      user: data.user,
      parceiroId,
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

    console.error('Parceiro auth validation error:', error)
    return {
      ok: false,
      status: 500,
      error: 'Erro ao validar sessão do parceiro',
    }
  }
}
