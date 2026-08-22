import { getActiveClienteAuth } from '@/lib/supabase/cliente-auth'
import { redirect } from 'next/navigation'

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const auth = await getActiveClienteAuth()
  if (!auth) redirect('/login')

  return children
}
