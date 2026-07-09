'use client'

import { CadastroFormData } from '@/lib/types'

interface StepTermoProps {
  data: Partial<CadastroFormData>
}

export function StepTermo({ data }: StepTermoProps) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-900">
          📋 Revise o termo de adesão abaixo. Você poderá fazer download do PDF após confirmar.
        </p>
      </div>

      {/* Prévia do Termo */}
      <div className="border border-gray-300 rounded-lg p-8 bg-white space-y-6 max-h-96 overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900">TERMO DE ADESÃO AO SERVIÇO</h2>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">1. CONTRATANTE</h3>
          <p className="text-gray-700">
            <strong>SHALOM SAÚDE</strong>
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">2. ADERENTE</h3>
          <p className="text-gray-700">
            <strong>Nome:</strong> {data.nome || '[Nome não preenchido]'} <br />
            <strong>CPF:</strong> {data.cpf || '[CPF não preenchido]'} <br />
            <strong>RG:</strong> {data.rg || '[RG não preenchido]'} <br />
            <strong>Data de Nascimento:</strong> {data.data_nascimento || '[Data não preenchida]'} <br />
            <strong>Sexo:</strong> {data.sexo || '[Sexo não preenchido]'} <br />
            <strong>Estado Civil:</strong> {data.estado_civil || '[Estado civil não preenchido]'} <br />
            {data.estado_civil === 'Casado(a)' && (
              <>
                <strong>Nome do Cônjuge:</strong>{' '}
                {data.nome_conjuge || '[Nome do cônjuge não preenchido]'} <br />
              </>
            )}
            <strong>Escolaridade:</strong> {data.escolaridade || '[Escolaridade não preenchida]'} <br />
            <strong>Email:</strong> {data.email || '[Email não preenchido]'} <br />
            <strong>Telefone:</strong> {data.telefone || '[Telefone não preenchido]'} <br />
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">3. ENDEREÇO</h3>
          <p className="text-gray-700">
            {data.endereco && `${data.endereco}, ${data.numero}`}
            {data.complemento && ` - ${data.complemento}`}
            {data.bairro && <br />}
            {data.bairro && `${data.bairro}`}
            {data.cidade && `, ${data.cidade}`}
            {data.estado && ` - ${data.estado}`}
            {data.cep && <br />}
            {data.cep && `CEP: ${data.cep}`}
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">4. DEPENDENTES</h3>
          {data.tem_dependentes && data.dependentes && data.dependentes.length > 0 ? (
            <div className="space-y-2">
              {data.dependentes.map((dep, index) => (
                <p key={index} className="text-gray-700">
                  {index + 1}. {dep.nome} - {dep.relacao} {dep.cpf && `(CPF: ${dep.cpf})`}{' '}
                  {dep.rg && `(RG: ${dep.rg})`} {dep.email && `(Email: ${dep.email})`}{' '}
                  {dep.sexo && `(Sexo: ${dep.sexo})`} {dep.telefone_celular && `(Celular: ${dep.telefone_celular})`}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-gray-700">Nenhum dependente informado</p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">5. OBJETO DO CONTRATO</h3>
          <p className="text-gray-700 text-justify">
            A SHALOM SAÚDE fornecerá ao ADERENTE acesso a planos de saúde e benefícios conforme
            as condições estabelecidas neste termo. O ADERENTE concorda em cumprir com as
            obrigações contratuais e regulamentações vigentes.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">6. VIGÊNCIA</h3>
          <p className="text-gray-700">
            Este termo entrará em vigor na data de confirmação do cadastro e permanecerá
            válido conforme as condições gerais do plano de saúde.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">7. RESPONSABILIDADES DO ADERENTE</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Manter informações cadastrais atualizadas</li>
            <li>Cumprir com pagamentos conforme acordado</li>
            <li>Informar alterações de dados pessoais</li>
            <li>Utilizar os serviços conforme regulamentação</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">8. ACEITE</h3>
          <p className="text-gray-700 text-justify">
            O ADERENTE declara ter lido, compreendido e aceita todos os termos e condições
            contidos neste documento. A confirmação final do cadastro é prova de consentimento
            e aceite integral do presente termo.
          </p>
        </section>

        <div className="pt-4 border-t border-gray-300">
          <p className="text-sm text-gray-600">
            Data de confirmação: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-green-700 text-sm font-medium">
          ✓ Você poderá fazer download do PDF do termo após confirmar a adesão.
        </p>
      </div>
    </div>
  )
}
