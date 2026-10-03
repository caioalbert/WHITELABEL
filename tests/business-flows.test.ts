import { describe, expect, it } from 'vitest'
import { isAsaasPaidStatus } from '../lib/asaas'
import {
  EMPRESA_STATUSES,
  empresaNextStep,
  getEmpresaExternalReference,
  parseEmpresaExternalReference,
} from '../lib/empresa-flow'
import { calculatePlanChargeBreakdown } from '../lib/plan-pricing'
import {
  getNextMonthDueDate,
  rotateDependentSubscription,
} from '../lib/dependent-subscription'
import {
  canAccessClienteDependentes,
  canAccessClienteFinanceiro,
} from '../lib/cliente-access'

describe('cadastro e cobrança', () => {
  it('calcula plano por vida respeitando o mínimo contratado', () => {
    const charge = calculatePlanChargeBreakdown({
      valor: 24.9,
      permiteDependentes: true,
      minDependentes: 2,
      valorDependenteAdicional: 24.9,
    }, 1)

    expect(charge.minimumLives).toBe(3)
    expect(charge.total).toBe(74.7)
  })

  it('recalcula adicionais a partir do plano sem acumular o valor anterior', () => {
    const charge = calculatePlanChargeBreakdown({
      valor: 24.9,
      permiteDependentes: true,
      minDependentes: 2,
      valorDependenteAdicional: 24.9,
    }, 3)

    expect(charge.total).toBe(99.6)
  })

  it('agenda o próximo vencimento no mês seguinte sem estourar o fim do mês', () => {
    expect(getNextMonthDueDate(new Date('2026-01-31T12:00:00Z'))).toBe('2026-02-28')
    expect(getNextMonthDueDate(new Date('2026-12-15T12:00:00Z'))).toBe('2027-01-15')
  })

  it('cria a nova assinatura, suspende a antiga e só então persiste a troca', async () => {
    const calls: string[] = []

    const result = await rotateDependentSubscription({
      cadastroId: 'cadastro-1',
      customerId: 'customer-1',
      oldSubscription: {
        id: 'subscription-old',
        billingType: 'PIX',
        nextDueDate: '2026-09-10',
      },
      newValue: 99.6,
      baseDate: new Date('2026-09-04T12:00:00Z'),
    }, {
      createSubscription: async (input) => {
        calls.push(`create:${input.value}:${input.nextDueDate}:${input.billingType}`)
        return { id: 'subscription-new' }
      },
      suspendSubscription: async (id) => { calls.push(`suspend:${id}`) },
      reactivateSubscription: async (id) => { calls.push(`reactivate:${id}`) },
      cancelSubscription: async (id) => { calls.push(`cancel:${id}`) },
      persistSubscription: async (oldId, newId, value) => {
        calls.push(`persist:${oldId}:${newId}:${value}`)
      },
    })

    expect(result).toEqual({
      subscriptionId: 'subscription-new',
      nextDueDate: '2026-10-04',
    })
    expect(calls).toEqual([
      'create:99.6:2026-10-04:PIX',
      'suspend:subscription-old',
      'persist:subscription-old:subscription-new:99.6',
    ])
  })

  it('remove a nova assinatura e reativa a antiga se a persistência falhar', async () => {
    const calls: string[] = []

    await expect(rotateDependentSubscription({
      cadastroId: 'cadastro-1',
      customerId: 'customer-1',
      oldSubscription: {
        id: 'subscription-old',
        billingType: 'BOLETO',
        nextDueDate: '2026-09-10',
      },
      newValue: 99.6,
      baseDate: new Date('2026-09-04T12:00:00Z'),
    }, {
      createSubscription: async () => {
        calls.push('create')
        return { id: 'subscription-new' }
      },
      suspendSubscription: async () => { calls.push('suspend') },
      persistSubscription: async () => {
        calls.push('persist')
        throw new Error('database unavailable')
      },
      cancelSubscription: async () => { calls.push('cancel-new') },
      reactivateSubscription: async (_id, nextDueDate) => {
        calls.push(`reactivate-old:${nextDueDate}`)
      },
    })).rejects.toThrow('database unavailable')

    expect(calls).toEqual([
      'create',
      'suspend',
      'persist',
      'cancel-new',
      'reactivate-old:2026-09-10',
    ])
  })

  it('aceita apenas estados pagos usados pelo webhook', () => {
    expect(isAsaasPaidStatus('RECEIVED')).toBe(true)
    expect(isAsaasPaidStatus('CONFIRMED')).toBe(true)
    expect(isAsaasPaidStatus('PENDING')).toBe(false)
  })
})

describe('ativação e acesso PF/PJ', () => {
  it('restringe a gestão de dependentes ao titular', () => {
    expect(canAccessClienteDependentes('titular')).toBe(true)
    expect(canAccessClienteDependentes('dependente')).toBe(false)
    expect(canAccessClienteDependentes(null)).toBe(false)
  })

  it('restringe o financeiro ao titular', () => {
    expect(canAccessClienteFinanceiro('titular')).toBe(true)
    expect(canAccessClienteFinanceiro('dependente')).toBe(false)
    expect(canAccessClienteFinanceiro(null)).toBe(false)
  })

  it('mantém a sequência do fluxo empresarial até ativação', () => {
    expect(empresaNextStep(EMPRESA_STATUSES.cadastro)).toBe('ORCAMENTO')
    expect(empresaNextStep(EMPRESA_STATUSES.orcamento)).toBe('COLABORADORES')
    expect(empresaNextStep(EMPRESA_STATUSES.lista)).toBe('PAGAMENTO')
    expect(empresaNextStep(EMPRESA_STATUSES.pagamento)).toBe('AGUARDAR_PAGAMENTO')
    expect(empresaNextStep(EMPRESA_STATUSES.ativo)).toBe('APP')
  })

  it('vincula e recupera a referência empresarial do Asaas', () => {
    const id = '123e4567-e89b-42d3-a456-426614174000'
    expect(parseEmpresaExternalReference(getEmpresaExternalReference(id))).toBe(id)
    expect(parseEmpresaExternalReference('cadastro:outro')).toBeNull()
  })
})
