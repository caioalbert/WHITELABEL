import { describe, expect, it } from 'vitest'
import { billingToday, parseBillingSchedule, recurringBillingTerms, subsequentInstallments } from '../lib/billing-schedule'

const input = { primeira_parcela_vencimento: '2026-10-15', parcelas_mesmo_dia: true, contrato_meses: 12 }
const parse = (changes: Record<string, unknown> = {}) => parseBillingSchedule({ ...input, ...changes }, '2026-09-30')

describe('parcelas do contrato', () => {
  it('inclui a primeira parcela no contrato anual, restando exatamente onze', () => {
    const schedule = parse()
    const installments = subsequentInstallments(schedule)
    expect(installments).toHaveLength(11)
    expect(installments[0]).toEqual({ index: 2, dueDate: '2026-11-15' })
    expect(installments.at(-1)).toEqual({ index: 12, dueDate: '2027-09-15' })
    expect(recurringBillingTerms(schedule, '2026-10-20')).toEqual({ nextDueDate: '2026-11-15', maxPayments: 11 })
  })

  it('permite outro dia, sempre a partir do mês seguinte', () => {
    const schedule = parse({ parcelas_mesmo_dia: false, dia_vencimento: 5 })
    expect(recurringBillingTerms(schedule, '2026-10-20').nextDueDate).toBe('2026-11-05')
  })

  it('não muda os vencimentos quando o pagamento é adiantado ou atrasado', () => {
    expect(recurringBillingTerms(parse(), '2026-09-30')).toEqual(recurringBillingTerms(parse(), '2026-12-01'))
  })

  it('ajusta meses curtos sem perder o dia escolhido nos meses seguintes', () => {
    const installments = subsequentInstallments(parse({ primeira_parcela_vencimento: '2027-01-31' }))
    expect(installments.slice(0, 3).map((item) => item.dueDate)).toEqual(['2027-02-28', '2027-03-31', '2027-04-30'])
    expect(subsequentInstallments(parse({ primeira_parcela_vencimento: '2028-01-31' }))[0].dueDate).toBe('2028-02-29')
  })

  it('respeita outros prazos e não gera assinatura para contrato de parcela única', () => {
    expect(recurringBillingTerms(parse({ contrato_meses: 6 }), '').maxPayments).toBe(5)
    expect(recurringBillingTerms(parse({ contrato_meses: 1 }), '')).toEqual({ nextDueDate: undefined, maxPayments: 0 })
  })

  it.each([
    { primeira_parcela_vencimento: '2026-02-30' },
    { primeira_parcela_vencimento: '2026-09-29' },
    { primeira_parcela_vencimento: '' },
    { parcelas_mesmo_dia: 'true' },
    { parcelas_mesmo_dia: false, dia_vencimento: 0 },
    { parcelas_mesmo_dia: false, dia_vencimento: 32 },
    { parcelas_mesmo_dia: false, dia_vencimento: 5.5 },
    { contrato_meses: 0 },
    { contrato_meses: 61 },
    { contrato_meses: 12.5 },
  ])('rejeita condições inválidas: %j', (invalid) => {
    expect(() => parse(invalid)).toThrow()
  })

  it('preserva contratos legados sem reinterpretar cobranças já emitidas', () => {
    expect(subsequentInstallments(null, '2026-09-15')).toHaveLength(12)
  })

  it('usa o dia brasileiro mesmo após a virada da data UTC', () => {
    expect(billingToday(new Date('2026-10-01T01:00:00Z'))).toBe('2026-09-30')
  })
})
