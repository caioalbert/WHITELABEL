import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Nova Aliança Saúde',
  description: 'Como a Nova Aliança Saúde coleta, usa, protege e compartilha dados pessoais.',
}

const updatedAt = '21 de setembro de 2026'

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-slate-100">
      <article className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl sm:p-10">
        <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
          ← Voltar para Nova Aliança Saúde
        </Link>

        <h1 className="mt-8 text-3xl font-bold tracking-tight sm:text-4xl">Política de Privacidade</h1>
        <p className="mt-3 text-sm text-slate-400">Última atualização: {updatedAt}</p>

        <div className="mt-10 space-y-9 text-[15px] leading-7 text-slate-200">
          <section>
            <h2 className="text-xl font-semibold text-white">1. Escopo e responsável</h2>
            <p className="mt-3">
              Esta política descreve o tratamento de dados pessoais realizado pela Nova Aliança Consultoria e
              Representações por meio do site, da área do cliente e do aplicativo Nova Aliança Saúde. Para exercer
              direitos ou esclarecer dúvidas, escreva para{' '}
              <a className="text-emerald-300 underline" href="mailto:suporte@novaaliancasaude.com.br">
                suporte@novaaliancasaude.com.br
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">2. Dados tratados</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Identificação e cadastro: nome, CPF, data de nascimento, sexo e dados de dependentes.</li>
              <li>Contato e endereço: e-mail, telefone, endereço, número, complemento, bairro, cidade, estado e CEP.</li>
              <li>Conta e segurança: identificadores de cadastro, credenciais, tokens de sessão e registros de acesso.</li>
              <li>Plano e pagamentos: plano contratado, situação financeira, valores, vencimentos, faturas e identificadores de cobrança.</li>
              <li>Serviços de saúde: dados necessários para habilitar benefícios e encaminhar o acesso à telemedicina.</li>
              <li>Dados técnicos: endereço IP, navegador, dispositivo e registros necessários à segurança e ao funcionamento dos serviços.</li>
            </ul>
            <p className="mt-3">
              O aplicativo não armazena o número completo de cartão de crédito. Informações clínicas geradas durante
              uma teleconsulta são tratadas no ambiente do prestador de telemedicina, conforme os termos desse serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">3. Finalidades</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Identificar e autenticar titulares e dependentes.</li>
              <li>Executar o contrato, administrar o plano e disponibilizar benefícios.</li>
              <li>Gerenciar cadastro, dependentes, cobranças, faturas e suporte.</li>
              <li>Viabilizar o acesso à telemedicina e a parceiros escolhidos pelo usuário.</li>
              <li>Prevenir fraude, proteger contas, diagnosticar falhas e manter a plataforma segura.</li>
              <li>Cumprir obrigações legais, regulatórias e o exercício regular de direitos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">4. Compartilhamento</h2>
            <p className="mt-3">Os dados podem ser compartilhados, na medida necessária, com:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>provedores de hospedagem, banco de dados e segurança, incluindo Supabase e Vercel;</li>
              <li>Asaas, para cobrança, faturas e conciliação de pagamentos;</li>
              <li>Rapidoc, para identificação do beneficiário e acesso à telemedicina;</li>
              <li>parceiros de benefícios acionados voluntariamente pelo usuário, como WhatsApp, LARP Saúde e Grupo Zelo;</li>
              <li>autoridades públicas, quando houver obrigação legal ou ordem válida.</li>
            </ul>
            <p className="mt-3">A Nova Aliança Saúde não vende dados pessoais nem utiliza o aplicativo para publicidade comportamental.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">5. Armazenamento e segurança</h2>
            <p className="mt-3">
              Mantemos dados pelo período necessário à prestação dos serviços e ao cumprimento de obrigações legais,
              contratuais e regulatórias. Aplicamos controles de acesso, conexões criptografadas e armazenamento seguro
              de sessão no dispositivo. Prestadores de nuvem podem processar dados em outros países, sujeitos a medidas
              contratuais e técnicas de proteção.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">6. Direitos do titular</h2>
            <p className="mt-3">
              Nos termos da LGPD, você pode solicitar confirmação e acesso aos dados, correção, informação sobre
              compartilhamento, portabilidade quando aplicável, revisão de decisões automatizadas, oposição,
              anonimização, bloqueio ou eliminação nos casos previstos em lei e revogação de consentimento.
            </p>
            <p className="mt-3">
              Envie a solicitação pelo e-mail de suporte ou consulte a página de{' '}
              <Link className="text-emerald-300 underline" href="/exclusao-de-conta">
                exclusão de conta e dados
              </Link>. Poderemos confirmar sua identidade antes de atender ao pedido.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">7. Dependentes e menores</h2>
            <p className="mt-3">
              Dados de dependentes são fornecidos e administrados pelo titular ou responsável. Quando envolverem
              crianças ou adolescentes, o tratamento deve observar seu melhor interesse e as regras aplicáveis da LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">8. Atualizações</h2>
            <p className="mt-3">
              Esta política poderá ser atualizada para refletir mudanças nos serviços ou na legislação. A versão vigente
              permanecerá publicada nesta página com a data da última atualização.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
