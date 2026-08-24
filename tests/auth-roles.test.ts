import { describe, expect, it } from 'vitest'
import { getParceiroId, getVendedorId, hasAdminRole } from '../lib/supabase/auth-roles'

const id = '123e4567-e89b-42d3-a456-426614174000'

describe('autorização por app_metadata', () => {
  it('ignora completamente privilégios em user_metadata', () => {
    const attacker = {
      app_metadata: {},
      user_metadata: { is_admin: true, is_vendedor: true, vendedor_id: id },
    }

    expect(hasAdminRole(attacker)).toBe(false)
    expect(getVendedorId(attacker)).toBeNull()
  })

  it('reconhece administrador apenas em app_metadata', () => {
    expect(hasAdminRole({ app_metadata: { role: 'admin', is_admin: true } })).toBe(true)
  })

  it('exige papel e UUID válido para vendedor e parceiro', () => {
    expect(getVendedorId({ app_metadata: { role: 'vendedor', vendedor_id: id } })).toBe(id)
    expect(getParceiroId({ app_metadata: { role: 'parceiro', parceiro_id: id } })).toBe(id)
    expect(getVendedorId({ app_metadata: { role: 'vendedor', vendedor_id: 'qualquer' } })).toBeNull()
    expect(getParceiroId({ app_metadata: { role: 'vendedor', parceiro_id: id } })).toBeNull()
  })
})
