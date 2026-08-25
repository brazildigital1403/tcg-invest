// src/lib/paginas-lendarias.ts
// Fonte UNICA de verdade das Paginas Lendarias (fichario com fundo continuo).
//
// PURO como o plan.ts: nao importa supabase nem DB — usavel no server, no client
// e em teste. O catalogo vive em codigo (nao em tabela) de proposito: sao 30
// cartas curadas a mao, versionadas junto com a arte; banco so guarda o que e
// por-usuario (desbloqueios, em user_paginas_lendarias — migration em
// supabase/migrations/20260815_paginas_lendarias.sql, AINDA NAO APLICADA).
//
// Selecao (estudo 15/08/2026): preco BRL na Bynx x sinal interno (donos em
// colecao, anuncios no marketplace) x demanda global. 19 paginas, 30 cartas:
// 17 paginas-heroi (1 carta no centro), a pagina Eeveelution (9 cartas) e a
// pagina Kanto 151 (4 cartas).

export interface CartaLendaria {
  /** id em pokemon_cards */
  cardId: string
  /** posicao no fichario 3x3, 0..8 (4 = centro) */
  slot: number
  /** carta que da o fundo continuo da pagina */
  heroi?: boolean
  /**
   * URL da imagem quando ela NAO segue o padrao images.pokemontcg.io/{set}/{n}.png.
   * 4 cartas do catalogo vivem no images.scrydex.com — sem isto, quem monta a
   * URL na mao (landing publica) recebe o VERSO da carta. A API do fichario
   * nao precisa: ela le image_small\image_large do banco.
   */
  img?: string
}

/** URL da imagem da carta pra quem NAO le do banco (landing publica). */
export function imgDaCarta(c: CartaLendaria): string {
  if (c.img) return c.img
  const i = c.cardId.lastIndexOf('-')
  return `https://images.pokemontcg.io/${c.cardId.slice(0, i)}/${c.cardId.slice(i + 1)}.png`
}

export interface PaginaLendaria {
  /** slug estavel da pagina (chave de compra em user_paginas_lendarias) */
  id: string
  nome: string
  /** subtitulo curto exibido no rodape da pagina */
  sub: string
  ordem: number
  /** amostra gratis: liberada pra qualquer visitante */
  gratis?: boolean
  /** briefing da arte curada (nivel 2) — a direcao de cena da pagina */
  tema: string
  /**
   * Arte curada (nivel 2). Quando presente, o fichario usa este arquivo como
   * fundo em vez do eco gerado da carta (nivel 1). Caminho relativo a /public.
   * Producao documentada em public/paginas-lendarias/README.md.
   */
  arteUrl?: string
  /**
   * Outpainting: permite CONTINUAR partes do corpo da criatura cortadas na
   * borda da carta (pernas, rabo, asas) — para artes onde o Pokemon e
   * cortado sem completar (ex: Charizard VMAX rainbow sem os pes). O padrao
   * segue proibindo redesenhar a criatura.
   */
  corpoContinua?: boolean
  /**
   * Recorte custom da arte da carta que vira o fragmento do outpainting
   * (fracoes 0-1). Existe pras cartas onde o recorte padrao pega os
   * PERSONAGENS: o modelo completa quem esta cortado e a pagina nasce com
   * a criatura\pessoa duplicada espiando por tras da carta (caso gardevoir
   * ex SVI). Apontar pra uma faixa que tenha SO cenario resolve.
   */
  recorte?: { l: number; t: number; w: number; h: number }
  /**
   * Usa a arte INTEIRA da carta como fragmento, colada na proporcao e
   * posicao exatas do bolso (31% da largura, 63x88). O alinhamento vira
   * consequencia da CONSTRUCAO — horizonte e elementos ja nascem na altura
   * certa e o modelo so continua pra fora. Serve pras cartas de paisagem,
   * onde qualquer degrau na linha do horizonte denuncia a emenda.
   */
  fragmentoCarta?: boolean
  cartas: CartaLendaria[]
}

// Precos de referencia (a UI le daqui; o Stripe le do price configurado nas
// envs STRIPE_PRICE_PAGINA_LENDARIA / STRIPE_PRICE_COLECAO_LENDARIA).
export const PL_PRECOS = {
  avulsa: 12.90,
  pacote: 79.90,
} as const

/** Valor sentinela em user_paginas_lendarias.pagina_id = pacote completo. */
export const PL_PACOTE = '*'

const hero = (id: string, nome: string, sub: string, ordem: number, tema: string, cardId: string, extra?: Partial<PaginaLendaria>): PaginaLendaria => ({
  id, nome, sub, ordem, tema,
  cartas: [{ cardId, slot: 4, heroi: true }],
  ...extra,
})

