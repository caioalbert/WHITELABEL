import { describe, expect, it } from 'vitest'
import { parseFuncionariosExcel } from '../lib/funcionarios-excel'
import { parseCsvMatrix } from '../lib/spreadsheet'

describe('importação de e-mails de colaboradores', () => {
  it('recupera o e-mail quando o valor foi deslocado na linha', () => {
    const result = parseFuncionariosExcel([
      ['NOME', 'RG', 'CPF', 'NASCIMENTO', 'EMAIL', 'TELEFONE', 'SEXO'],
      ['Pessoa Teste', '123', '52998224725', '01/04/1987', '', '(85) 99999-9999', 'Masculino', 'pessoa@empresa.com'],
    ])
    expect(result.funcionarios[0]?.email).toBe('pessoa@empresa.com')
    expect(result.erros).toHaveLength(0)
  })

  it('lê CSV exportado com tabulações', () => {
    const matrix = parseCsvMatrix('NOME\tRG\tCPF\tNASCIMENTO\tEMAIL\tTELEFONE\tSEXO\nPessoa\t123\t52998224725\t01/04/1987\tpessoa@empresa.com\t85999999999\tMasculino')
    expect(matrix[1][4]).toBe('pessoa@empresa.com')
  })
})
