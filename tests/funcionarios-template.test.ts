import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { writeFileSync } from 'node:fs'
import { createFuncionariosTemplate } from '../lib/funcionarios-template'
import { parseFuncionariosExcel } from '../lib/funcionarios-excel'
import { readSpreadsheetMatrix } from '../lib/spreadsheet'
describe('modelo com validações de colaboradores', () => {
 it('gera identificadores como texto, fórmulas, listas e data válida até hoje', async () => {
  const buffer = await createFuncionariosTemplate()
  const wb = XLSX.read(buffer, { type: 'array', cellFormula: true, cellStyles: true })
  const sheet = wb.Sheets.Colaboradores
  expect(sheet.C2.z).toBe('@'); expect(sheet.C2.t).toBe('s')
  expect(sheet.H2.f).toContain('CPF inválido'); expect(sheet.H2.f).toContain('CPF repetido')
  expect(sheet.L1001.f).toContain('Pronto para importar')
  const zip = await JSZip.loadAsync(buffer)
  expect(await zip.file('xl/worksheets/sheet1.xml')!.async('string')).toContain('Feminino,Masculino,Outro')
  expect(await zip.file('xl/workbook.xml')!.async('string')).toContain('fullCalcOnLoad="1"')
  if (process.env.TEMPLATE_TEST_OUTPUT) writeFileSync(process.env.TEMPLATE_TEST_OUTPUT, Buffer.from(buffer))
 }, 20000)
 it('ignora as linhas reservadas e colunas calculadas ao importar', async () => {
  const original = await createFuncionariosTemplate()
  const wb = XLSX.read(original, { type: 'array' })
  const sheet = wb.Sheets.Colaboradores
  const values = ['Pessoa teste', '1234', '072.842.443-64', 36160, 'pessoa@example.com', '85999999999', 'Feminino']
  values.forEach((v, index) => { sheet[XLSX.utils.encode_cell({ r: 1, c: index })] = { t: typeof v === 'number' ? 'n' : 's', v } })
  sheet.H3 = { t: 's', v: 'CPF inválido', f: sheet.H3.f }
  const file = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], 'modelo.xlsx')
  const result = parseFuncionariosExcel(await readSpreadsheetMatrix(file), { permitirEmailCompartilhado: true })
  expect(result.totalLinhas).toBe(1); expect(result.funcionarios).toHaveLength(1); expect(result.erros).toEqual([])
 }, 20000)
 it('não confia em fórmulas sobrescritas para aceitar CPF inválido', async () => {
  const result = parseFuncionariosExcel([['Nome completo','RG','CPF','Data de nascimento','E-mail','Telefone celular','Sexo','Resultado'], ['Pessoa teste','123','049.242.679-25','22/08/1990','pessoa@example.com','85999999999','Feminino','Pronto para importar']])
  expect(result.funcionarios).toEqual([]); expect(result.erros[0].mensagens).toContain('CPF inválido')
 }, 20000)
})
