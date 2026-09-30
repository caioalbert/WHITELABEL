import {describe, expect, it} from 'vitest'
import {parseFuncionariosExcel} from '../lib/funcionarios-excel'
import {selectSpreadsheetSheetName, readSpreadsheetMatrix} from '../lib/spreadsheet'
import * as XLSX from 'xlsx'

const headers=['NOME','RG','CPF','NASCIMENTO','EMAIL','TELEFONE','SEXO']
const row=(cpf:string,email='contato@empresa.example')=>['Pessoa Teste','123',cpf,'01/04/1987',email,'85999999999','Masculino']

describe('contato compartilhado na importação administrativa empresarial',()=>{
  it('preserva e-mails únicos como regra padrão',()=>{
    const result=parseFuncionariosExcel([headers,row('52998224725'),row('11144477735')])
    expect(result.funcionarios).toHaveLength(1)
    expect(result.erros[0].mensagens).toContain('e-mail já adicionado')
  })
  it('aceita o contato compartilhado somente com opção explícita',()=>{
    const result=parseFuncionariosExcel([headers,row('52998224725'),row('11144477735')],{permitirEmailCompartilhado:true})
    expect(result.funcionarios).toHaveLength(2)
    expect(result.erros).toEqual([])
    expect(result.funcionarios.map(item=>item.email)).toEqual(['contato@empresa.example','contato@empresa.example'])
  })
  it('continua rejeitando CPFs repetidos',()=>{
    const result=parseFuncionariosExcel([headers,row('52998224725'),row('52998224725')],{permitirEmailCompartilhado:true})
    expect(result.funcionarios).toHaveLength(1)
    expect(result.erros[0].mensagens).toContain('CPF já adicionado')
  })
  it('continua exigindo e-mail válido e informado',()=>{
    for(const email of ['','invalido']){
      const result=parseFuncionariosExcel([headers,row('52998224725',email)],{permitirEmailCompartilhado:true})
      expect(result.funcionarios).toHaveLength(0)
      expect(result.erros).toHaveLength(1)
    }
  })
})

describe('seleção da aba de colaboradores',()=>{
  it('seleciona RAPDOC quando a primeira aba é outro cadastro',()=>{
    expect(selectSpreadsheetSheetName(['Planilha Full Lifeprix','RAPDOC'])).toBe('RAPDOC')
    expect(selectSpreadsheetSheetName(['Outros','Rapidoc'])).toBe('Rapidoc')
  })
  it('preserva a prioridade da aba Funcionários e a compatibilidade com aba única',()=>{
    expect(selectSpreadsheetSheetName(['RAPDOC','Funcionários'])).toBe('Funcionários')
    expect(selectSpreadsheetSheetName(['Única'])).toBe('Única')
    expect(selectSpreadsheetSheetName([])).toBeUndefined()
  })
  it('lê os dados da aba correta em um arquivo XLSX com duas abas',async()=>{
    const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers,row('52998224725','')]),'Planilha Full Lifeprix')
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers,row('52998224725'),row('11144477735')]),'RAPDOC')
    const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'})
    const matrix=await readSpreadsheetMatrix(new File([buffer],'empresa.xlsx'))
    const result=parseFuncionariosExcel(matrix,{permitirEmailCompartilhado:true})
    expect(result.totalLinhas).toBe(2)
    expect(result.funcionarios).toHaveLength(2)
    expect(result.erros).toEqual([])
  })
})
