import { describe, expect, it, vi } from 'vitest'
import { listCadastrosWithIndicadores } from '../lib/admin-cadastros'

describe('listagem administrativa de clientes', () => {
  it('exclui cadastros vinculados a empresas', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const is = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ is })
    const from = vi.fn().mockReturnValue({ select })

    await expect(listCadastrosWithIndicadores({ from })).resolves.toEqual([])

    expect(from).toHaveBeenCalledWith('cadastros')
    expect(select).toHaveBeenCalledWith('*')
    expect(is).toHaveBeenCalledWith('empresa_id', null)
  })
})
