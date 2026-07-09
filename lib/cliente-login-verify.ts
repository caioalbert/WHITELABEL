export type CpfLoginRow = {
  cpf: string | null
}

/** Valida segundo fator: 4 primeiros dígitos do CPF (app/PWA atual). */
export function verifyCpfPrefix(cadastro: CpfLoginRow, prefixInput: string): boolean {
  const prefixClean = prefixInput.replace(/\D/g, '')
  if (prefixClean.length !== 4) return false
  const cpfDigits = String(cadastro.cpf || '').replace(/\D/g, '')
  return cpfDigits.slice(0, 4) === prefixClean
}

export function formatCpfForDb(cpfClean: string): string {
  return cpfClean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}
