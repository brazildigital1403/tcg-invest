import { supabase } from '@/lib/supabaseClient'

export default async function Home() {
  const { data, error } = await supabase.from('test').select('*')

  console.log('DATA:', data)
  console.log('ERROR:', error)

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">TCG App</h1>
      <p>Testando conexão com Supabase...</p>
    </div>
  )
}