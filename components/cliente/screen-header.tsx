import { clienteColors } from '@/lib/cliente-ui'

type ScreenHeaderProps = {
  title: string
  subtitle?: string
  accent?: string
}

export function ClienteScreenHeader({
  title,
  subtitle,
  accent = clienteColors.primary,
}: ScreenHeaderProps) {
  return (
    <div className="mb-6">
      <div className="mb-2 h-1 w-10 rounded-full" style={{ backgroundColor: accent }} />
      <h1 className="text-3xl font-bold" style={{ color: clienteColors.text }}>
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-sm leading-6" style={{ color: clienteColors.textMuted }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}
