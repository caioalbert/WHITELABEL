import { FUNCIONARIOS_EXCEL_HEADERS } from './funcionarios-excel'

export const TEMPLATE_ROWS = 1000
// Excel-invariant formulas; no macros, arrays, or modern Excel-only functions.
export function templateFormulas(row: number) {
  const cpf = `M${row}`
  const weighted = (length: number) => Array.from({ length }, (_, i) => `VALUE(MID(${cpf},${i + 1},1))*${length + 1 - i}`).join('+')
  const digit = (length: number) => `MOD(MOD((${weighted(length)})*10,11),10)`
  return {
    M: `SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(TRIM(C${row}),".",""),"-","")," ","")`,
    N: `SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(TRIM(F${row}),"(",""),")",""),"-","")," ","")`,
    H: `IF(AND(A${row}="",B${row}="",C${row}="",D${row}="",E${row}="",F${row}="",G${row}=""),"",IF(C${row}="","Não informado",IFERROR(IF(AND(LEN(${cpf})=11,${cpf}<>REPT(LEFT(${cpf},1),11),VALUE(RIGHT(LEFT(${cpf},10),1))=${digit(9)},VALUE(RIGHT(${cpf},1))=${digit(10)}),IF(COUNTIF($M$2:$M$1001,${cpf})>1,"CPF repetido","OK"),"CPF inválido"),"CPF inválido")))`,
    I: `IF(AND(A${row}="",B${row}="",C${row}="",D${row}="",E${row}="",F${row}="",G${row}=""),"",IFERROR(IF(AND(LEN(TRIM(E${row}))>0,LEN(TRIM(E${row}))-LEN(SUBSTITUTE(TRIM(E${row}),"@",""))=1,SEARCH("@",TRIM(E${row}))>1,SEARCH(".",TRIM(E${row}),SEARCH("@",TRIM(E${row}))+2)<LEN(TRIM(E${row})),ISERROR(SEARCH(" ",TRIM(E${row})))),"OK","E-mail inválido"),"E-mail inválido"))`,
    J: `IF(AND(A${row}="",B${row}="",C${row}="",D${row}="",E${row}="",F${row}="",G${row}=""),"",IFERROR(IF(AND(OR(LEN(N${row})=10,LEN(N${row})=11),ISNUMBER(VALUE(N${row})),TEXT(VALUE(N${row}),"0")=N${row}),"OK","Telefone inválido"),"Telefone inválido"))`,
    K: `IF(AND(A${row}="",B${row}="",C${row}="",D${row}="",E${row}="",F${row}="",G${row}=""),"",IF(D${row}="","Não informado",IFERROR(IF(AND(ISNUMBER(D${row}),D${row}>0,D${row}<=TODAY()),"OK","Confira a data"),"Confira a data")))`,
    L: `IF(AND(A${row}="",B${row}="",C${row}="",D${row}="",E${row}="",F${row}="",G${row}=""),"",IF(AND(LEN(TRIM(A${row}))>0,LEN(TRIM(B${row}))>0,OR(H${row}="OK",H${row}="Não informado"),I${row}="OK",J${row}="OK",OR(K${row}="OK",K${row}="Não informado"),OR(G${row}="Feminino",G${row}="Masculino",G${row}="Outro")),"Pronto para importar","Revise os campos"))`,
  }
}

export async function createFuncionariosTemplate() {
  const XLSX = await import('xlsx')
  const { default: JSZip } = await import('jszip')
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([[...FUNCIONARIOS_EXCEL_HEADERS, 'CPF: validação', 'E-mail: validação', 'Telefone: validação', 'Nascimento: validação', 'Resultado', 'CPF normalizado', 'Telefone normalizado']])
  sheet['!cols'] = [32, 18, 18, 22, 34, 22, 16, 20, 20, 22, 22, 25, 16, 16].map((wch, index) => ({ wch, hidden: index >= 12 }))
  for (let row = 2; row <= TEMPLATE_ROWS + 1; row++) {
    for (const column of ['A', 'B', 'C', 'E', 'F', 'G']) sheet[`${column}${row}`] = { t: 's', v: '', z: '@' }
    sheet[`D${row}`] = { t: 's', v: '', z: 'dd/mm/yyyy' }
    for (const [column, formula] of Object.entries(templateFormulas(row))) sheet[`${column}${row}`] = { t: 's', v: '', f: formula }
  }
  sheet['!ref'] = `A1:N${TEMPLATE_ROWS + 1}`
  XLSX.utils.book_append_sheet(workbook, sheet, 'Colaboradores')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Como preencher'],
    ['Preencha somente A:G na aba Colaboradores, uma pessoa por linha. Há espaço para 1.000 pessoas.'],
    ['CPF, RG e telefone são texto: preserve todos os zeros iniciais. Não altere os números com base nas fórmulas.'],
    ['CPF e nascimento são opcionais no modelo; se informados, precisam ser válidos.'],
    ['Digite a data de nascimento como data do Excel, por exemplo 22/08/1990.'],
    ['As colunas H:L mostram problemas de preenchimento; não cole dados sobre as fórmulas.'],
    ['Use Feminino, Masculino ou Outro na lista da coluna Sexo.'],
    ['O e-mail deve ser individual. Contato compartilhado só é permitido na importação administrativa empresarial.'],
    ['As fórmulas conferem formato e dígitos; não comprovam a identidade ou a titularidade do documento.'],
    ['O sistema repete a validação na importação, inclusive se uma fórmula foi apagada ou os dados foram colados.'],
    ['Confira os documentos dos colaboradores antes de enviar. E-mail e telefone não são verificados quanto à entrega.'],
  ]), 'Instruções')
  workbook.Sheets['Instruções']['!cols'] = [{ wch: 120 }]
  const zip = await JSZip.loadAsync(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }))
  const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
  const validation = `<dataValidations count="2"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Sexo inválido" error="Escolha Feminino, Masculino ou Outro." sqref="G2:G1001"><formula1>"Feminino,Masculino,Outro"</formula1></dataValidation><dataValidation type="date" operator="between" allowBlank="1" showErrorMessage="1" errorTitle="Data inválida" error="Informe uma data de nascimento até hoje." sqref="D2:D1001"><formula1>1</formula1><formula2>TODAY()</formula2></dataValidation></dataValidations>`
  const formatted = xml.replace('<sheetViews>', '<sheetViews>').replace(/<sheetView([^>]*?)\/>/, '<sheetView$1><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>')
  zip.file('xl/worksheets/sheet1.xml', formatted.replace('</worksheet>', `${validation}</worksheet>`))
  const wbXml = await zip.file('xl/workbook.xml')!.async('string')
  zip.file('xl/workbook.xml', wbXml.replace('</workbook>', '<calcPr calcId="0" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>'))
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}

export async function downloadFuncionariosTemplate() {
  const url = URL.createObjectURL(new Blob([await createFuncionariosTemplate()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'modelo-colaboradores.xlsx'
  document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
