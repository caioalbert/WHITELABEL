import envPkg from '@next/env'
import { createClient } from '@supabase/supabase-js'

const { loadEnvConfig } = envPkg
loadEnvConfig(process.cwd())

const apply = process.argv.includes('--apply')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmails = new Set(
  String(process.env.ADMIN_AUTH_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
)

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function listAllUsers() {
  const users = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
}

async function loadLinks(table) {
  const { data, error } = await supabase
    .from(table)
    .select('id, auth_user_id, ativo')
    .not('auth_user_id', 'is', null)

  if (error) throw error
  return new Map((data || []).map((row) => [row.auth_user_id, row]))
}

async function loadParceiroLinks() {
  try {
    return await loadLinks('parceiros')
  } catch (error) {
    const details = `${error?.code || ''} ${error?.message || ''}`
    if (!/PGRST205|parceiros.*schema cache|relation .*parceiros/i.test(details)) throw error
    console.warn('Tabela parceiros ausente; usando institutos somente para a migração de autenticação.')
    return loadLinks('institutos')
  }
}

function cleanUserMetadata(value) {
  const cleaned = { ...(value || {}) }
  for (const key of [
    'role',
    'is_admin',
    'is_vendedor',
    'vendedor_id',
    'is_parceiro',
    'parceiro_id',
    'is_instituto',
    'instituto_id',
  ]) {
    // GoTrue merges user_metadata on update. Sending null explicitly
    // neutralizes legacy authorization claims that omission would preserve.
    cleaned[key] = null
  }
  return cleaned
}

function desiredRole(user, vendedores, parceiros) {
  const email = String(user.email || '').trim().toLowerCase()
  const vendedor = vendedores.get(user.id)
  const parceiro = parceiros.get(user.id)
  const roles = [adminEmails.has(email), Boolean(vendedor), Boolean(parceiro)].filter(Boolean)

  if (roles.length > 1) {
    throw new Error(`Usuário ${user.id} possui mais de um vínculo de autorização.`)
  }

  if (adminEmails.has(email)) return { role: 'admin', is_admin: true }
  if (vendedor) return { role: 'vendedor', is_vendedor: true, vendedor_id: vendedor.id }
  if (parceiro) return { role: 'parceiro', is_parceiro: true, parceiro_id: parceiro.id }

  const current = user.app_metadata || {}
  if (current.role === 'admin' && current.is_admin === true) return current
  return null
}

const [users, vendedores, parceiros] = await Promise.all([
  listAllUsers(),
  loadLinks('vendedores'),
  loadParceiroLinks(),
])

const legacyAdminCandidates = users.filter(
  (user) => user.user_metadata?.is_admin === true && user.app_metadata?.is_admin !== true
)
if (legacyAdminCandidates.length > 0 && adminEmails.size === 0) {
  console.warn(
    `${legacyAdminCandidates.length} administrador(es) legado(s) não serão promovidos sem ADMIN_AUTH_EMAILS.`
  )
}

const changes = users.flatMap((user) => {
  const roleMetadata = desiredRole(user, vendedores, parceiros)
  if (!roleMetadata) return []

  return [{
    id: user.id,
    email: user.email,
    appMetadata: { ...(user.app_metadata || {}), ...roleMetadata },
    userMetadata: cleanUserMetadata(user.user_metadata),
  }]
})

console.log(`${apply ? 'Aplicando' : 'Simulando'} migração para ${changes.length} usuário(s).`)
for (const change of changes) {
  console.log(`- ${change.email || change.id}: ${change.appMetadata.role}`)
  if (!apply) continue

  const { error } = await supabase.auth.admin.updateUserById(change.id, {
    app_metadata: change.appMetadata,
    user_metadata: change.userMetadata,
  })
  if (error) throw error
}

if (!apply) {
  console.log('Nenhuma alteração aplicada. Use --apply após revisar a lista.')
}
