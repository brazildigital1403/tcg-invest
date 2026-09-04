/**
 * Prova a barreira de `POST /api/revalidate`.
 *
 * Rodar: npm run prova:revalidate
 *
 * `separarSlugs` e a unica coisa entre o corpo de um request externo e o
 * `revalidatePath`. Se ela deixar passar um valor que escape de `/carta/`,
 * uma chamada consegue invalidar a arvore inteira e devolver as 66.897
 * paginas de carta pro modo sob demanda — o cenario do apagao de 29/07/2026.
 * Por isso a barreira tem prova propria, reexecutavel, em vez de so um
 * comentario dizendo que e segura.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = mkdtempSync(join(tmpdir(), 'prova-revalidate-'))
try {
  execFileSync('npx', ['tsc', 'src/lib/revalidateSlugs.ts', '--outDir', dir,
    '--module', 'es2022', '--target', 'es2020',
    // Sem isto o tsc avulso checa os @types do projeto inteiro e falha em
    // coisas que nada tem a ver com este arquivo (csstype, undici-types).
    '--skipLibCheck'], { stdio: 'inherit' })
  const { separarSlugs, MAX_SLUGS } = await import(pathToFileURL(join(dir, 'revalidateSlugs.js')).href)

  // Tudo aqui tem que ser REJEITADO.
  const ATAQUES = [
    '..', '../', '../../', 'a/../..', 'carta/../../', '/', '', '   ', 'foo/bar',
    '..%2f..%2f', '%2e%2e%2f', 'a%2Fb', 'a?x=1', 'a#b', 'a b', 'a\nb', 'a\\b',
    '.hidden', '-comeca-com-hifen', 'acentuação', 'a'.repeat(300),
    null, undefined, 42, {}, ['x'],
  ]
  // Slugs reais, tem que passar.
  const VALIDOS = ['charizard-ex-199-091', 'pikachu', 'a', 'me3-94', '2-b-3']
  // Parecem suspeitos e nao sao: 'layout'/'page' viram `/carta/layout`, UMA
  // pagina que nem existe -- o tipo 'layout' e o SEGUNDO argumento de
  // `revalidatePath`, que a rota nunca passa. Caixa alta so normaliza.
  const INOFENSIVOS = ['layout', 'page', 'MAIUSCULA']

  const falhas = []
  for (const a of ATAQUES) {
    if (separarSlugs([a]).validos.length) falhas.push(`aceitou ataque: ${JSON.stringify(a)?.slice(0, 40)}`)
  }
  for (const v of [...VALIDOS, ...INOFENSIVOS]) {
    if (separarSlugs([v]).validos.length !== 1) falhas.push(`rejeitou valido: ${v}`)
  }
  if (separarSlugs(['CHARIZARD-EX']).validos[0] !== 'charizard-ex') falhas.push('nao normalizou a caixa')

  // O caminho montado nunca pode sair de /carta/ nem ganhar segmento.
  for (const s of separarSlugs(VALIDOS).validos) {
    const p = new URL('/carta/' + s, 'https://bynx.gg').pathname
    if (!p.startsWith('/carta/') || p.split('/').length !== 3) falhas.push(`escapou: ${p}`)
  }

  console.log(`ataques ${ATAQUES.length} · validos ${VALIDOS.length} · inofensivos ${INOFENSIVOS.length} · teto ${MAX_SLUGS}`)
  if (falhas.length) {
    console.error('\nFALHAS:\n' + falhas.map(f => '  ' + f).join('\n'))
    process.exit(1)
  }
  console.log('todos os casos passaram')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
