import { AdminShell } from '@/components/admin/admin-shell'
import type { ReactNode } from 'react'
import './admin.css'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
