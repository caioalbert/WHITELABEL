export function canAccessClienteDependentes(usuarioTipo?: string | null): boolean {
  return usuarioTipo === 'titular'
}

export function canAccessClienteFinanceiro(usuarioTipo?: string | null): boolean {
  return usuarioTipo === 'titular'
}
