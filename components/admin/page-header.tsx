import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export function AdminPageHeader({
  title,
  description,
  backHref,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  backHref?: string
  children?: ReactNode
}) {
  return (
    <header className="admin-page-header">
      <div className="min-w-0">
        {backHref && (
          <Link href={backHref} className="admin-back">
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar à lista
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="admin-page-actions">{children}</div>}
    </header>
  )
}
