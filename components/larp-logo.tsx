import Image from 'next/image'

type LarpLogoProps = {
  alt?: string
  className?: string
}

export function LarpLogo({
  alt = 'Laboratório Roberto Picanço',
  className = 'h-10 w-24',
}: LarpLogoProps) {
  return (
    <span className={`relative block overflow-hidden ${className}`}>
      <Image
        src="/LOGO-LARP-sem-fundo.png"
        alt={alt}
        width={500}
        height={500}
        className="absolute left-1/2 top-1/2 h-auto w-full max-w-none -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  )
}
