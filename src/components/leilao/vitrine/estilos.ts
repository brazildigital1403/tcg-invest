/**
 * CSS da vitrine do Bynx Leiloes (/leiloes). Injetado uma vez pela pagina.
 * So tokens `--bx-*` / `--ac-*` (o azul do selo verificado vem do componente
 * SeloVerificado, que e a excecao documentada da casa). Motion 0.15s ease,
 * sem transform para quem pediu menos movimento. Celular primeiro: 375px
 * empilhado; desktop (>= 769px) em grade, conteudo ate 1200px.
 */
export const CSS_VITRINE = `
.vt { display: flex; flex-direction: column; gap: 28px; min-width: 0; }
@media (min-width: 769px) { .vt { gap: 40px; } }
.vt *, .vt *::before, .vt *::after { box-sizing: border-box; }
.vt-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; margin: -1px; padding: 0; border: 0; }
.vt-num { font-variant-numeric: tabular-nums; }
.vt-rot { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--bx-text-3); margin: 0; }
.vt-fraco { color: var(--bx-text-3); }

/* Titulo da pagina */
.vt-hero h1 { margin: 0 0 6px; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; text-wrap: balance; color: var(--bx-text); }
.vt-hero p { margin: 0; font-size: 15px; color: var(--bx-text-2); line-height: 1.5; }
@media (min-width: 769px) { .vt-hero h1 { font-size: 38px; line-height: 1.05; } }

/* Secao */
.vt-sec { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.vt-sec-t { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.vt-sec-t h2 { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -0.01em; color: var(--bx-text); }
@media (min-width: 769px) { .vt-sec-t h2 { font-size: 20px; } }
.vt-mais {
  display: inline-flex; align-items: center; min-height: 44px; font-size: 13px; font-weight: 700; color: var(--ac-1);
  text-decoration: none; white-space: nowrap; transition: opacity 0.15s ease;
}
.vt-mais:hover { opacity: 0.8; }

/* Botoes */
.vt-cta {
  min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 18px;
  border-radius: 12px; background: var(--ac-grad); color: var(--bx-brand-ink); font-weight: 800; font-size: 14.5px;
  text-decoration: none; border: none; cursor: pointer; font-family: inherit; transition: filter 0.15s ease;
}
.vt-cta:hover { filter: brightness(1.08); }
.vt-cta-sec {
  min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 18px;
  border-radius: 12px; border: 1px solid var(--bx-border-2); background: transparent; color: var(--bx-text);
  font-weight: 700; font-size: 14px; text-decoration: none; font-family: inherit; cursor: pointer;
  transition: background 0.15s ease;
}
.vt-cta-sec:hover { background: var(--bx-surface-2); }
.vt-aviso-ok { margin: 0; flex-basis: 100%; padding: 10px 12px; border-radius: 10px; font-size: 13.5px; font-weight: 600; color: var(--bx-text); background: rgba(var(--ac-1-rgb), 0.1); border: 1px solid rgba(var(--ac-1-rgb), 0.3); }
.vt-aviso-erro { margin: 0; flex-basis: 100%; font-size: 13px; color: var(--bx-red); }
.vt a:focus-visible, .vt button:focus-visible, .vt summary:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }

/* Logo da loja */
.vt-logo {
  width: 36px; height: 36px; border-radius: 10px; flex: 0 0 36px; object-fit: cover; display: grid; place-items: center;
  background: var(--bx-surface-3); border: 1px solid var(--bx-border-2); color: var(--bx-text); font-weight: 800; font-size: 13px;
}
.vt-logo-p { width: 30px; height: 30px; flex-basis: 30px; border-radius: 8px; font-size: 12px; }
.vt-verif { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: var(--bx-text-2); white-space: nowrap; vertical-align: 1px; }

/* Topo da vitrine */
.vt-topo { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.vt-topo-t { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.vt-frase { margin: 0; font-size: 34px; font-weight: 800; line-height: 1.06; letter-spacing: -0.025em; text-wrap: balance; color: var(--bx-text); }
.vt-frase em { font-style: normal; color: var(--ac-1); }
.vt-frase-apoio { display: none; margin: 0; max-width: 44ch; font-size: 17px; line-height: 1.45; color: var(--bx-text-2); }
.vt-topo-r { min-width: 0; }
/* No celular o selo AO VIVO ja esta no cabecalho da casca. */
@media (max-width: 768px) { .vt-topo-t .lk-selo { display: none; } }
@media (min-width: 769px) {
  .vt-topo { grid-template-columns: minmax(0, 1fr) minmax(0, 440px); grid-template-rows: 1fr auto auto 1fr; gap: 16px 56px; }
  .vt-topo-t { grid-column: 1; grid-row: 2; gap: 14px; }
  .vt-topo-c { grid-column: 2; grid-row: 1 / span 4; min-width: 0; }
  .vt-topo-r { grid-column: 1; grid-row: 3; }
  .vt-frase { font-size: 68px; line-height: 1; }
  .vt-frase-apoio { display: block; }
}

/* Cartao do lote em destaque */
.vt-dest {
  display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 18px; border: 1px solid rgba(var(--ac-1-rgb), 0.34);
  background: var(--bx-hero-wash), var(--bx-surface); color: inherit; text-decoration: none; transition: transform 0.15s ease, border-color 0.15s ease;
}
.vt-dest:hover { transform: translateY(-2px); border-color: rgba(var(--ac-1-rgb), 0.55); }
.vt-dest:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
.vt-dest-t { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.vt-dest-art { display: flex; justify-content: center; }
.vt-dest-art img { display: block; width: auto; height: 268px; max-width: 100%; border-radius: 10px; box-shadow: var(--bx-shadow); }
.vt-dest-nome { display: flex; flex-direction: column; min-width: 0; }
.vt-dest-nome strong { font-size: 19px; font-weight: 800; letter-spacing: -0.015em; line-height: 1.2; color: var(--bx-text); overflow-wrap: anywhere; }
.vt-dest-nome small { font-size: 13px; color: var(--bx-text-2); }
@media (min-width: 769px) { .vt-dest { padding: 22px; gap: 14px; } .vt-dest-art img { height: 340px; } .vt-dest-nome strong { font-size: 24px; } }

/* Chamada para lojas */
.vt-fila { display: flex; flex-direction: column; gap: 8px; }
.vt-lojas-c { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 16px; border-radius: 18px; border: 1px solid var(--bx-border); background: var(--bx-surface); }
.vt-lojas-c > div { flex: 1 1 200px; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.vt-lojas-c .lk-btn { flex: 1 1 160px; }
@media (min-width: 769px) { .vt-lojas-c .lk-btn { flex: 0 0 auto; } }

/* Sem leilao aberto */
.vt-leque { display: flex; justify-content: center; padding: 8px 0 16px; }
.vt-leque img { width: 96px; height: auto; border-radius: 6px; box-shadow: var(--bx-shadow); }
.vt-leque img:nth-child(1) { transform: rotate(-9deg) translate(18px, 8px); }
.vt-leque img:nth-child(2) { position: relative; z-index: 1; }
.vt-leque img:nth-child(3) { transform: rotate(9deg) translate(-18px, 8px); }
@media (min-width: 769px) { .vt-leque img { width: 140px; } }
.vt-exemplo { align-self: center; font-size: 11.5px; font-weight: 700; color: var(--bx-text-2); padding: 3px 10px; border-radius: 999px; background: var(--bx-surface-3); }
.vt-passos-c { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.vt-passos-c li { display: flex; flex-direction: column; gap: 3px; padding: 10px; border-radius: 12px; background: var(--bx-surface); border: 1px solid var(--bx-border); min-width: 0; }
.vt-passos-c i {
  width: 22px; height: 22px; display: grid; place-items: center; border-radius: 999px; font-style: normal; font-size: 11px; font-weight: 800;
  background: rgba(var(--ac-1-rgb), 0.16); color: var(--ac-1);
}
.vt-passos-c b { font-size: 13px; line-height: 1.25; color: var(--bx-text); }
.vt-passos-c span { font-size: 11.5px; line-height: 1.3; color: var(--bx-text-2); }
@media (min-width: 769px) { .vt-passos-c li { padding: 16px; } .vt-passos-c b { font-size: 15px; } .vt-passos-c span { font-size: 13px; } }

/* Agenda */
.vt-ag { display: flex; align-items: flex-start; gap: 8px; padding: 12px; border-radius: 14px; border: 1px solid var(--bx-border); background: var(--bx-surface); transition: background 0.15s ease; }
.vt-ag:hover { background: var(--bx-surface-2); }
.vt-ag-l { flex: 1; min-width: 0; display: flex; gap: 12px; color: inherit; text-decoration: none; }
.vt-ag-h { flex-shrink: 0; width: 66px; }
.vt-ag-h b { font-size: 21px; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--bx-text); }
.vt-ag-c { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.vt-ag-loja { display: flex; align-items: center; gap: 10px; min-width: 0; }
.vt-ag-loja > span:last-child { min-width: 0; display: flex; flex-direction: column; }
.vt-ag-loja b { font-size: 15px; color: var(--bx-text); overflow-wrap: anywhere; }
.vt-ag-loja small { font-size: 12.5px; color: var(--bx-text-2); }
.vt-ag-mos { display: flex; margin-top: 10px; }
.vt-ag-mos img { width: 48px; height: auto; margin-right: -10px; border-radius: 4px; border: 1px solid var(--bx-bg); }
.vt-agendar-i {
  flex-shrink: 0; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 10px; border: 1px solid var(--bx-border-2);
  background: transparent; color: var(--ac-1); cursor: pointer; transition: background 0.15s ease;
}
.vt-agendar-i:hover { background: var(--bx-surface-3); }

.vt-res-lista { display: flex; flex-direction: column; gap: 8px; }
.vt-aviso-b { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px; border-radius: 16px; border: 1px solid var(--bx-border); background: var(--bx-surface); }
.vt-aviso-b > div:first-of-type { flex: 1 1 180px; min-width: 0; }
.vt-aviso-b b { display: block; font-size: 15px; color: var(--bx-text); }
.vt-aviso-b small { font-size: 13px; color: var(--bx-text-2); }
.vt-aviso-b .lk-btn { flex: 1 1 220px; }
@media (min-width: 769px) { .vt-aviso-b .lk-btn { flex: 0 0 auto; } }

/* Garantia em uma linha */
.vt-selos {
  display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; min-height: 44px;
  font-size: 12px; font-weight: 600; color: var(--bx-text-2); text-decoration: none; transition: color 0.15s ease;
}
.vt-selos:hover { color: var(--bx-text); }
.vt-selos span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.vt-selos svg { color: var(--ac-1); flex-shrink: 0; }
@media (min-width: 769px) { .vt-selos { font-size: 13px; gap: 8px 20px; } }
.vt-sec-t h2 .vt-conta { margin-left: 7px; font-size: 13px; font-weight: 700; color: var(--bx-text-3); }

/* Primeira dobra */
.vt-dobra { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
@media (min-width: 1024px) { .vt-dobra.vt-com-hoje { grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); gap: 24px; } }

.vt-palco {
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 16px; border-radius: 18px;
  border: 1px solid var(--bx-border);
  background: radial-gradient(120% 90% at 20% 20%, rgba(var(--ac-1-rgb), 0.14), transparent 60%), var(--bx-bg-elev);
  min-width: 0;
}
@media (min-width: 769px) { .vt-palco { grid-template-columns: 240px minmax(0, 1fr); gap: 24px; padding: 22px; } }
.vt-carta { position: relative; display: flex; justify-content: center; align-items: flex-start; text-decoration: none; }
.vt-carta-in { position: relative; display: block; width: 100%; max-width: 170px; }
@media (min-width: 769px) { .vt-carta-in { max-width: 240px; } }
.vt-carta-img { width: 100%; max-width: 170px; height: auto; border-radius: 12px; box-shadow: var(--bx-shadow); display: block; }
@media (min-width: 769px) { .vt-carta-img { max-width: 240px; } }
.vt-carta-vazia { width: 170px; aspect-ratio: 245 / 342; border-radius: 12px; background: var(--bx-surface-2); border: 1px solid var(--bx-border); }
@media (min-width: 769px) { .vt-carta-vazia { width: 100%; max-width: 240px; } }
.vt-selo-vivo {
  position: absolute; top: 8px; left: 8px; display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px;
  border-radius: 999px; border: 1px solid var(--ac-2); color: var(--ac-2); background: var(--bx-scrim);
  font-size: 11px; font-weight: 800; letter-spacing: 0.06em;
}
.vt-selo-breve { border-color: var(--bx-border-2); color: var(--bx-text); }
.vt-ponto { width: 7px; height: 7px; border-radius: 50%; background: var(--ac-2); animation: vt-pulsa 1.2s ease-in-out infinite; }
@keyframes vt-pulsa { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.vt-info { display: flex; flex-direction: column; gap: 12px; justify-content: center; min-width: 0; }
.vt-loja { display: flex; align-items: center; gap: 10px; min-width: 0; }
.vt-loja-nome { font-weight: 800; font-size: 15px; color: var(--bx-text); overflow-wrap: anywhere; }
.vt-loja-sub { font-size: 12.5px; color: var(--bx-text-3); overflow-wrap: anywhere; }
.vt-lote-nome { font-weight: 700; font-size: 15px; color: var(--bx-text); margin: 0; overflow-wrap: anywhere; }
.vt-lote-nome span { font-weight: 500; color: var(--bx-text-3); }
.vt-linha { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.vt-preco { font-size: 34px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; color: var(--bx-text); }
@media (min-width: 769px) { .vt-preco { font-size: 44px; } }
.vt-minis { display: flex; gap: 8px; overflow: hidden; }
.vt-mini { position: relative; width: 46px; flex: 0 0 46px; border-radius: 6px; overflow: hidden; border: 1px solid var(--bx-border); background: var(--bx-surface-2); aspect-ratio: 245 / 342; }
.vt-mini img { width: 100%; height: 100%; object-fit: cover; display: block; }
.vt-mini span {
  position: absolute; left: 2px; top: 2px; font-size: 9.5px; font-weight: 800; background: var(--bx-scrim); color: var(--bx-text);
  border-radius: 4px; padding: 0 3px; font-variant-numeric: tabular-nums;
}
.vt-palco .vt-cta { align-self: stretch; }
@media (min-width: 769px) { .vt-palco .vt-cta { align-self: flex-start; } }

/* Anel do relogio (vitrine) */
.vt-anel { position: relative; width: 58px; height: 58px; flex: 0 0 58px; }
.vt-anel svg { position: absolute; inset: 0; }
.vt-anel b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }

/* Hero sem rodada nenhuma */
.vt-heroi {
  display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 22px; border-radius: 18px;
  border: 1px solid var(--bx-border);
  background: radial-gradient(120% 90% at 20% 20%, rgba(var(--ac-1-rgb), 0.14), transparent 60%), var(--bx-bg-elev);
}
.vt-heroi h2 { margin: 0; font-size: 20px; font-weight: 800; color: var(--bx-text); }
.vt-heroi p { margin: 0; font-size: 14px; color: var(--bx-text-2); line-height: 1.5; max-width: 560px; }
.vt-acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }

/* Card "Hoje" */
.vt-hoje { border: 1px solid var(--bx-border); border-radius: 16px; background: var(--bx-surface); padding: 16px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.vt-hoje .vt-sec-t h2 { font-size: 16px; }
.vt-hoje-lista { list-style: none; margin: 0; padding: 0; }
.vt-hoje-it { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--bx-border); }
.vt-hoje-it:last-child { border-bottom: 0; }
.vt-hora { font-weight: 800; font-size: 15px; min-width: 44px; color: var(--bx-text); padding-top: 4px; }
.vt-hoje-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.vt-hoje-t { font-size: 13.5px; font-weight: 700; color: var(--bx-text); text-decoration: none; overflow-wrap: anywhere; min-height: 24px; display: inline-flex; align-items: center; }
.vt-hoje-t:hover { text-decoration: underline; }
.vt-hoje-s { font-size: 12px; color: var(--bx-text-3); }
.vt-agendar {
  align-self: flex-start; margin-top: 2px; min-height: 44px; display: inline-flex; align-items: center; gap: 6px; padding: 0;
  border: none; background: transparent; color: var(--ac-1); font-family: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer;
  transition: opacity 0.15s ease;
}
.vt-agendar:hover { opacity: 0.8; }
.vt-agendar-caixa { min-height: 46px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--bx-border-2); color: var(--bx-text); font-size: 14px; }

/* Faixa de garantia */
.vt-garantia { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); border: 1px solid var(--bx-border); border-radius: 16px; background: var(--bx-surface); list-style: none; margin: 0; padding: 0; }
.vt-garantia li { padding: 14px; display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
.vt-garantia li:nth-child(odd) { border-right: 1px solid var(--bx-border); }
.vt-garantia li:nth-child(-n+2) { border-bottom: 1px solid var(--bx-border); }
.vt-garantia svg { flex: 0 0 20px; color: var(--ac-1); margin-top: 1px; }
.vt-garantia b { display: block; font-size: 13.5px; color: var(--bx-text); }
.vt-garantia span { display: block; font-size: 12.5px; color: var(--bx-text-2); line-height: 1.45; }
@media (min-width: 769px) {
  .vt-garantia { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .vt-garantia li { padding: 16px; border-bottom: 0 !important; border-right: 1px solid var(--bx-border); }
  .vt-garantia li:last-child { border-right: 0; }
}

/* Grades de carta */
.vt-grade { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 640px) { .vt-grade { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; } }
@media (min-width: 1024px) { .vt-grade6 { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .vt-grade-auto { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); } }
.vt-lote { display: block; text-decoration: none; color: inherit; border-radius: 18px; transition: transform 0.15s ease; min-width: 0; }
.vt-lote:hover { transform: translateY(-2px); }
.vt-tag {
  background: var(--bx-bg-elev); border: 1px solid var(--bx-border-2); border-radius: 8px; padding: 4px 8px; font-size: 12px;
  font-weight: 800; color: var(--bx-text); font-variant-numeric: tabular-nums; white-space: nowrap;
}
.vt-arr-rod { display: flex; flex-direction: column; gap: 2px; font-size: 11.5px; color: var(--bx-text-2); }
.vt-ok { color: var(--bx-green); font-weight: 700; }
.vt-rodape-lote { display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
.vt-lances { font-size: 11px; color: var(--bx-text-3); font-weight: 600; white-space: nowrap; }

/* Agenda da semana: 7 colunas no desktop, trilho com rolagem propria no celular */
.vt-semana {
  display: grid; grid-template-columns: repeat(7, 104px); gap: 10px; overflow-x: auto; scroll-snap-type: x proximity;
  scrollbar-width: thin; padding-bottom: 4px; list-style: none; margin: 0;
}
@media (min-width: 1024px) { .vt-semana { grid-template-columns: repeat(7, minmax(0, 1fr)); overflow: visible; } }
.vt-dia {
  border: 1px solid var(--bx-border); border-radius: 14px; padding: 10px; display: flex; flex-direction: column; gap: 8px;
  background: var(--bx-surface); min-height: 150px; scroll-snap-align: start; min-width: 0; position: relative;
}
.vt-dia-hoje { border-color: var(--ac-1); }
.vt-dia-d { font-size: 12px; font-weight: 700; color: var(--bx-text-3); }
.vt-dia-d b { display: block; color: var(--bx-text); font-size: 18px; font-variant-numeric: tabular-nums; }
.vt-rd {
  border-radius: 10px; background: var(--bx-surface-2); padding: 7px; display: flex; flex-direction: column; gap: 5px;
  text-decoration: none; color: inherit; min-height: 44px; transition: background 0.15s ease;
}
.vt-rd:hover { background: var(--bx-surface-3); }
.vt-mos { display: flex; gap: 3px; }
.vt-mos img, .vt-mos span { width: calc((100% - 6px) / 3); height: auto; aspect-ratio: 245 / 342; border-radius: 3px; object-fit: cover; display: block; background: var(--bx-surface-3); }
.vt-rd b { font-size: 11.5px; color: var(--bx-text); overflow-wrap: anywhere; }
.vt-rd span.vt-rd-s { font-size: 11px; color: var(--bx-text-2); }
.vt-dia-vazio { margin-top: auto; height: 2px; background: var(--bx-border); border-radius: 2px; }

/* Lojas */
.vt-lojas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; list-style: none; margin: 0; padding: 0; }
@media (min-width: 769px) { .vt-lojas { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; } }
.vt-lojac {
  border: 1px solid var(--bx-border); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 8px;
  background: var(--bx-surface); text-decoration: none; color: inherit; height: 100%; min-width: 0; transition: border-color 0.15s ease;
}
a.vt-lojac:hover { border-color: var(--bx-border-2); }
.vt-lojac-nm { font-weight: 800; font-size: 14px; color: var(--bx-text); overflow-wrap: anywhere; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
.vt-lojac-st { font-size: 12px; color: var(--bx-text-2); }
.vt-lojac-sua { border-style: dashed; justify-content: center; align-items: flex-start; }

/* Como funciona */
.vt-passos { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; list-style: none; margin: 0; padding: 0; }
@media (min-width: 769px) { .vt-passos { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; } }
.vt-passo { border: 1px solid var(--bx-border); border-radius: 14px; padding: 16px; background: var(--bx-surface); display: flex; gap: 14px; }
.vt-passo-n {
  width: 32px; height: 32px; border-radius: 50%; background: var(--ac-grad); color: var(--bx-brand-ink); font-weight: 800;
  display: grid; place-items: center; flex: 0 0 32px;
}
.vt-passo b { display: block; font-size: 14.5px; margin-bottom: 2px; color: var(--bx-text); }
.vt-passo span { font-size: 13px; color: var(--bx-text-2); line-height: 1.5; }

/* FAQ: <details>, sem JS */
.vt-faq { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; align-items: start; }
@media (min-width: 769px) { .vt-faq { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.vt-faq details { border: 1px solid var(--bx-border); border-radius: 12px; background: var(--bx-surface); }
.vt-faq summary {
  list-style: none; cursor: pointer; min-height: 48px; padding: 12px 16px; display: flex; justify-content: space-between;
  align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: var(--bx-text); border-radius: 12px;
}
.vt-faq summary::-webkit-details-marker { display: none; }
.vt-faq summary svg { color: var(--bx-text-3); flex-shrink: 0; transition: transform 0.15s ease; }
.vt-faq details[open] summary svg { transform: rotate(45deg); }
.vt-faq details p { margin: 0; padding: 0 16px 14px; font-size: 13.5px; line-height: 1.55; color: var(--bx-text-2); }

/* Bloco para lojas */
.vt-lojista {
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: center; padding: 18px; border-radius: 18px;
  border: 1px solid var(--bx-border-2);
  background: radial-gradient(120% 120% at 85% 20%, rgba(var(--ac-1-rgb), 0.12), transparent 60%), var(--bx-bg-elev);
}
@media (min-width: 769px) { .vt-lojista { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 24px; padding: 26px; } }
.vt-lojista h2 { margin: 0 0 8px; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; color: var(--bx-text); }
@media (min-width: 769px) { .vt-lojista h2 { font-size: 24px; } }
.vt-lojista-sub { font-size: 14px; color: var(--bx-text-2); margin: 0; }
.vt-lojista ul { margin: 12px 0 18px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; color: var(--bx-text-2); }
.vt-lojista li { display: flex; gap: 8px; align-items: baseline; }
.vt-lojista li::before { content: ""; flex: 0 0 6px; height: 6px; border-radius: 50%; background: var(--ac-1); transform: translateY(-2px); }
.vt-painel { border: 1px solid var(--bx-border); border-radius: 14px; background: var(--bx-bg); padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.vt-painel-l { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 8px; border-radius: 8px; background: var(--bx-surface-2); color: var(--bx-text-2); }
.vt-painel-l b { color: var(--bx-text); }
.vt-painel-carta { width: 22px; aspect-ratio: 245 / 342; border-radius: 3px; background: var(--bx-surface-3); border: 1px solid var(--bx-border-2); flex-shrink: 0; }
.vt-painel-barra { margin-left: auto; width: 56px; height: 8px; border-radius: 4px; background: var(--bx-surface-3); }

/* Lista de rodadas (Tambem ao vivo, abas Agenda e Resultados) */
.vt-lista { list-style: none; margin: 0; padding: 0; border: 1px solid var(--bx-border); border-radius: 12px; overflow: hidden; }
.vt-lista li + li { border-top: 1px solid var(--bx-border); }
.vt-linha-r {
  display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 8px 12px; font-size: 13px; color: var(--bx-text-2);
  text-decoration: none; transition: background 0.15s ease;
}
.vt-linha-r:hover { background: var(--bx-surface-2); }

@media (prefers-reduced-motion: reduce) {
  .vt-lote, .vt-lote:hover, .vt-dest, .vt-dest:hover { transition: none; transform: none; }
  .vt-ponto { animation: none; }
  .vt-faq summary svg { transition: none; }
}
`
