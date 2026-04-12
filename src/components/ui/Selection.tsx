export function Section({ children, className = '' }: any) {
  return (
    <section className={`py-24 px-6 ${className}`}>
      {children}
    </section>
  )
}