import { describe, expect, it } from 'vitest'
import { escapeCsvCell } from '../lib/csv-export'

describe('CSV export treats untrusted cells as text', () => {
  it.each(['=1+1', '+SUM(A1:A2)', '-1+1', '@SUM(A1:A2)', '  =1+1', '\uFEFF=1+1'])('neutralizes %s', (value) => {
    expect(escapeCsvCell(value)).toBe(`'${value}`)
  })
  it('neutralizes leading controls and quotes embedded line breaks', () => {
    expect(escapeCsvCell('\t=1+1')).toBe("'\t=1+1")
    expect(escapeCsvCell('\n=1+1')).toBe('"\'\n=1+1"')
  })
  it('preserves ordinary names and escapes delimiters and quotes', () => {
    expect(escapeCsvCell('Ana Silva')).toBe('Ana Silva')
    expect(escapeCsvCell('Ana; "Silva"')).toBe('"Ana; ""Silva"""')
    expect(escapeCsvCell('00123456789')).toBe('00123456789')
  })
})
