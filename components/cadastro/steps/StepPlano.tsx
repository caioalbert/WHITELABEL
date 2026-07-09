import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { CheckCircle2, XCircle } from 'lucide-react'

// Module-level formatter — stable between server and client (avoids locale hydration mismatch)
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatCurrency = (value: number) => currencyFormatter.format(value)

type PlanOption = {
  codigo: string
  nome: string
  descricao: string
  beneficios: Array<{ texto: string; inclui: boolean }>
  valor: number
  permiteDependentes: boolean
  minDependentes: number
  maxDependentes: number | null
  valorDependenteAdicional: number
}

interface StepPlanoProps {
  planos: PlanOption[]
  selectedPlanCode: string
  onSelectPlan: (codigo: string) => void
  onNext: () => void
  isLoading?: boolean
  isInstituto?: boolean
}

export function StepPlano({
  planos,
  selectedPlanCode,
  onSelectPlan,
  onNext,
  isLoading = false,
  isInstituto = false,
}: StepPlanoProps) {
  const selectedPlan = planos.find((p) => p.codigo === selectedPlanCode)
  const selectedPlanPerLifeMode = Boolean(
    selectedPlan &&
    selectedPlan.permiteDependentes &&
    selectedPlan.valorDependenteAdicional > 0 &&
    Math.abs(selectedPlan.valor - selectedPlan.valorDependenteAdicional) < 0.0001
  )
  const selectedPlanDisplayValue = selectedPlan ? selectedPlan.valor : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {isInstituto ? 'Seu plano é:' : 'Escolha seu plano'}
        </h2>
        {!isInstituto && (
          <p className="mt-2 text-sm text-gray-600">
            Selecione o plano que melhor atende suas necessidades
          </p>
        )}
      </div>

      <RadioGroup value={selectedPlanCode} onValueChange={onSelectPlan}>
        <div className="flex flex-wrap justify-center gap-5">
          {planos.map((plano) => {
            const isSelected = plano.codigo === selectedPlanCode
            const isPerLifeMode =
              plano.permiteDependentes &&
              plano.valorDependenteAdicional > 0 &&
              Math.abs(plano.valor - plano.valorDependenteAdicional) < 0.0001
            const displayPlanValue = plano.valor

            return (
              <label
                key={plano.codigo}
                className={`group relative block w-full max-w-[390px] md:w-[360px] md:max-w-none cursor-pointer rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-2 md:p-7 ${
                  isSelected
                    ? 'border-blue-500 bg-white/95 shadow-xl ring-2 ring-blue-100'
                    : 'border-slate-200 bg-white/85 shadow-md hover:border-blue-300 hover:shadow-xl'
                }`}
              >
                <RadioGroupItem value={plano.codigo} id={plano.codigo} className="sr-only" />

                <div className="min-w-0 space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">{plano.nome}</h3>
                  {plano.descricao && (
                    <p className="text-sm leading-relaxed text-gray-600 break-words">{plano.descricao}</p>
                  )}
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-4">
                  <p className="text-4xl font-extrabold leading-tight text-slate-800">
                    {formatCurrency(displayPlanValue)}
                    <span className="ml-1 text-sm font-semibold text-slate-600">
                      {isPerLifeMode ? '/vida' : '/mês'}
                    </span>
                  </p>
                  {isPerLifeMode && (
                    <p className="mt-1 text-sm font-medium text-slate-600">
                      Valor por pessoa
                    </p>
                  )}
                </div>

                {plano.beneficios.length > 0 && (
                  <ul className="mt-6 space-y-3 text-sm">
                    {plano.beneficios.map((beneficio, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        {beneficio.inclui ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <span className={beneficio.inclui ? 'text-gray-700' : 'text-gray-500'}>
                          {beneficio.texto}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {plano.permiteDependentes && (
                  <div className="mt-5 rounded-xl bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">✓ Permite dependentes</p>
                    {plano.minDependentes > 0 && (
                      <p className="text-xs text-blue-700">
                        Mínimo: {plano.minDependentes + 1} pessoa(s)
                      </p>
                    )}
                    {plano.maxDependentes !== null && (
                      <p className="text-xs text-blue-700">
                        Máximo: {plano.maxDependentes + 1} pessoa(s)
                      </p>
                    )}
                    {plano.valorDependenteAdicional > 0 && (
                      <p className="text-xs text-blue-700">
                        {isPerLifeMode
                          ? `+ R$ ${plano.valorDependenteAdicional.toFixed(2)} por vida adicional`
                          : `+ R$ ${plano.valorDependenteAdicional.toFixed(2)} por dependente adicional`}
                      </p>
                    )}
                  </div>
                )}
              </label>
            )
          })}
        </div>
      </RadioGroup>

      {selectedPlan && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm text-blue-900">
            <strong>Plano selecionado:</strong> {selectedPlan.nome} -{' '}
            {formatCurrency(selectedPlanDisplayValue)}
            {selectedPlanPerLifeMode ? '/vida' : '/mês'}
          </p>
          {selectedPlanPerLifeMode && (
            <p className="mt-1 text-xs text-blue-700">
              Valor por pessoa
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        {/* suppressHydrationWarning: disabled depends on async plan loading — SSR/client mismatch is expected */}
        <Button onClick={onNext} disabled={!selectedPlanCode || isLoading} suppressHydrationWarning>
          {isLoading ? 'Carregando...' : 'Continuar'}
        </Button>
      </div>
    </div>
  )
}
