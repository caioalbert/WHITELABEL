import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const placeholderPatterns = [/your-project/i, /your-service/i, /changeme/i, /example/i]

if (placeholderPatterns.some((pattern) => pattern.test(supabaseUrl))) {
  console.error(
    'NEXT_PUBLIC_SUPABASE_URL parece estar com placeholder. Configure a URL real do seu projeto Supabase.'
  )
  process.exit(1)
}

if (placeholderPatterns.some((pattern) => pattern.test(serviceRoleKey))) {
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY parece estar com placeholder. Configure a chave real no .env/.env.local.'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sqlPath = path.join(__dirname, '001_create_tables.sql')
const setupSQL = fs.readFileSync(sqlPath, 'utf8')

function printManualInstructions() {
  console.log('\nNão foi possível executar SQL automaticamente via API.')
  console.log(`Execute manualmente o script: ${sqlPath}`)
  console.log('No Supabase: SQL Editor -> cole o conteúdo -> Run.\n')
}

async function setupDatabase() {
  try {
    console.log('Setting up database...')

    // Requer função RPC customizada "exec_sql" no banco.
    const { error } = await supabase.rpc('exec_sql', { sql: setupSQL })

    if (error) {
      const details = `${error.message || ''} ${error.details || ''}`
      if (error.code === '42883' || /exec_sql/i.test(details)) {
        printManualInstructions()
      }
      console.error('Database setup error:', error)
      process.exit(1)
    }

    console.log('Database setup completed successfully!')
    process.exit(0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/fetch failed|enotfound|getaddrinfo|network/i.test(message)) {
      console.error(
        'Falha de conexão com Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.'
      )
    }
    console.error('Setup failed:', error)
    process.exit(1)
  }
}

setupDatabase()
