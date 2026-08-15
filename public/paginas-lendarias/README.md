# Artes curadas das Paginas Lendarias (nivel 2)

Enquanto uma pagina NAO tem arte curada, o fichario gera o fundo sozinho
(nivel 1: eco desfocado da carta-heroi). Este diretorio recebe as artes que
substituem o eco — basta salvar o arquivo e apontar o `arteUrl` no catalogo.

## Como gerar (Nano Banana / Gemini)

O pipeline e o `scripts/gerar-artes-lendarias.mjs`: le o catalogo da API,
manda a(s) carta(s) como referencia pro Gemini image, salva o webp aqui e
atualiza o manifest `src/lib/paginas-lendarias-artes.json` (que vence o eco
do nivel 1 automaticamente — nao precisa mexer no catalogo).

Com o dev server rodando (`npm run dev`) e `GEMINI_API_KEY` no `.env.local`:

    npm run gerar-artes -- --dry                    (ve o plano e os prompts)
    npm run gerar-artes -- --pagina moonbreon       (uma pagina)
    npm run gerar-artes                             (todas que faltam)
    npm run gerar-artes -- --pagina moonbreon --force   (regenerar)

Opcoes: `--model gemini-3.1-flash-image` (mais barato), `--size 1K|2K|4K`
(default 2K), `--base` pra apontar em outra origem. Custo de referencia:
~US$0,13/imagem no pro, ~US$0,04 no flash — as 19 paginas custam centavos.

**Conferir cada arte gerada antes de commitar** — o que importa e a costura
nas bordas do retangulo central (30% x 30%), onde a carta real vai sentar,
e nada de texto/logo/moldura na imagem. Regenerar com `--force` ate sentar.

## Ajuste manual (quando o gerado nao sentar)

1. Partir da arte oficial da carta (image_large do catalogo).
2. Outpainting da CENA (nao do Pokemon): estender ceu, chao, luz e clima da
   ilustracao original pra area 3:4 / 5:7 inteira.
3. Retoque: o encaixe importa nos 9 retangulos de bolso (63x88mm, vao de
   3mm) — nada de elemento importante morrendo na linha de corte.
   Gabarito: grade central de 195x270mm num A4.
4. Onde a carta real vai ficar (slot do heroi), a arte deve CONTINUAR a
   ilustracao da carta nas bordas do bolso — e o encaixe que vende.
5. Exportar webp qualidade 85+ com o MESMO nome `{paginaId}.webp` (o
   manifest ja aponta pra ele). Sem texto, sem logo, sem marca d'agua na
   arte (a marca sai no rodape da folha impressa, fora da area de recorte).

## Prioridade (10 primeiras, por sinal de procura — estudo 15/08/2026)

1. moonbreon          (gratis — e a vitrine do produto)
2. mega-charizard-x   (carta com mais donos na Bynx)
3. eeveelutions       (pagina de 9 — a mais compartilhavel)
4. charizard-vmax-cp
5. rayquaza-vmax
6. gengar-vmax
7. kanto-151
8. pikachu-ex-ss
9. sylveon-vmax
10. giratina-vstar

Briefing de cena de CADA pagina: campo `tema` no catalogo
(`src/lib/paginas-lendarias.ts`).

## Atencao (risco de IP)

Arte estendida de ilustracao oficial e obra derivada de IP da TPCi/Nintendo.
O nivel 1 (eco da imagem que o app ja exibe) e o formato mais defensavel; a
arte curada — e principalmente a folha IMPRESSA — e decisao consciente do Du
antes de ir pra producao. Ver estudo de 15/08/2026.
