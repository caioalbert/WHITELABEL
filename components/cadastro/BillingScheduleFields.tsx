'use client'

import { billingToday, type BillingSchedule } from '@/lib/billing-schedule'

export function BillingScheduleFields({ value, onChange, allowContractMonths = false }: {
  value: Partial<BillingSchedule>
  onChange: (value: Partial<BillingSchedule>) => void
  allowContractMonths?: boolean
}) {
  const inputClass = 'mt-1 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-gray-900'
  const months = value.contrato_meses ?? 12
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-800">
        Vencimento da primeira parcela *
        <input type="date" required min={billingToday()} className={inputClass}
          value={value.primeira_parcela_vencimento || ''}
          onChange={(event) => onChange({ primeira_parcela_vencimento: event.target.value })} />
      </label>
      {allowContractMonths && (
        <label className="block text-sm font-medium text-gray-800">
          Prazo do contrato (meses) *
          <input type="number" required min={1} max={60} step={1} className={inputClass}
            value={months || ''} onChange={(event) => onChange({ contrato_meses: Number(event.target.value) })} />
        </label>
      )}
      {months > 1 && <>
        <label className="flex items-center gap-3 text-sm text-gray-800">
          <input type="checkbox" checked={value.parcelas_mesmo_dia !== false}
            onChange={(event) => onChange({ parcelas_mesmo_dia: event.target.checked })} />
          As demais parcelas vencem no mesmo dia da primeira
        </label>
        {value.parcelas_mesmo_dia === false && (
          <label className="block text-sm font-medium text-gray-800">
            Melhor dia para o vencimento das demais parcelas *
            <select required className={inputClass} value={value.dia_vencimento || ''}
              onChange={(event) => onChange({ dia_vencimento: Number(event.target.value) })}>
              <option value="">Selecione o dia</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => <option key={day} value={day}>Dia {day}</option>)}
            </select>
          </label>
        )}
      </>}
      <p className="text-sm text-gray-600">
        {months} {months === 1 ? 'parcela no total' : 'parcelas no total'}: a primeira já faz parte do contrato
        {months > 1 ? ` e restam ${months - 1} parcelas mensais, a partir do mês seguinte.` : '.'}
        {' '}Em meses sem o dia escolhido, o vencimento será no último dia do mês.
      </p>
    </div>
  )
}