export const PAGINAS_LENDARIAS: PaginaLendaria[] = [
  hero('moonbreon', 'Moonbreon', 'Umbreon VMAX · Evolving Skies', 1,
    'A lua cheia da carta toma a pagina inteira; o campo de estrelas atravessa os 9 bolsos.',
    'swsh7-215', { gratis: true }),
  hero('gengar-vmax', 'Gengar VMAX', 'Fusion Strike · Alt Art', 2,
    'A lingua-estrada termina DENTRO da carta — abaixo dela NAO existe estrada nem doces. Da borda inferior da carta pra baixo continua o jardim etereo em tons de AZUL e VERDE-AGUA (mesma paleta da base da carta), com vegetacao fantasmagorica esparsa. O ceu segue os azuis e verde-agua da carta com a lua; a vila assombrada fica nas laterais e no horizonte.',
    'swsh8-271'),
  hero('mega-charizard-x', 'Mega Charizard X', 'Phantasmal Flames · SIR', 3,
    'PRECISAO nas bordas: cada lingua de chama e faisca que toca a borda da carta continua do lado de fora NO MESMO angulo, espessura e cor — chama AZUL segue azul, brasa LARANJA segue laranja, sem inventar chamas novas coladas na carta. O cenario e a noite vulcanica escura da carta: rocha negra, fumaca e o redemoinho de fogo azul e laranja abrindo conforme se afasta, com o centro da pagina mais escuro pra carta respirar.',
    'me2-125'),
  hero('rayquaza-vmax', 'Rayquaza', 'Rayquaza VMAX · Evolving Skies', 4,
    'A tempestade no ceu se abre pela pagina, com o corpo da serpente sugerido entre os bolsos.',
    'swsh7-218'),
  hero('charizard-vmax-cp', 'Charizard VMAX', "Champion's Path · Rainbow", 5,
    'SOMENTE FUNDO, nenhuma criatura: o gradiente holografico perolado suave da carta (branco, arco-iris pastel) se estendendo limpo pela pagina inteira, com losangos brancos e amarelos esparsos flutuando e um leve brilho radial atras da carta. Minimalista, elegante, zero Charizard fora da carta.',
    'swsh35-74'),
  hero('sylveon-vmax', 'Sylveon VMAX', 'Evolving Skies · Alt Art', 6,
    'As fitas e o ceu rosa do fim de tarde cruzam a pagina.',
    'swsh7-212'),
  hero('leafeon-vmax', 'Leafeon VMAX', 'Evolving Skies · Alt Art', 7,
    'Continuar a arte da carta em todas as direções no mesmo estilo flat gouache de bordas duras e contornos deslocados rosa/ciano, mantendo o horizonte da página exatamente na altura do horizonte da arte (36% a partir do topo). Para cima: a nuvem de fumaça Dynamax vinho-bordô #7C2230 de miolo quase preto nasce colada na borda superior APENAS na faixa central entre 25% e 55% da largura da carta (onde a arte mostra a fumaça cortada) e sobe em lóbulos encadeados sem vão de céu azul; À DIREITA de 55% a arte mostra CÉU CIANO ABERTO encostando na borda — ali o céu continua limpo, sem fumaça encostada na carta, o restante do céu segue azul-celeste chapado #54BEE6, e a folha-cauda teal #57907B com listra verde-floresta #2E5D46 e contorno rosa-choque #F06EA9 continua na diagonal do canto superior direito, com o feixe de luz rosa vertical nascendo à esquerda. Para a esquerda, completar o fardo de feno cilíndrico amarelo-palha #F2C877 e estender o campo de trigo dourado-alaranjado #E8A94F em pinceladas horizontais, colinas de mata verde #3E7A3C e cordilheira azul-fria #7FA8C9; para a direita, prolongar a cerca branca de piquetes quase horizontal, o campo dourado, o muro de pedras cinza-azulado #8A8D94 em diagonal e o rastro rosa-magenta apenas como glow suave e difuso rente ao chão no plano médio, nunca faixa chapada saturada. Para baixo, cada material da borda inferior DEVE continuar idêntico e alinhado na costura: o calçamento de pedras cinza-azulado #8A8D94 com juntas escuras do trecho esquerdo (5% a 25% da largura) desce como mais calçamento cinza, e todo o restante desce como gramado verde-vivo saturado #5FAE3C a #4E9E33 com pinceladas diagonais mais escuras — chão puro até o rodapé, sem palha, sem riscos rosa e sem nenhum elemento novo. Proibido: qualquer pata, perna, cauda ou parte de criatura pendendo ou cruzando a borda inferior (o Leafeon da carta está completo com as quatro patas plantadas dentro da arte), repetir ou desenhar qualquer Leafeon ou outra criatura, faixa magenta nascendo na linha da costura, trocar pedra por palha na base, inventar construções ou cena que não exista na carta, dessaturar a paleta, e renderizar moldura, texto ou elementos de carta.',
    'swsh7-205'),
  hero('glaceon-vmax', 'Glaceon VMAX', 'Evolving Skies · Alt Art', 8,
    'A geleira se estende em silencio azul pela pagina.',
    'swsh7-209'),
  hero('pikachu-vmax-vv', 'Pikachu VMAX', 'Vivid Voltage', 9,
    'FUNDO COSMICO com RAIOS, sem nenhuma criatura: espaco escuro em azul-marinho e preto, campo de ESTRELAS brancas de varios tamanhos, e faixas de luz coloridas — VERDE, ROXO, MAGENTA e LARANJA — girando em espiral como uma nebulosa. Por cima, RAIOS AMARELOS grossos em zigue-zague, de contorno branco brilhante e miolo amarelo-ouro, atravessando a pagina inteira. CENTRALIZACAO OBRIGATORIA: o olho da espiral fica no CENTRO EXATO DA PAGINA, atras do meio da carta (meia altura, meia largura) — nunca no alto nem de lado. As faixas coloridas giram em torno desse ponto e os raios partem dele em todas as direcoes, com a MESMA quantidade, espessura e alcance ACIMA e ABAIXO, a ESQUERDA e a DIREITA; a metade de baixo espelha a de cima. Nenhum canto pode ficar mais carregado que o oposto. PROIBIDO: qualquer Pikachu ou parte dele fora da carta (orelha, bochecha, pata, cauda, massa amarela com forma de corpo), outro Pokemon, planeta, paisagem, horizonte e texto.',
    'swsh4-44'),
  hero('mew-vmax', 'Mew VMAX', 'Fusion Strike · Alt Art', 10,
    'O psicodelico rosa da alt art se espalha como aquarela.',
    'swsh8-269'),
  hero('pikachu-ex-ss', 'Pikachu ex', 'Surging Sparks · SIR', 11,
    'PRADO ENSOLARADO, um LUGAR de verdade e nao uma colagem de efeitos: campo aberto de grama verde-clara ocupando a metade de baixo e subindo ate um pouco acima do meio, talos finos pintados um a um, tufos altos, trevos, florzinhas brancas e amarelas miudas e sementinhas de dente-de-leao no ar. Acima, ar luminoso de fim de manha — branco quente e amarelo palido, sem nuvem desenhada e sem linha de horizonte marcada, so a luz do sol lavando tudo e alguns feixes rasantes dourados atravessando a grama. Aquarela leve, cores claras, muito branco de luz, ar respirado e areas VAZIAS de sobra. Como tempero, POUCAS gemas Tera facetadas flutuando bem espalhadas, cada uma PEQUENA — do tamanho de uma florzinha da grama, nunca maior que isso — mais algumas faiscas e um reflexo de arco-iris muito suave. PROIBIDO ACIMA DE TUDO: gema grande, cacho ou cortina de gemas, gema maior que uma flor, qualquer RAIO ou zigue-zague amarelo, cristal grande, explosao de luz no topo, e qualquer Pikachu ou parte dele fora da carta (orelha, bochecha, pata, pe, cauda, massa amarela com forma de corpo). Tambem proibido: repetir em tamanho maior o que ja aparece dentro da carta, outro Pokemon, pessoa, arvore, montanha e texto.',
    'sv8-238', { recorte: { l: 0.66, t: 0.74, w: 0.20, h: 0.15 } }),
  hero('latias-ex', 'Latias ex', 'Surging Sparks · SIR', 12,
    'CIDADE COSTEIRA MEDITERRANEA VISTA DO ALTO AO POR DO SOL, pintura a oleo de pincelada solta e larga: telhados de telha VERMELHA-TERRACOTA e casarios claros descendo ate a agua, torres e campanarios, o MAR aberto refletindo o sol baixo em faixas douradas e brancas, e nuvens em LARANJA, coral, creme e rosa. Luz quente estourada, contraluz, brilho difuso. REGRA DE ENQUADRAMENTO, a mais importante: a LINHA DO HORIZONTE (onde o mar encontra o ceu) fica EXATAMENTE NA METADE DA ALTURA DA PAGINA — na mesma altura do meio da carta, nem um dedo acima. A METADE DE CIMA inteira e ceu e nuvem; a METADE DE BAIXO inteira e mar, costa e telhados. Ela atravessa a pagina de ponta a ponta na horizontal, saindo da borda esquerda da carta e voltando na direita sem degrau, sem subir nem descer. NAO empurre o horizonte para o alto e NAO deixe o ceu ocupar mais de metade da pagina. PROIBIDO: qualquer Latias ou parte dela fora da carta (asa, cauda, corpo branco e vermelho), qualquer outro Pokemon, moldura de carta, borda amarela, aviao, barco grande em primeiro plano, montanha nevada, arranha-ceu de vidro e texto.',
    'sv8-239', { recorte: { l: 0.05, t: 0.38, w: 0.22, h: 0.20 } }),
  hero('greninja-ex', 'Greninja ex', 'Twilight Masquerade · SIR', 13,
    'Sombras ninja e lampioes do baile se estendem pelos bolsos.',
    'sv6-214'),
  hero('mega-lucario-ex', 'Mega Lucario ex', 'Mega Evolution · SIR', 14,
    'CIDADE VISTA DE CIMA EM MERGULHO, angulo aereo dramatico como o da carta: torres de concreto e vidro inclinadas, convergindo em perspectiva forte na direcao do centro da pagina, telhados, empenas e ruas estreitas la embaixo; POEIRA de concreto e nevoa no ar, estilhacos e destrocos flutuando, faiscas. Profundidade atmosferica: o que esta longe fica mais claro e esfumacado, o que esta perto tem contraste e sombra AZULADA, com realces brancos estourados. POR CIMA de tudo, o efeito de AURA: PINCELADAS LARGAS e diagonais de AZUL-CIANO eletrico e VERMELHO-ESCARLATE, com corpo grosso e PONTAS AFIADAS irregulares, como golpes de pincel de tinta molhada cruzando a pagina em varias direcoes — algumas translucidas deixando a cidade aparecer, outras solidas e vibrantes, todas com brilho nas bordas. Elas convergem para o CENTRO EXATO da pagina, atras do meio da carta, com a mesma forca acima e abaixo. Pintura digital energetica, alto contraste, sensacao de impacto e velocidade. PROIBIDO ACIMA DE TUDO: qualquer parte do Lucario fora da carta — nenhuma perna PRETA, pe ou garra VERMELHA, cauda AMARELA, orelha, focinho, tronco azul ou espinho de peito em lugar nenhum da pagina, nem atras nem ao lado da carta; ao redor dela so tem predio, poeira, destroco e pincelada. Tambem proibido: qualquer outro Pokemon, pessoa, skyline reto visto de frente, ceu vazio ocupando metade da pagina, aparencia flat de vetor e texto.',
    'me1-179', { recorte: { l: 0.78, t: 0.34, w: 0.19, h: 0.18 } }),
  hero('mega-gardevoir-ex', 'Mega Gardevoir ex', 'Mega Evolution · SIR', 15,
    'PINTURA ORNAMENTAL DENSA E VIBRANTE, sem nenhuma figura: emaranhado de folhagens art nouveau, flores em sino, petalas e arabescos se SOBREPONDO em varias camadas. ESCALA MIUDA — cada flor cabe num dedo, cada folha e fina e pequena, com MUITOS elementos pequenos por area; nenhuma forma pode ser maior que um oitavo da largura da pagina. Cores SATURADAS: verde-menta e turquesa vivos, ROSA-CHOQUE e magenta, roxo, com os VAOS entre as folhas em verde-petroleo e roxo ESCUROS — e esse contraste que da profundidade. Cada petala tem VOLUME, sombra na base e luz na ponta, com brilho HOLOGRAFICO iridescente forte (reflexos arco-iris deslizando pelas superficies), respingos de branco brilhante e estrelinhas amarelas de seis pontas. Tinta com pincelada visivel, energia psiquica; NUNCA vetor liso, NUNCA papel de parede lavado. Densidade igual em toda a pagina, sem ponto focal. PROIBIDO ACIMA DE TUDO: qualquer figura humanoide, boneca, mulher, rosto, olho, cabelo, braco, mao, vestido, saia branca, ombro, silhueta ou criatura; e nenhuma forma arredondada grande tipo cabeca, capuz, capacete ou ovo em lugar nenhum. Tambem proibido: paisagem, ceu, horizonte, cena, moldura e texto.',
    'me1-178', { recorte: { l: 0.80, t: 0.15, w: 0.16, h: 0.16 } }),
  hero('lugia-vstar', 'Lugia VSTAR', 'Silver Tempest · Alt Art', 16,
    'A tempestade prata do mar revolto toma a pagina.',
    'swsh12-202'),
  hero('giratina-vstar', 'Giratina VSTAR', 'Lost Origin · Alt Art', 17,
    'O Mundo Distorcido vaza da carta e dobra a geometria da pagina.',
    'swsh11-201'),
  {
    id: 'eeveelutions',
    nome: 'Eeveelutions',
    sub: 'Prismatic Evolutions · 9 cartas, 1 arte',
    ordem: 18,
    tema: 'Um ceu unico atravessa os nove bolsos mudando de bioma — cachoeira, relampago, brasa, aurora, prisma, lua, folhagem, cristal de gelo, jardim rosa.',
    cartas: [
      { cardId: 'sv8pt5-149', slot: 0 },              // Vaporeon
      { cardId: 'sv8pt5-153', slot: 1 },              // Jolteon
      { cardId: 'sv8pt5-146', slot: 2 },              // Flareon
      { cardId: 'sv8pt5-155', slot: 3 },              // Espeon
      { cardId: 'sv8pt5-167', slot: 4, heroi: true }, // Eevee no centro
      { cardId: 'sv8pt5-161', slot: 5 },              // Umbreon
      { cardId: 'sv8pt5-144', slot: 6 },              // Leafeon
      { cardId: 'sv8pt5-150', slot: 7 },              // Glaceon
      { cardId: 'sv8pt5-156', slot: 8 },              // Sylveon
    ],
  },
  {
    id: 'kanto-151',
    nome: 'Kanto 151',
    sub: '151 · o trio inicial',
    ordem: 19,
    // Redesign 16/08 (decisao do Du): SO os 3 iniciais, lado a lado na
    // fileira do meio — o poster definitivo de Kanto na parede do usuario.
    tema: 'Os tres cenarios originais emendados lado a lado: a selva do Venusaur a esquerda, o vulcao do Charizard no centro e a baia do Blastoise a direita, com um unico ceu de Kanto atravessando o topo e os terrenos se encontrando na base.',
    cartas: [
      { cardId: 'sv3pt5-198', slot: 3 },              // Venusaur ex
      { cardId: 'sv3pt5-199', slot: 4, heroi: true }, // Charizard ex — centro
      { cardId: 'sv3pt5-200', slot: 5 },              // Blastoise ex
    ],
  },

  // ─── Onda 2 (15/08/2026): +31 paginas-heroi, total 50 ────────────────────
  hero('umbreon-v', 'Umbreon V', 'Evolving Skies · Alt Art', 20, 'A clareira noturna da alt art se abre em floresta sob a lua.', 'swsh7-189'),
  hero('charizard-v-bs', 'Charizard V', 'Brilliant Stars · Alt Art', 21, 'PAISAGEM VAZIA, sem nenhum ser vivo: vale vulcanico ao entardecer, chao de rocha escura rachada com veios de BRASA LARANJA correndo pelas fendas, faiscas subindo no ar, montanhas cinza-azuladas ao fundo, ceu de fim de tarde laranja e azul com nuvens de fumaca, e vinhas VERDES grossas descendo pelas bordas esquerda e direita. Pintura digital de luz quente e ar esfumacado. A pagina e so terreno, ceu e planta — como uma foto do lugar antes de qualquer um chegar. PROIBIDO: qualquer animal, dragao, reptil, criatura ou parte dela; nenhuma CAUDA, nenhum tubo ou faixa LARANJA curva atravessando a pagina, nenhuma chama isolada boiando no ar, nenhuma asa, garra, perna, cabeca ou barriga creme. Tambem proibido: pessoa, construcao, cidade, agua, neve e texto.', 'swsh9-154', { recorte: { l: 0.04, t: 0.31, w: 0.21, h: 0.19 } }),
  hero('espeon-vmax', 'Espeon VMAX', 'Fusion Strike · Alt Art', 22, 'VILA EUROPEIA ANTIGA de casas ENXAIMEL, a mesma da carta, descendo pela pagina inteira: fachadas de reboco claro com vigas de madeira ESCURA cruzadas, telhados inclinados de telha VERMELHA-TERRACOTA, janelas de caixilho branco com vasos de flor, muros e torres de PEDRA cinza, hera e arvores verdes entre as casas. DA CARTA PRA BAIXO as mesmas fachadas CONTINUAM descendo ate o chao e abrem numa RUA DE PARALELEPIPEDO estreita e sinuosa no rodape da pagina, com degraus de pedra, lampioes, toldos, bancos, floreiras e algumas figuras humanas PEQUENAS ao longe. Ceu azul com nuvens brancas so no ALTO da pagina; feixes rosa da Dynamax subindo entre os telhados. Pintura digital luminosa de dia claro. PROIBIDO ACIMA DE TUDO: qualquer coisa futurista — arranha-ceu, torre de vidro, letreiro de neon, holograma, carro voador, nave, painel de LED, cidade grande moderna. Tambem proibido: ceu na metade de baixo da pagina, horizonte aberto, mar, montanha, qualquer Espeon fora da carta e texto.', 'swsh8-270', { recorte: { l: 0.03, t: 0.42, w: 0.22, h: 0.17 } }),
  hero('lugia-v', 'Lugia V', 'Silver Tempest · Alt Art', 23, 'O farol na tempestade, mar revolto de prata.', 'swsh12-186'),
  hero('giratina-v', 'Giratina V', 'Lost Origin · Alt Art', 24, 'ESTAMPA DE TECIDO, padrao miudo e repetido cobrindo a pagina inteira: folhas serrilhadas, frutos ovais, cristais pontudos, cogumelos, colunas com losangos e formas geometricas empilhadas, todas do MESMO TAMANHO PEQUENO, em VERMELHO, AMARELO, VERDE, AZUL e ROXO sobre PRETO, com pontinhos e estrelinhas BRANCAS. Pintura riscada de contorno grosso, cores saturadas. Regra de ouro: qualquer quadrado que se recorte desta pagina — canto de cima, meio, canto de baixo — tem que parecer o MESMO padrao. Se aparecer qualquer area escura vazia maior que um punho, preencha ela com mais folhas, frutos e cristais miudos. PROIBIDO: forma escura ondulada grande atravessando o topo, silhueta, sombra, nevoa, e qualquer criatura, animal, dragao, serpente, cabeca, olho grande, garra, chifre, asa, cauda, bico, placa ou espinho dourado, corpo listrado vermelho e cinza, e texto.', 'swsh11-186', { recorte: { l: 0.03, t: 0.09, w: 0.20, h: 0.20 } }),
  hero('sylveon-v', 'Sylveon V', 'Evolving Skies · Alt Art', 25, 'FUNDO ABSTRATO DE FEIXES DE LUZ, sem cena e sem criatura: raios largos e suaves de luz atravessando a pagina inteira na DIAGONAL (subindo da esquerda-baixo para a direita-cima, uns 30 graus), em gradiente arco-iris pastel — ROSA-CORAL e pessego na esquerda, AMARELO-DOURADO no meio, VERDE-MENTA, AZUL-CLARO e LAVANDA na direita. Por cima, sparkles e poeira de brilho DOURADA pequena, mais densa na parte de baixo, e um leve padrao de pontinhos (halftone). Luminoso, macio, sem contorno. PROIBIDO: campo de flores, grama, plantas, ceu, horizonte, paisagem, FITAS ou lacos de qualquer tamanho, qualquer parte do Sylveon fora da carta e texto — e so luz abstrata.', 'swsh7-183', { recorte: { l: 0.04, t: 0.38, w: 0.15, h: 0.24 } }),
  hero('leafeon-v', 'Leafeon V', 'Evolving Skies · Alt Art', 26, 'O bosque banhado de sol da alt art vira dossel.', 'swsh7-167'),
  hero('vaporeon-v', 'Vaporeon V', 'Evolving Skies · Alt Art', 27, 'FUNDO ABSTRATO AQUARELADO, sem cena e sem criatura: manchas suaves e difusas de tinta molhada em ROSA-PASTEL, LILAS, AZUL-CLARO, verde-agua e creme se misturando pela pagina, com BOLHAS translucidas e circulos de bokeh de varios tamanhos flutuando por cima, e um brilho perolado leve. Tudo bem claro e etereo, como o fundo da carta. PROIBIDO: paisagem, lago, agua com reflexo, horizonte, plantas, corais, ceu, qualquer Vaporeon fora da carta e texto — e fundo abstrato, nao um cenario.', 'swsh7-172', { recorte: { l: 0.06, t: 0.12, w: 0.22, h: 0.22 } }),
  hero('machamp-v', 'Machamp V', 'Astral Radiance · Alt Art', 28, 'ENQUADRAMENTO FECHADO no nivel da rua, como a carta: SEM ceu, SEM por do sol e sem mostrar predios inteiros — so a parte BAIXA das fachadas de tijolo terracota com janelas, sacadas e roupas no varal, bem proximas. O mercado continua pros lados na MESMA escala da carta: bancas de madeira com frutas em cestas, toldos listrados e guarda-sois, bandeirinhas triangulares cruzando o alto, potes de barro e tecidos empilhados. Poucas figuras humanas, pequenas e ao fundo. PROIBIDO ACIMA DE TUDO: qualquer parte do Machamp fora da carta — nenhuma perna, braco, mao, ombro ou mancha AZUL de corpo em nenhum lugar da pagina; ele esta inteiro DENTRO da carta e o fundo e so o mercado vazio no lugar dele. Tambem proibido: ceu, sol, horizonte, praca aberta, pessoa grande em primeiro plano e texto.', 'swsh10-172', { recorte: { l: 0.56, t: 0.09, w: 0.38, h: 0.30 } }),
  hero('tyranitar-v', 'Tyranitar V', 'Battle Styles · Alt Art', 29, 'VISTA DE CIMA DO CHAO, enquadramento fechado como a carta: SEM ceu, SEM horizonte, SEM montanha ao fundo. O chao de terra ocre com tufos de grama verde continua pros lados, coberto pela BAGUNCA da refeicao: pilhas de pratos brancos com listra AZUL, panelas e frigideiras, tigelas de barro, jarros e potes tombados, talheres — tudo na MESMA escala que tem na carta (louca pequena, nunca barril gigante). Vegetacao verde e um tronco de arvore ao fundo do enquadramento. Mesma pintura suave de tons terrosos com verde. PROIBIDO: ceu, canyon, cordilheira, deserto panoramico, luz de por do sol, segundo Tyranitar, qualquer pessoa e texto.', 'swsh5-155', { fragmentoCarta: true }),
  hero('rayquaza-amazing', 'Rayquaza Amazing', 'Vivid Voltage · Amazing Rare', 30, 'SALPICOS FINOS sobre FUNDO CLARO, como a janela de arte da carta: base branco-creme clara ocupando boa parte da pagina, com respingos, gotas e borrifos PEQUENOS de tinta em VERDE-AGUA, rosa-magenta, azul-ceu, amarelo e roxo-claro — do tamanhinho que tem na carta. Mais densos rente a carta e rareando ate as bordas, deixando area clara respirando. PROIBIDO: qualquer Rayquaza fora da carta, pintura psicodelica escura de azul-marinho e roxo, pincelada grossa, textura de tela ou canvas, cor cobrindo 100% da pagina e texto.', 'swsh4-138', { recorte: { l: 0.09, t: 0.10, w: 0.82, h: 0.35 } }),
  hero('zamazenta-amazing', 'Zamazenta Amazing', 'Vivid Voltage · Amazing Rare', 31, 'SALPICOS FINOS sobre FUNDO CLARO, como a janela de arte da carta: base branco-creme clara ocupando boa parte da pagina, com respingos, gotas e borrifos PEQUENOS de tinta em rosa, azul-ceu, verde, amarelo, roxo e vermelho espalhados — do tamanhinho que tem na carta, nunca pinceladas grandes cobrindo tudo. Concentrar um pouco mais de cor perto da carta e ir rareando ate as bordas, deixando area clara respirando. PROIBIDO: explosao radial saturada, pincelada grossa de tinta, cor cobrindo 100% da pagina, segundo Zamazenta, moldura amarela de carta e texto.', 'swsh4-102', { recorte: { l: 0.09, t: 0.10, w: 0.82, h: 0.35 } }),
  hero('magikarp-scroll', 'Magikarp', 'Paldea Evolved · IR', 32, 'SCRATCHBOARD sobre PRETO, como a carta: fundo preto profundo coberto por tracos RISCADOS finissimos em branco, dourado, verde, ciano e rosa — gravura, nunca pintura. ESCALA 1:1: a vegetacao riscada e MINUSCULA e MUITO DENSA (folhinhas, flores e samambaias do tamanho que tem na carta, aos montes, preenchendo cada canto), nunca folhas grandes e espacadas. A CACHOEIRA azul continua RETA de cima pra baixo, na mesma largura e no mesmo eixo em que ela toca as bordas superior e inferior da carta, com respingos brancos. Encostas escuras riscadas ao fundo. PROIBIDO: pintura oriental, pergaminho, aquarela, segundo Magikarp, area vazia sem tracos e texto.', 'sv2-203', { fragmentoCarta: true }),
  hero('charmander-151', 'Charmander', '151 · IR', 33, 'ESCALA 1:1 COM A CARTA — a pagina e o mesmo desfiladeiro apenas mais largo, nunca um zoom: as paredes de rocha estratificada em tons TERRACOTA, salmao e marrom-avermelhado continuam com a MESMA espessura de camada que tem na carta, e as folhagens VERDE-AZULADAS (samambaias e palmas) ficam PEQUENAS e esparsas nas beiradas, do tamanhinho que tem na carta. Os feixes de LUZ claros descem do alto entre as paredes, como na arte. PROIBIDO: planta gigante em primeiro plano, moita cobrindo a base, chama solta, segundo Charmander, ceu aberto, horizonte, e qualquer elemento novo — area de rocha calma e vazia e o certo.', 'sv3pt5-168', { fragmentoCarta: true }),
  hero('charmeleon-151', 'Charmeleon', '151 · IR', 34, 'O crepusculo rochoso entre a chama e a evolucao.', 'sv3pt5-169'),
  hero('squirtle-151', 'Squirtle', '151 · IR', 35, 'O riacho da cena original serpenteia pelos bolsos.', 'sv3pt5-170'),
  hero('bulbasaur-151', 'Bulbasaur', '151 · IR', 36, 'O jardim ensolarado cresce em folhagem pagina afora.', 'sv3pt5-166'),
  hero('mew-ex-pf', 'Mew ex', 'Paldean Fates · SIR', 37, 'Continuar a MESMA cena da carta pra fora, no mesmo desenho infantil de contorno preto FINO e cores chapadas: o ceu azul-claro com nuvens brancas e risquinhos segue por cima, a colina verde-limao segue pros lados na MESMA altura em que toca a borda da carta, e o gramado desce ate a base. Poucos bichinhos MINUSCULOS espalhados (Diglett, Oddish azul shiny, Poliwag), do tamanhinho que tem na carta, mais risquinhos de grama. PROIBIDO: montanha, lago grande, arvore alta, caminho, casa, textura de tela ou canvas, sombreado, segundo Mew e texto.', 'sv4pt5-232', { fragmentoCarta: true }),
  hero('tr-mewtwo', "Team Rocket's Mewtwo", 'Destined Rivals · SIR', 38, 'PALETA DE NEON EM CONTRASTE, nao roxo lavado: MAGENTA e ROSA-CHOQUE dominando, cortados por CIANO eletrico e fios de VERDE-LIMAO nas bordas de luz, sobre preto profundo — mesma saturacao dura da carta. ENQUADRAMENTO FECHADO: as estruturas industriais do laboratorio continuam BEM PROXIMAS (tubos, dutos, paineis, vidros e vigas cortados pela borda), sem salao gigante, sem chao vazio e sem perspectiva de fuga. PROIBIDO: silhueta ou figura de pessoa, Giovanni, segundo Mewtwo, cidade ao fundo, ceu, relampago e texto.', 'sv10-231'),
  hero('tr-nidoking', "Team Rocket's Nidoking", 'Destined Rivals · SIR', 39, 'CAVERNA SUBTERRANEA FECHADA como a carta, nunca cidade: paredes e teto de PEDRA CINZA-ESCURA continuando bem proximos, blocos de rocha quebrada e lascas suspensas no ar com poeira, e o CHAO RACHADO com fendas irradiando ENERGIA VERMELHO-LARANJA quente que ilumina de baixo. Mesma escala de pedra e destroco da carta, mesma pintura sombria de contraste alto. PROIBIDO: cidade, predios, ruas, placas ou letreiros com R, neon, ceu, relampago, qualquer pessoa (nem Giovanni nem recrutas da Rocket), qualquer Pokemon fora da carta e texto.', 'sv10-233'),
  hero('cynthia-garchomp', "Cynthia's Garchomp", 'Destined Rivals · UR', 40, 'FLAT DESIGN GRAFICO, sem textura e sem cena: fundo AMARELO-DOURADO chapado tomando a pagina inteira, com as MECHAS LONGAS do cabelo louro da Cynthia se espalhando em ondas suaves pra fora da carta, desenhadas so com CONTORNO MARROM FINO (linha de nanquim), do mesmo peso de traco da carta. ESCALA 1:1: o retrato dela nao cresce — a pagina mostra apenas a continuacao das mechas e do fundo amarelo, nunca um rosto gigante. PROIBIDO: pinceladas texturizadas, rochas, areia, arena, sombra, degrade forte, segundo Garchomp e qualquer texto. Amarelo chapado + linha marrom, so isso.', 'sv10-215'),
  {
    id: 'gardevoir-ex-svi',
    nome: 'Familia Gardevoir',
    sub: 'Scarlet & Violet · a linha evolutiva completa',
    ordem: 41,
    // Pagina especial (17/08, referencia do Du): Ralts IR, Kirlia IR e
    // Gardevoir ex SIR contam a MESMA historia na mesma casa — as tres artes
    // do SVI sao uma sequencia. Lado a lado na fileira do meio, com a sala
    // atravessando as tres.
    tema: 'A MESMA CASA atravessa as tres cartas numa unica cena continua, vista de frente e na mesma escala: parede VERDE-LIMAO clara coberta de quadrinhos emoldurados de Pokemon e flores, rodape de madeira, cortina de LOSANGOS VERMELHOS E BRANCOS na janela a esquerda, armario alto de madeira VERDE-ESCURA, poltrona de estampa floral rosa-salmao, cesta de vime com novelos de la coloridos, limoeiro em vaso com limoes amarelos a direita, mesa redonda de madeira clara com cafeteira e xicaras, tapete estampado e assoalho de madeira quente. Gouache DENSO e SATURADO, luz quente de tarde, muito detalhe caseiro. PROIBIDO: qualquer PESSOA, Gardevoir, Kirlia ou Ralts no fundo (eles vivem so dentro das cartas), texto, numero, moldura de carta e retangulos vazios.',
    cartas: [
      { cardId: 'sv1-211', slot: 3 },              // Ralts IR — a mudanca
      { cardId: 'sv1-212', slot: 4 },              // Kirlia IR — a infancia
      { cardId: 'sv1-245', slot: 5, heroi: true }, // Gardevoir ex SIR — hoje
    ],
  },
  hero('charizard-ex-of', 'Charizard ex', 'Obsidian Flames · SIR', 42, 'CAMPO DE CRISTAIS TERA, nao vulcao: continuar as facetas de cristal quebrado em BRANCO, PRATA e cinza-gelo que tomam a carta, com reflexos prismaticos arco-iris (azul, verde, rosa, amarelo) nas quinas e brilhos de estrela espalhados. As facetas seguem o mesmo tamanho e angulo das da carta, irradiando do centro. PROIBIDO: lava, magma, rocha vulcanica, montanha, fogo laranja dominando, qualquer parte do Charizard fora da carta e QUALQUER texto ou numero.', 'sv3-223'),
  hero('roaring-moon', 'Roaring Moon ex', 'Paradox Rift · SIR', 43, 'ENQUADRAMENTO FECHADO como a carta: selva primitiva umida vista de PERTO, sem horizonte e SEM CEU visivel. Continuar os rochedos cobertos de musgo e samambaias bem proximos, a vegetacao tropical densa de folhas grandes, a nevoa branca entre as plantas e os raios de luz difusos atravessando o vapor — tudo na MESMA escala da carta (folha e pedra do mesmo tamanho). Paleta: verde-esmeralda, verde-agua, cinza-pedra umido, com respingos de rosa e vermelho da vegetacao. PROIBIDO: ceu aberto, por do sol, panorama de vale, cachoeiras gigantes, ruinas de colunas ou templos, rio em primeiro plano, qualquer parte do Roaring Moon e os outros Pokemon paradoxo duplicados.', 'sv4-251'),
  hero('terapagos-ex', 'Terapagos ex', 'Stellar Crown · SIR', 44, 'MOSAICO DE TESSELAS MINUSCULAS, como a carta: milhares de quadradinhos e tijolinhos de vidro bem pequenos (cada um do tamanho que tem na carta, nao aumentar), separados por linhas de chumbo FINAS, formando arcos e circulos concentricos e leques de escamas que irradiam do centro. Paleta exata: azul-marinho, azul-medio, turquesa, BEGE-CREME claro, branco-gelo e toques de lilas, com brilho iridescente arco-iris sutil entre os vidros e estrelinhas brancas de quatro pontas espalhadas. PROIBIDO: tesselas grandes ou chumbo grosso, rosacea gotica simetrica, catedral, arcos de pedra, colunas, perspectiva 3D, qualquer parte do Terapagos e as gemas Tera coloridas repetidas. Superficie chapada de vitral, vista de frente.', 'sv7-170'),
  hero('victini-wf', 'Victini', 'White Flare · IR', 45, 'A chama branca da vitoria dancando pela pagina.', 'rsv10pt5-172'),
  hero('pikachu-ex-ah', 'Pikachu ex', 'Ascended Heroes · SIR', 46, 'ESCALA 1:1 COM A CARTA — a pagina e uma JANELA MAIOR da mesma pintura, nunca um zoom. PROFUNDIDADE IGUAL A DA CARTA: os troncos da floresta sao FINOS, distantes e ESBATIDOS pela nevoa dourada (nada de tronco grosso em primeiro plano ocupando a lateral). Apenas o tronco musgoso da borda DIREITA continua grande, com a mesma largura que tem na carta. Luz do sol difusa dourado-esverdeada filtrando entre as arvores, atmosfera clara e enevoada como na carta (nao escurecer, nao saturar o verde). BASE: folhagem verde desfocada em bokeh no primeiro plano e o tronco caido musgoso continuando pros lados. Pintura digital suave com profundidade de campo.', 'me2pt5-276', { cartas: [{ cardId: 'me2pt5-276', slot: 4, heroi: true, img: 'https://images.scrydex.com/pokemon/me2pt5-276/small' }] }),
  hero('mega-gengar-ex', 'Mega Gengar ex', 'Ascended Heroes · SIR', 47, 'ESCALA 1:1 COM A CARTA — a pagina e uma JANELA MAIOR da mesma pintura, nunca um zoom: as pinceladas psicodelicas continuam FINAS e DENSAS como na carta, nunca pinceladas gigantes e espacadas. Zonas de cor seguindo as bordas: TOPO em carmesim escuro, laranja e roxo profundo; ESQUERDA com o redemoinho AMARELO e laranja; DIREITA em vermelho, rosa-choque e roxo; BASE dominada por VERDE-LIMAO vibrante com amarelo e roxo. Textura de tinta a oleo espessa e expressiva, contraste alto e saturacao maxima. PROIBIDO: qualquer parte do Gengar (espinho, orelha, sombra roxa com forma de corpo) fora da carta — so tinta abstrata.', 'me2pt5-284', { cartas: [{ cardId: 'me2pt5-284', slot: 4, heroi: true, img: 'https://images.scrydex.com/pokemon/me2pt5-284/small' }] }),
  hero('mega-dragonite-ex', 'Mega Dragonite ex', 'Ascended Heroes · SIR', 48, 'ESCALA 1:1 COM A CARTA — a pagina e uma JANELA MAIOR da mesma pintura, nunca um zoom: as faixas de luz pastel (rosa, azul-claro, amarelo, verde-agua) que irradiam do centro continuam com a MESMA largura FINA que tem na borda da carta, so mais compridas; as nuvens branco-creme mantem o MESMO tamanho pequeno; as estrelas douradas de contorno ficam do mesmo tamanho e na mesma densidade. As silhuetas azul-claras de Dragonair e a rosa de Dragonite aparecem discretas nas laterais, do tamanho que tem na carta. TEXTURA DE PINTURA MACIA como a carta: tudo pintado com bordas SUAVES e difusas, nevoa, veladuras e granulado de aquarela\aerografo. As faixas de luz sao esfumacadas nas beiradas (NUNCA raios chapados de vetor com borda dura), as nuvens sao massas de vapor macias sem contorno desenhado, as estrelas sao brilhos dourados pequenos com halo difuso (NAO estrelas geometricas chapadas). PROIBIDO: aparencia de clipart\vetor, contorno duro, Dragonite gigante ou asas gigantes no topo, mar\oceano, horizonte, qualquer elemento maior do que ja existe na carta.', 'me2pt5-290', { cartas: [{ cardId: 'me2pt5-290', slot: 4, heroi: true, img: 'https://images.scrydex.com/pokemon/me2pt5-290/small' }] }),
  hero('meowth-pf', 'Meowth', 'Phantasmal Flames · IR', 49, 'ESCALA 1:1 COM A CARTA — a pagina e uma JANELA MAIOR da mesma pintura, nunca um zoom: um elemento que mede X na carta mede X na pagina. O tronco de arvore continua com a MESMA largura estreita que tem na carta (nao engrossar, nao virar arvore gigante); o galho horizontal onde o gato deita atravessa a pagina na mesma espessura; as casinhas japonesas de telhado azul e vermelho ficam PEQUENAS ao fundo, do mesmo tamanho que aparecem na carta, alinhadas na mesma linha de horizonte; a folhagem verde-agua e os arbustos com florzinhas rosa mantem o tamanho de folha da carta. Aquarela clara com contorno de nanquim fino, mesma luz de dia suave.', 'me2-106'),
  hero('clefairy-po', 'Clefairy', 'Perfect Order · IR', 50, 'CORES SATURADAS como a carta, NUNCA pastel lavado. DIREITA: um PAREDAO DE ROCHA vertical cinza-azulado escuro com veios verticais (NAO e tronco de arvore, nao usar marrom) coberto de MUSGO TURQUESA e VERDE-AGUA vibrante e folhagem azulada, continuando reto pra cima ate o topo e pra baixo ate a base da pagina, com a mesma largura que tem na borda. TOPO e ESQUERDA: ceu AZUL-NOITE profundo com nuvens ROSA-CHOQUE, lilas e creme empilhadas em camadas, estrelinhas e brilhos circulares dourados com anel. BASE: o penhasco desce em degraus de pedra musgosa com vegetacao verde-azulada escura, flores brancas e azuis pequenas. Mesma pincelada de aquarela densa e mesmo contraste da carta.', 'me3-94', { cartas: [{ cardId: 'me3-94', slot: 4, heroi: true, img: 'https://images.scrydex.com/pokemon/me3-94/small' }] }),
  hero('flareon-v', 'Flareon V', 'Evolving Skies · Alt Art', 51, 'FUNDO ABSTRATO DE PINCELADAS, sem cenario e sem criatura: continuar exatamente a pintura de pinceladas largas e visiveis da carta em todas as direcoes, mesmo tracado diagonal e mesma textura de tinta a seco. Cores seguindo as bordas: VERDE-AGUA e turquesa dominando a esquerda, AMARELO-esverdeado subindo no centro do topo, LILAS e roxo-claro na direita, azul-turquesa com toques de ROSA suave na base. Sem degrade liso, sem paisagem, sem objetos. PROIBIDO desenhar Flareon ou qualquer criatura fora da carta.', 'swsh7-169'),
  hero('glaceon-v', 'Glaceon V', 'Evolving Skies · Alt Art', 52, 'O gelo azul silencioso da alt art cobre os bolsos.', 'swsh7-175'),
]

