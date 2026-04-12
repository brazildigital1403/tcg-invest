export default function Button({ children, onClick, variant = 'primary' }: any) {
  const base = "px-6 py-3 rounded-lg font-semibold transition"

  const variants: any = {
    primary: "bg-purple-600 hover:opacity-90 text-white",
    secondary: "border border-gray-700 hover:bg-gray-800 text-white",
  }

  return (
    <button onClick={onClick} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  )
}