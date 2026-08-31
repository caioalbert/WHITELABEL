import { describe, expect, it } from 'vitest'
import { isAsaasPaidStatus } from '../lib/asaas'
import { verifyCpfPrefix } from '../lib/cliente-login-verify'
import {
  EMPRESA_STATUSES,
  empresaNextStep,
  getEmpresaExternalReference,
  parseEmpresaExternalReference,
} from '../lib/empresa-flow'
import { calculatePlanChargeBreakdown } from '../lib/plan-pricing'
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

  it('valida o segundo fator do cliente pelo prefixo do CPF', () => {
    expect(verifyCpfPrefix({ cpf: '123.456.789-09' }, '1234')).toBe(true)
    expect(verifyCpfPrefix({ cpf: '123.456.789-09' }, '9999')).toBe(false)
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