// ─── Artes curadas (nivel 2) ────────────────────────────────────────────────
// Manifest escrito pelo scripts/gerar-artes-lendarias.mjs (Nano Banana).
// Arte gerada vence o eco do nivel 1; pagina sem entrada continua no eco.
import artesGeradas from './paginas-lendarias-artes.json'

for (const p of PAGINAS_LENDARIAS) {
  const arte = (artesGeradas as Record<string, string>)[p.id]
  if (arte) p.arteUrl = arte
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const POR_ID = new Map(PAGINAS_LENDARIAS.map(p => [p.id, p]))

const HEROI_POR_CARD = new Map<string, PaginaLendaria>()
for (const p of PAGINAS_LENDARIAS) {
  for (const c of p.cartas) if (c.heroi) HEROI_POR_CARD.set(c.cardId, p)
}

export function getPaginaLendaria(id: string): PaginaLendaria | null {
  return POR_ID.get(id) || null
}

/** Todos os card_ids do catalogo (30). */
export function cardIdsLendarios(): string[] {
  return PAGINAS_LENDARIAS.flatMap(p => p.cartas.map(c => c.cardId))
}

/**
 * Se uma das cartas desta lista e heroi de alguma Pagina Lendaria, devolve a
 * pagina — e o gancho do fichario dos master sets: a pagina 3x3 que contem a
 * carta ganha o fundo continuo de teaser.
 */
export function heroiEntre(cardIds: (string | null | undefined)[]): { pagina: PaginaLendaria; cardId: string } | null {
  for (const id of cardIds) {
    if (!id) continue
    const p = HEROI_POR_CARD.get(id)
    if (p) return { pagina: p, cardId: id }
  }
  return null
}
