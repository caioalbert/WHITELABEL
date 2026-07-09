export type PlanChargeInput = {
  valor: number
  permiteDependentes: boolean
  minDependentes: number
  valorDependenteAdicional: number
}

export type PlanChargeBreakdown = {
  total: number
  perLifeMode: boolean
  minimumLives: number
  selectedLives: number
  extraLives: number
  baseValue: number
  extraUnitValue: number
  minimumAmount: number
  extrasAmount: number
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function toNonNegativeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }
  return parsed
}

function toNonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return fallback
  }
  return parsed
}

function isPerLifePricing(baseValue: number, extraUnitValue: number) {
  return extraUnitValue > 0 && Math.abs(baseValue - extraUnitValue) < 0.0001
}

export function calculatePlanChargeBreakdown(
  plan: PlanChargeInput,
  dependentesCount: number
): PlanChargeBreakdown {
  const baseValue = roundMoney(toNonNegativeNumber(plan.valor))
  const extraUnitValue = roundMoney(toNonNegativeNumber(plan.valorDependenteAdicional))
  const minDependentes = plan.permiteDependentes ? toNonNegativeInteger(plan.minDependentes) : 0
  const dependentes = plan.permiteDependentes ? toNonNegativeInteger(dependentesCount) : 0

  if (!plan.permiteDependentes) {
    return {
      total: baseValue,
      perLifeMode: false,
      minimumLives: 1,
      selectedLives: 1,
      extraLives: 0,
      baseValue,
      extraUnitValue: 0,
      minimumAmount: baseValue,
      extrasAmount: 0,
    }
  }

  const minimumLives = Math.max(1, minDependentes + 1)
  const selectedLives = Math.max(1, dependentes + 1)
  const perLifeMode = isPerLifePricing(baseValue, extraUnitValue)

  if (perLifeMode) {
    const billedLives = Math.max(selectedLives, minimumLives)
    const extraLives = Math.max(0, billedLives - minimumLives)
    const minimumAmount = roundMoney(baseValue * minimumLives)
    const extrasAmount = roundMoney(extraUnitValue * extraLives)

    return {
      total: roundMoney(minimumAmount + extrasAmount),
      perLifeMode,
      minimumLives,
      selectedLives: billedLives,
      extraLives,
      baseValue,
      extraUnitValue,
      minimumAmount,
      extrasAmount,
    }
  }

  const extraDependentes = Math.max(0, dependentes - minDependentes)
  const extrasAmount = roundMoney(extraUnitValue * extraDependentes)

  return {
    total: roundMoney(baseValue + extrasAmount),
    perLifeMode,
    minimumLives,
    selectedLives,
    extraLives: extraDependentes,
    baseValue,
    extraUnitValue,
    minimumAmount: baseValue,
    extrasAmount,
  }
}

const MIN_DEPENDENTES_FAMILIAR = 2
const VALOR_POR_VIDA_EXCEDENTE = 24.90

export { MIN_DEPENDENTES_FAMILIAR, VALOR_POR_VIDA_EXCEDENTE }
