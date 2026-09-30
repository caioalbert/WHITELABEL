import {describe, expect, it} from 'vitest'
import {parseFuncionariosExcel} from '../lib/funcionarios-excel'
import {selectSpreadsheetMatrix, readSpreadsheetMatrix} from '../lib/spreadsheet'
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

describe('seleção da aba pelas colunas do modelo',()=>{
  it('ignora nomes e encontra as colunas mesmo fora da primeira aba',()=>{
    const data=[['Título'],[],headers,row('52998224725')]
    expect(selectSpreadsheetMatrix([{name:'Funcionários',rows:[['Observações']]},{name:'Qualquer nome',rows:data}])).toBe(data)
  })
  it('preserva a ordem das colunas e os erros detalhados em arquivos com uma aba',()=>{
    const data=[['Coluna inválida'],['valor']]
    expect(selectSpreadsheetMatrix([{name:'Qualquer nome',rows:data}])).toBe(data)
    expect(()=>selectSpreadsheetMatrix([])).toThrow('nenhuma aba')
  })
  it('avisa quando há mais de uma aba compatível em vez de escolher pelo nome',()=>{
    expect(()=>selectSpreadsheetMatrix([{name:'Funcionários',rows:[headers]},{name:'RAPDOC',rows:[headers]}])).toThrow('Mais de uma aba')
  })
  it('avisa quando nenhuma aba contém as colunas obrigatórias',()=>{
    expect(()=>selectSpreadsheetMatrix([{name:'Funcionários',rows:[['Nome']]},{name:'Outra',rows:[]}])).toThrow('Nenhuma aba')
  })
  it('lê um XLSX de nome arbitrário com as colunas do modelo em outra ordem',async()=>{
    const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Observações'],['Cadastro empresarial']]),'Funcionários')
    const data=[headers,row('52998224725'),row('11144477735')].map(row=>[...row].reverse())
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),'Importação Setembro')
    const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'})
    const matrix=await readSpreadsheetMatrix(new File([buffer],'empresa.xlsx'))
    const result=parseFuncionariosExcel(matrix,{permitirEmailCompartilhado:true})
    expect(result.totalLinhas).toBe(2)
    expect(result.funcionarios).toHaveLength(2)
    expect(result.erros).toEqual([])
  })
})
