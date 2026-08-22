import { createAdminClient } from '@/lib/supabase/admin'
import { requireActiveEmpresaAuth } from '@/lib/supabase/empresa-auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const auth = await requireActiveEmpresaAuth()
    const supabase = createAdminClient()
    const { data: empresa, error } = await supabase
      .from('empresas')
      .select('id, razao_social, nome_fantasia, cnpj, email, telefone, responsavel_nome, status, tipo_plano, quantidade_funcionarios, valor_por_funcionario, mensalidade_valor, pagamento_confirmado_em')
      .eq('id', auth.empresaId)
      .eq('status', 'ATIVO')
      .maybeSingle()

    if (error || !empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada ou inativa.' }, { status: 403 })
    }

    const { data: funcionarios, error: funcionariosError } = await supabase
      .from('empresa_funcionarios')
      .select('id, cadastro_id, nome, cpf, email, telefone, data_nascimento, cargo')
      .eq('empresa_id', empresa.id)
      .order('nome', { ascending: true })
    if (funcionariosError) throw funcionariosError

    return NextResponse.json({ empresa, funcionarios: funcionarios || [] })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    console.error('Erro ao buscar empresa:', error)
    return NextResponse.json({ error: 'Erro ao buscar empresa.' }, { status: 500 })
  }
}
