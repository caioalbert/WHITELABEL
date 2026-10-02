/**
 * Cron: expira exceções de acesso empresarial vencidas.
 *
 * - Busca registros em `empresa_acesso_excecoes` com `expira_em <= now` e `revogado_em IS NULL`
 * - Para cada um: chama removeEmpresaFuncionariosFromRapidoc e registra `revogado_em`
 * - Protegido por `CRON_SECRET` (header Authorization: Bearer <secret>)
 *
 * Configurar no vercel.json:
 *   { "path": "/api/cron/empresa-acesso-excepcional", "schedule": "0 * * * *" }
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { hasValidCronAuthorization } from '@/lib/rapidoc-sync-auth'
import { removeEmpresaFuncionariosFromRapidoc } from '@/lib/empresa-rapidoc-sync'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // segundos — Vercel Pro permite até 300

export async function GET(request: NextRequest) {
  const authorized = hasValidCronAuthorization(
    request.headers.get('authorization'),
    process.env.CRON_SECRET,
  )

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const now = new Date().toISOString()

  // Busca exceções expiradas ainda não revogadas
  const { data: expired, error } = await db
    .from('empresa_acesso_excecoes')
    .select('id, empresa_id')
    .lte('expira_em', now)
    .is('revogado_em', null)

  if (error) {
    console.error('[cron:acesso-excepcional] Erro ao buscar exceções expiradas:', error)
    return NextResponse.json({ error: 'Erro ao consultar banco de dados.' }, { status: 500 })
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ message: 'Nenhuma exceção expirada pendente.', processed: 0 })
  }

  const results: { id: string; empresaId: string; ok: boolean; error?: string }[] = []

  for (const exc of expired) {
    try {
      // 1. Tenta remover funcionários da Rapidoc
      await removeEmpresaFuncionariosFromRapidoc(exc.empresa_id)

      // 2. Registra revogação automática por expiração
      const { error: updateError } = await db
        .from('empresa_acesso_excecoes')
        .update({ revogado_em: now })
        .eq('id', exc.id)
        .is('revogado_em', null)

      if (updateError) {
        console.error(`[cron:acesso-excepcional] Erro ao revogar exceção ${exc.id}:`, updateError)
        results.push({ id: exc.id, empresaId: exc.empresa_id, ok: false, error: updateError.message })
      } else {
        results.push({ id: exc.id, empresaId: exc.empresa_id, ok: true })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[cron:acesso-excepcional] Exceção ${exc.id}:`, message)
      results.push({ id: exc.id, empresaId: exc.empresa_id, ok: false, error: message })
    }
  }

  const succeeded = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length

  console.log(
    `[cron:acesso-excepcional] Processado: ${succeeded} revogado(s), ${failed} falha(s).`,
  )

  return NextResponse.json({
    message: `${succeeded} exceção(ões) expirada(s) revogada(s).`,
    processed: results.length,
    succeeded,
    failed,
    results,
  })
}
