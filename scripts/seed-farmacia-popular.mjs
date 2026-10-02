import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Configure URL e credencial privada do banco.')
const expectedProject = process.argv.find(arg => arg.startsWith('--project='))?.split('=')[1]
if (!expectedProject || new URL(url).hostname !== `${expectedProject}.supabase.co`) throw new Error('Informe --project=<ref> correspondente ao banco de destino para evitar carga no projeto errado.')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const catalog = JSON.parse(fs.readFileSync(new URL('../data/farmacia-popular-inicial.json', import.meta.url), 'utf8'))
for (const kind of ['medicamentos', 'lojas']) {
  let inserted = 0
  for (let offset = 0; offset < catalog[kind].length; offset += 100) {
    const { data, error } = await db.from(`farmacia_popular_${kind}`).upsert(catalog[kind].slice(offset, offset + 100), { onConflict: kind === 'lojas' ? 'codigo' : 'codigo,dv', ignoreDuplicates: true }).select('id')
    if (error) throw new Error(`Carga de ${kind} interrompida: ${error.message}`)
    inserted += data.length
  }
  console.log(`${kind}: ${inserted} novos registros. Existentes preservados.`)
}
