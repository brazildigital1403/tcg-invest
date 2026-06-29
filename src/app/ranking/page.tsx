import { redirect } from 'next/navigation'

// Tela de Ranking publico desativada (S43). Mantemos a URL viva
// redirecionando para a Home, para nao gerar 404 em links indexados.
// O ranking de indicacoes segue no app via /indique-e-ganhe, e o cron
// mensal (snapshot + email Top 3) continua rodando normalmente.
export default function RankingPage() {
  redirect('/')
}
