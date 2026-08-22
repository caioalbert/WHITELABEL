import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { DEFAULT_BRAND_LOGO_ON_LIGHT_URL } from '@/lib/branding'
import { createAdminClient } from '@/lib/supabase/admin'
import { EMPRESA_APP_COOKIE, EMPRESA_FLOW_COOKIE, getActiveEmpresaAuth } from '@/lib/supabase/empresa-auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function EmpresaDashboardPage() {
  const auth = await getActiveEmpresaAuth()
  if (!auth) redirect('/login?tipo=empresa')

  const supabase = createAdminClient()
  const { data: empresa } = await supabase
    .from('empresas')
    .select('razao_social, nome_fantasia, cnpj, status, quantidade_funcionarios, mensalidade_valor, pagamento_confirmado_em')
    .eq('id', auth.empresaId)
    .eq('status', 'ATIVO')
    .maybeSingle()
  if (!empresa) redirect('/login?tipo=empresa')

  const { data: funcionarios } = await supabase
    .from('empresa_funcionarios')
    .select('id, cadastro_id, nome, cpf, email, cargo')
    .eq('empresa_id', auth.empresaId)
    .order('nome', { ascending: true })

  async function logout() {
    'use server'
    const cookieStore = await cookies()
    cookieStore.delete(EMPRESA_APP_COOKIE)
    cookieStore.delete(EMPRESA_FLOW_COOKIE)
    redirect('/login?tipo=empresa')
  }

  const money = Number(empresa.mensalidade_valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <main className="min-h-screen bg-teal-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <BrandLogo logoUrl={DEFAULT_BRAND_LOGO_ON_LIGHT_URL} width={180} height={70} className="h-14 w-auto object-contain" />
            <div><p className="font-bold text-gray-900">{empresa.nome_fantasia || empresa.razao_social}</p><p className="text-sm text-gray-500">CNPJ {empresa.cnpj}</p></div>
          </div>
          <form action={logout}><Button variant="outline" type="submit">Sair</Button></form>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Status</p><p className="mt-1 text-xl font-bold text-emerald-700">Ativo</p></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Funcionários</p><p className="mt-1 text-xl font-bold">{empresa.quantidade_funcionarios}</p></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Mensalidade</p><p className="mt-1 text-xl font-bold">{money}</p></div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Funcionários com acesso ao app</h1>
          <p className="mt-1 text-sm text-gray-500">Cada funcionário provisionado pode entrar como cliente usando CPF.</p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead><tr className="border-b text-gray-500"><th className="py-3">Nome</th><th>CPF</th><th>Email</th><th>Cargo</th><th>Acesso</th></tr></thead>
              <tbody>{(funcionarios || []).map((item) => <tr key={item.id} className="border-b border-gray-100"><td className="py-3 font-medium">{item.nome}</td><td>{item.cpf}</td><td>{item.email}</td><td>{item.cargo || '-'}</td><td className={item.cadastro_id ? 'text-emerald-700' : 'text-amber-700'}>{item.cadastro_id ? 'Liberado' : 'Processando'}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
