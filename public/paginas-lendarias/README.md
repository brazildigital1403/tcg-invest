# Artes curadas das Paginas Lendarias (nivel 2)

Enquanto uma pagina NAO tem arte curada, o fichario gera o fundo sozinho
(nivel 1: eco desfocado da carta-heroi). Este diretorio recebe as artes que
substituem o eco — basta salvar o arquivo e apontar o `arteUrl` no catalogo.

## Como ligar uma arte

1. Salvar aqui como `{paginaId}.webp` (ex.: `moonbreon.webp`).
   - Tela: 1200x1680 ou maior, proporcao ~5:7 (a folha e retrato).
   - Impressao A4: gerar tambem `{paginaId}-print.webp` em 2480x3508 (300dpi)
     se a versao de tela nao aguentar impressao.
2. Em `src/lib/paginas-lendarias.ts`, na pagina correspondente:
   `arteUrl: '/paginas-lendarias/moonbreon.webp'`
3. Pronto — fichario, compartilhamento e folha A4 passam a usar a arte curada.

## Pipeline de producao (por pagina)

1. Partir da arte oficial da carta (image_large do catalogo).
2. Outpainting da CENA (nao do Pokemon): estender ceu, chao, luz e clima da
   ilustracao original pra area 5:7 inteira.
3. Retoque manual: o encaixe importa nos 9 retangulos de bolso (63x88mm,
   vao de 3mm) — nada de elemento importante morrendo na linha de corte.
   Gabarito: grade central de 195x270mm num A4.
4. Onde a carta real vai ficar (slot do heroi), a arte deve CONTINUAR a
   ilustracao da carta nas bordas do bolso — e o encaixe que vende.
5. Exportar webp qualidade 85+. Sem texto, sem logo, sem marca d'agua na
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
