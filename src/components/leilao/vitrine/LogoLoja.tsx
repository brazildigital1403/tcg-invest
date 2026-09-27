import Image from 'next/image'

/** Logo da loja ou a inicial do nome, no quadrado arredondado da vitrine. */
export default function LogoLoja({
  nome,
  logoUrl,
  pequeno = false,
}: {
  nome: string
  logoUrl: string | null
  pequeno?: boolean
}) {
  const cls = pequeno ? 'vt-logo vt-logo-p' : 'vt-logo'
  const px = pequeno ? 30 : 36
  if (logoUrl) {
    return <Image src={logoUrl} alt="" width={px} height={px} sizes={`${px}px`} className={cls} />
  }
  return (
    <span className={cls} aria-hidden>
      {(nome.trim() || 'B').charAt(0).toUpperCase()}
    </span>
  )
}
