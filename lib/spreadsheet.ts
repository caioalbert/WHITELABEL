import { hasFuncionarioSpreadsheetColumns } from './funcionarios-excel'

type WorksheetInput = {
  name: string
  rows: unknown[][]
  columnWidths?: number[]
}

export function parseCsvMatrix(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

export function selectSpreadsheetMatrix(sheets: Array<{ name: string; rows: unknown[][] }>) {
  if (sheets.length === 0) throw new Error('A planilha não possui nenhuma aba.')
  if (sheets.length === 1) return sheets[0].rows

  const matchingSheets = sheets.filter((sheet) => hasFuncionarioSpreadsheetColumns(sheet.rows))
  if (matchingSheets.length === 0) {
    throw new Error('Nenhuma aba contém as colunas obrigatórias do modelo de colaboradores.')
  }
  if (matchingSheets.length > 1) {
    throw new Error('Mais de uma aba contém as colunas do modelo. Envie um arquivo com apenas a aba de colaboradores que deseja importar.')
  }
  return matchingSheets[0].rows
}

export async function readSpreadsheetMatrix(file: File) {
  if (file.name.toLowerCase().endsWith('.csv')) return parseCsvMatrix(await file.text())

  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  return selectSpreadsheetMatrix(workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      defval: '',
      raw: true,
    }),
  })))
}

export async function downloadXlsx(fileName: string, sheets: WorksheetInput[]) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows)
    if (sheet.columnWidths) worksheet['!cols'] = sheet.columnWidths.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  }
  XLSX.writeFile(workbook, fileName, { compression: true })
}
