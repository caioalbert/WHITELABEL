import { describe, expect, it } from 'vitest'
import { FUNCIONARIOS_EXCEL_HEADERS, parseFuncionariosExcel } from '../lib/funcionarios-excel'
import { parseCsvMatrix } from '../lib/spreadsheet'

describe('importação de colaboradores', () => {
  it('interpreta CSV com aspas, vírgulas e quebra de linha', () => {
    expect(parseCsvMatrix('Nome,E-mail\r\n"Silva, Maria",maria@example.com')).toEqual([
      ['Nome', 'E-mail'],
      ['Silva, Maria', 'maria@example.com'],
    ])
  })

  it('importa uma linha válida e normaliza os campos', () => {
    const result = parseFuncionariosExcel([
      Array.from(FUNCIONARIOS_EXCEL_HEADERS),
      ['Maria Silva', '1234567', '', '20/05/1990', 'MARIA@EXAMPLE.COM', '11999991234', 'Feminino'],
    ])

    expect(result.erros).toEqual([])
    expect(result.funcionarios).toHaveLength(1)
    expect(result.funcionarios[0]).toMatchObject({
      email: 'maria@example.com',
      data_nascimento: '1990-05-20',
      telefone_celular: '(11) 99999-1234',
      relacao: 'colaborador',
    })
  })

  it('rejeita linhas duplicadas e inválidas sem interromper o arquivo', () => {
    const result = parseFuncionariosExcel([
      Array.from(FUNCIONARIOS_EXCEL_HEADERS),
      ['Maria Silva', '1234567', '', '', 'maria@example.com', '11999991234', 'Feminino'],
      ['Maria Dois', '7654321', '', '', 'maria@example.com', '11988881234', 'Feminino'],
    ])

    expect(result.funcionarios).toHaveLength(1)
    expect(result.erros[0].mensagens).toContain('e-mail já adicionado')
  })
})
