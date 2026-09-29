import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Exclusão de conta e dados | Nova Aliança Saúde',
  description: 'Como solicitar a exclusão da conta e de dados pessoais da Nova Aliança Saúde.',
}

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-slate-100">
      <article className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl sm:p-10">
        <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
          ← Voltar para Nova Aliança Saúde
        </Link>

        <h1 className="mt-8 text-3xl font-bold tracking-tight">Exclusão de conta e dados</h1>
        <p className="mt-5 leading-7 text-slate-200">
          Você pode solicitar a exclusão da sua conta e dos dados pessoais associados ao aplicativo Nova Aliança Saúde.
        </p>

        <section className="mt-8 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5">
          <h2 className="text-lg font-semibold text-white">Como solicitar</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-200">
            <li>Envie a solicitação a partir do e-mail cadastrado na plataforma.</li>
            <li>Use o assunto “Exclusão de conta e dados”.</li>
            <li>Informe seu nome completo e somente os quatro últimos dígitos do CPF.</li>
            <li>Aguarde o contato do suporte para a confirmação segura da identidade.</li>
          </ol>
          <a
            className="mt-6 inline-flex rounded-full bg-emerald-400 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-300"
            href="mailto:suporte@novaaliancasaude.com.br?subject=Exclus%C3%A3o%20de%20conta%20e%20dados"
          >
            Enviar solicitação
          </a>
        </section>

        <section className="mt-8 space-y-3 leading-7 text-slate-200">
          <h2 className="text-lg font-semibold text-white">O que será excluído</h2>
          <p>
            Após a verificação, a conta será desativada e os dados não sujeitos a retenção obrigatória serão excluídos
            ou anonimizados. Isso pode incluir dados do perfil, sessão do aplicativo e informações operacionais associadas.
          </p>
          <p>
            Determinados registros de contrato, cobrança, atendimento e segurança poderão ser mantidos pelo prazo exigido
            por lei ou necessário ao exercício regular de direitos. A resposta ao pedido informará o resultado e eventuais
            dados que precisem ser conservados.
          </p>
        </section>

        <p className="mt-8 text-sm text-slate-400">
          Não envie CPF completo, documentos, senhas ou dados de saúde por e-mail. O suporte solicitará informações
          adicionais somente por um procedimento de verificação apropriado.
        </p>
      </article>
    </main>
  )
}
