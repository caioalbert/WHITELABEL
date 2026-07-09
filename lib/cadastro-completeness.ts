type CadastroCompletenessInput = {
  nome?: string | null
  email?: string | null
  cpf?: string | null
  rg?: string | null
  telefone?: string | null
  sexo?: string | null
  data_nascimento?: string | null
  estado_civil?: string | null
  escolaridade?: string | null
  endereco?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
  nome_conjuge?: string | null
  tem_dependentes?: boolean | null
  dependentes_sem_rg_count?: number | null
  dependentes_sem_email_count?: number | null
}

const REQUIRED_CADASTRO_FIELDS: Array<{ key: keyof CadastroCompletenessInput; label: string }> = [
  { key: 'nome', label: 'Nome' },
  { key: 'email', label: 'Email' },
  { key: 'cpf', label: 'CPF' },
  { key: 'rg', label: 'RG' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'sexo', label: 'Sexo' },
  { key: 'data_nascimento', label: 'Data de nascimento' },
  { key: 'estado_civil', label: 'Estado civil' },
  { key: 'escolaridade', label: 'Escolaridade' },
  { key: 'endereco', label: 'Endereço' },
  { key: 'numero', label: 'Número' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'estado', label: 'Estado' },
  { key: 'cep', label: 'CEP' },
]

export function getMissingCadastroFields(cadastro: CadastroCompletenessInput) {
  const missing = REQUIRED_CADASTRO_FIELDS.filter(({ key }) => !String(cadastro[key] || '').trim()).map(
    ({ label }) => label
  )

  if (cadastro.estado_civil === 'Casado(a)' && !String(cadastro.nome_conjuge || '').trim()) {
    missing.push('Nome do cônjuge')
  }

  const dependentesSemRgCount = cadastro.dependentes_sem_rg_count || 0
  if (cadastro.tem_dependentes && dependentesSemRgCount > 0) {
    missing.push(
      dependentesSemRgCount === 1
        ? 'RG de 1 dependente'
        : `RG de ${dependentesSemRgCount} dependentes`
    )
  }

  const dependentesSemEmailCount = cadastro.dependentes_sem_email_count || 0
  if (cadastro.tem_dependentes && dependentesSemEmailCount > 0) {
    missing.push(
      dependentesSemEmailCount === 1
        ? 'Email de 1 dependente'
        : `Email de ${dependentesSemEmailCount} dependentes`
    )
  }

  return missing
}
