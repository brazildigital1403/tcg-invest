import fs from 'fs'
import csv from 'csv-parser'
// Node 18+ já tem fetch nativo
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERRO: Variáveis do Supabase não carregadas')
  console.log('process.cwd():', process.cwd())
  console.log('ENV carregado:', Object.keys(process.env).filter(k => k.includes('SUPABASE')))
  console.log('SUPABASE_URL:', supabaseUrl)
  console.log('SUPABASE_KEY:', supabaseKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ⚠️ coloque seu user_id real aqui
const userId = '122267ef-5aeb-4fd0-a9c0-616bfca068bd'

const results: any[] = []

const filePath = path.resolve(process.cwd(), 'scripts/cards.csv')

fs.createReadStream(filePath)
  .pipe(csv())
  .on('data', (data: any) => {
    results.push(data)
  })
  .on('end', async () => {
    console.log('🚀 Importando cartas...', results.length)

    for (const row of results) {
      try {
        // salvar carta usando dados extraídos da Liga
        // (será preenchido após scraping)

        // 2. buscar preço via API local
        const res = await fetch(
          `http://localhost:3000/api/preco-puppeteer?url=${encodeURIComponent(row.link)}`
        )

        const priceData: any = await res.json()
        const cardName = priceData.card_name
        const cardNumber = priceData.card_number
        const cardLink = priceData.link
        const cardImage = priceData.card_image || priceData.image || null

        if (priceData?.preco_medio && cardName) {
          // 3. salvar carta na coleção
          await supabase.from('user_cards').insert({
            user_id: userId,
            card_name: cardName,
            card_id: cardNumber,
            card_image: cardImage,
            card_link: cardLink
          })

          console.log('✔️ Carta adicionada:', cardName)

          // 4. salvar preço
          await supabase.from('card_prices').upsert({
            card_name: cardName,
            card_image: cardImage,
            preco_min: priceData.preco_min || 0,
            preco_medio: priceData.preco_medio || 0,
            preco_max: priceData.preco_max || 0,
            preco_normal: priceData.preco_normal || 0,
            preco_foil: priceData.preco_foil || 0,
            updated_at: new Date().toISOString()
          }, { onConflict: 'card_name' })

          console.log('💰 Preço salvo:', cardName)
        } else {
          console.log('⚠️ Sem preço:', row.link)
        }
      } catch (err) {
        console.error('❌ Erro:', row.link, err)
      }
    }

    console.log('🔥 Importação finalizada!')
  })