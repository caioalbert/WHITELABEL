import {describe, expect, it} from 'vitest'
import {FUNCIONARIOS_EXCEL_HEADERS, parseFuncionariosExcel} from '../lib/funcionarios-excel'
import {selectSpreadsheetMatrix, readSpreadsheetMatrix} from '../lib/spreadsheet'
import * as XLSX from 'xlsx'

const headers=['NOME','RG','CPF','NASCIMENTO','EMAIL','TELEFONE','SEXO']
const row=(cpf='52998224725',email='contato@empresa.example')=>['Pessoa Teste','123',cpf,'01/04/1987',email,'85999999999','Masculino']

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

describe('formatos reais, limites e linhas inválidas',()=>{
  it.each(['xlsx','biff8'] as const)('lê %s com cabeçalho do modelo e data tipada do Excel',async(bookType)=>{
    const wb=XLSX.utils.book_new()
    const person=row(); person[3]=new Date(1987,3,1,12) as unknown as string
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([Array.from(FUNCIONARIOS_EXCEL_HEADERS),person]),'Sem nome especial')
    const buffer=XLSX.write(wb,{type:'buffer',bookType})
    const result=parseFuncionariosExcel(await readSpreadsheetMatrix(new File([buffer],bookType==='xlsx'?'arquivo.xlsx':'arquivo.xls')),{permitirEmailCompartilhado:true})
    expect(result.erros).toEqual([])
    expect(result.funcionarios[0]).toMatchObject({cpf:'529.982.247-25',data_nascimento:'1987-04-01',email:'contato@empresa.example'})
  })
  it('lê CSV real com BOM, CRLF, aspas e nome com vírgula',async()=>{
    const person=row();person[0]='"Teste, Pessoa"'
    const matrix=await readSpreadsheetMatrix(new File(['\uFEFF'+[headers,person].map(r=>r.join(',')).join('\r\n')],'arquivo.csv'))
    const result=parseFuncionariosExcel(matrix,{permitirEmailCompartilhado:true})
    expect(result.erros).toEqual([])
    expect(result.funcionarios[0].nome).toBe('Teste, Pessoa')
  })
  it('encontra cabeçalho após título e preserva a linha original do erro',()=>{
    const result=parseFuncionariosExcel([['Título'],[],headers,row('52998224725',''),[],row('11144477735')],{permitirEmailCompartilhado:true})
    expect(result.totalLinhas).toBe(2)
    expect(result.funcionarios).toHaveLength(1)
    expect(result.erros[0]).toMatchObject({linha:4,mensagens:['e-mail não informado']})
  })
  it('rejeita CPF, data e telefone inválidos sem perder as linhas corretas',()=>{
    const bad=row('11111111111');bad[3]='31/02/2020';bad[5]='123'
    const result=parseFuncionariosExcel([headers,bad,row()],{permitirEmailCompartilhado:true})
    expect(result.funcionarios).toHaveLength(1)
    expect(result.erros[0].mensagens).toEqual(expect.arrayContaining(['CPF inválido','data de nascimento inválida','telefone celular deve ter DDD e 10 ou 11 dígitos']))
  })
  it('mantém CPF com zero inicial no arquivo Excel',async()=>{
    const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers,row('01234567890')]),'A')
    const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'})
    const matrix=await readSpreadsheetMatrix(new File([buffer],'arquivo.xlsx'))
    expect(matrix[1][2]).toBe('01234567890')
  })
  it('normaliza contato repetido com espaços e maiúsculas no modo administrativo',()=>{
    const result=parseFuncionariosExcel([headers,row('52998224725',' CONTATO@EMPRESA.EXAMPLE '),row('11144477735')],{permitirEmailCompartilhado:true})
    expect(result.funcionarios).toHaveLength(2)
    expect(result.funcionarios.map(f=>f.email)).toEqual(['contato@empresa.example','contato@empresa.example'])
  })
  it('bloqueia arquivo vazio e arquivo apenas com cabeçalho',()=>{
    expect(parseFuncionariosExcel([]).errosGerais).toContain('A planilha está vazia.')
    expect(parseFuncionariosExcel([headers]).errosGerais).toContain('A planilha não possui colaboradores para importar.')
  })
  it('aceita o limite de 1000 e rejeita 1001 colaboradores',()=>{
    const rows=Array.from({length:1001},(_,index)=>row('',`pessoa${index}@empresa.example`))
    expect(parseFuncionariosExcel([headers,...rows.slice(0,1000)]).funcionarios).toHaveLength(1000)
    const result=parseFuncionariosExcel([headers,...rows])
    expect(result.funcionarios).toEqual([])
    expect(result.errosGerais[0]).toContain('no máximo 1000')
  })
})
