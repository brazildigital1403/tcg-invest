/**
 * Kit visual do Bynx Leiloes: hierarquia do mockup com a identidade da casa.
 * So tokens --bx-* e --ac-*, entao herda ambar (app), azul e roxo (loja) e roxo
 * e rosa (.bx-ctx-comprador). Uma fonte, a da casca. Motion 0.15s e 0.2s ease.
 */
export const CSS_KIT = `
.lk-rotulo { display: block; margin: 0; font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ac-1); }
.lk-rotulo-f { color: var(--bx-text-3); }

.lk-tit { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.lk-tit h1, .lk-tit h2.lk-tit-t { margin: 0; font-size: 34px; font-weight: 800; line-height: 1.06; letter-spacing: -0.025em; text-wrap: balance; color: var(--bx-text); overflow-wrap: anywhere; }
.lk-tit p { margin: 0; max-width: 56ch; font-size: 16px; line-height: 1.45; color: var(--bx-text-2); }
.lk-tit-l { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; }
.lk-sub { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.015em; color: var(--bx-text); }
@media (min-width: 769px) { .lk-tit h1, .lk-tit h2.lk-tit-t { font-size: 44px; } .lk-sub { font-size: 24px; } }

.lk-selo {
  display: inline-flex; align-items: center; gap: 6px; width: fit-content; min-height: 28px; padding: 3px 10px; border-radius: 8px; border: 1px solid;
  font-size: 11.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; font-variant-numeric: tabular-nums;
}
.lk-t-vivo { --lk-c: var(--bx-red); }
.lk-t-frente { --lk-c: var(--bx-green); }
.lk-t-atencao { --lk-c: var(--bx-amber); }
.lk-t-perigo { --lk-c: var(--bx-red); }
.lk-t-acento { --lk-c: var(--ac-1); }
.lk-t-neutro { --lk-c: var(--bx-text-2); }
.lk-selo { color: var(--lk-c); border-color: color-mix(in srgb, var(--lk-c) 40%, transparent); background: color-mix(in srgb, var(--lk-c) 10%, transparent); }
.lk-selo-tempo { text-transform: none; letter-spacing: 0; font-size: 12.5px; }
.lk-ponto { width: 7px; height: 7px; border-radius: 999px; background: currentColor; flex-shrink: 0; }

.lk-bloco {
  display: grid; place-items: center; flex-shrink: 0; color: var(--lk-c); border: 1px solid color-mix(in srgb, var(--lk-c) 32%, transparent);
  background: color-mix(in srgb, var(--lk-c) 12%, transparent);
}
.lk-bloco-g { width: 88px; height: 88px; border-radius: 24px; }
.lk-bloco-m { width: 48px; height: 48px; border-radius: 14px; }

.lk-preco { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lk-preco small { font-size: 12px; font-weight: 600; color: var(--bx-text-3); }
.lk-preco strong { font-size: 40px; font-weight: 800; line-height: 1.05; letter-spacing: -0.025em; font-variant-numeric: tabular-nums; color: var(--bx-text); overflow-wrap: anywhere; }
.lk-preco span { font-size: 13px; color: var(--bx-text-2); }
.lk-preco-m strong { font-size: 24px; }
@media (min-width: 769px) { .lk-preco strong { font-size: 48px; } .lk-preco-m strong { font-size: 28px; } }

.lk-resumos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (min-width: 769px) { .lk-resumos { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); } }
.lk-resumo:last-child:nth-child(odd) { grid-column: 1 / -1; }
@media (min-width: 769px) { .lk-resumo:last-child:nth-child(odd) { grid-column: auto; } }
.lk-resumo { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 14px; border-radius: 14px; border: 1px solid var(--bx-border); background: var(--bx-surface); }
.lk-resumo small { font-size: 12px; font-weight: 600; color: var(--bx-text-2); }
.lk-resumo b { font-size: clamp(19px, 5.4vw, 26px); font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--bx-text); }
.lk-resumo span { font-size: 12px; color: var(--lk-c, var(--bx-text-3)); }

.lk-etapas { list-style: none; margin: 0; padding: 0; }
.lk-etapas-h { display: flex; align-items: flex-start; }
.lk-etapas-h li { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 5px; text-align: center; font-size: 11.5px; font-weight: 600; color: var(--bx-text-3); }
.lk-etapas-h li + li::before { content: ""; position: absolute; top: 14px; right: 50%; width: 100%; height: 1px; background: var(--bx-border-2); }
.lk-etapas-v { display: flex; flex-direction: column; }
.lk-etapas-v li { position: relative; display: flex; align-items: center; gap: 12px; min-height: 44px; font-size: 14px; color: var(--bx-text-2); }
.lk-etapas-v li:not(:last-child)::after { content: ""; position: absolute; left: 14px; top: 36px; bottom: -8px; width: 1px; background: var(--bx-border-2); }
.lk-etapas-v small { margin-left: auto; font-size: 12px; font-weight: 500; color: var(--bx-text-3); text-align: right; }
.lk-num {
  position: relative; z-index: 1; width: 29px; height: 29px; flex-shrink: 0; display: grid; place-items: center; border-radius: 999px; font-style: normal; font-size: 12px; font-weight: 800;
  border: 1px solid var(--bx-border-2); background: var(--bx-bg); color: var(--bx-text-2);
}
.lk-etapas li.lk-atual { color: var(--bx-text); font-weight: 800; }
.lk-atual .lk-num { background: var(--ac-grad); border: 0; color: var(--bx-brand-ink); }
.lk-feito .lk-num { color: var(--bx-green); border-color: color-mix(in srgb, var(--bx-green) 50%, transparent); background: color-mix(in srgb, var(--bx-green) 14%, var(--bx-bg)); }

.lk-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 20px; border-radius: 12px; border: 1px solid transparent; cursor: pointer;
  font-family: inherit; font-size: 15px; font-weight: 800; text-decoration: none; text-align: center; transition: filter 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
.lk-btn:focus-visible, .lk-linha:focus-visible, .lk-rec summary:focus-visible, .lk-aba:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
.lk-btn:disabled { opacity: 0.6; cursor: default; }
.lk-btn-prim { background: var(--ac-grad); color: var(--bx-brand-ink); }
.lk-btn-prim:hover:not(:disabled) { filter: brightness(1.08); }
.lk-btn-sec { background: var(--bx-surface-2); border-color: var(--bx-border-2); color: var(--bx-text); }
.lk-btn-sec:hover:not(:disabled) { background: var(--bx-surface-3); }
.lk-btn-perigo { background: var(--bx-red); color: var(--bx-brand-ink); }
.lk-btn-perigo:hover:not(:disabled) { filter: brightness(1.08); }
.lk-btn-leve { background: transparent; color: var(--ac-1); padding: 0 8px; min-height: 44px; }
.lk-btn-cheio { width: 100%; }
.lk-acoes { display: flex; flex-direction: column; gap: 10px; }
@media (min-width: 769px) { .lk-acoes-l { flex-direction: row; flex-wrap: wrap; } .lk-acoes-l .lk-btn { flex: 1 1 200px; width: auto; } }

.lk-card { display: flex; flex-direction: column; gap: 14px; min-width: 0; padding: 18px; border-radius: 18px; border: 1px solid var(--bx-border); background: var(--bx-surface); }
.lk-card-d { border-color: rgba(var(--ac-1-rgb), 0.34); background: var(--bx-hero-wash), var(--bx-surface); }
.lk-card-t { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }

.lk-estado { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 16px 0; text-align: center; animation: lk-entra 0.2s ease; }
.lk-estado h2 { margin: 0; font-size: 34px; font-weight: 800; line-height: 1.08; letter-spacing: -0.025em; text-wrap: balance; color: var(--bx-text); }
.lk-estado p { margin: 0; max-width: 42ch; font-size: 16px; line-height: 1.45; color: var(--bx-text-2); }
.lk-estado .lk-preco { align-items: center; text-align: center; }
.lk-estado-c { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 14px; text-align: left; }
@keyframes lk-entra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.lk-momento { position: fixed; inset: 0; z-index: 420; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow-y: auto; padding: 56px 16px calc(24px + env(safe-area-inset-bottom, 0px)); background: var(--bx-bg); }
.lk-momento-x { position: absolute; top: 8px; right: 8px; width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 10px; background: transparent; color: var(--bx-text-2); cursor: pointer; transition: background 0.15s ease; }
.lk-momento-x:hover { background: var(--bx-surface-2); }
.lk-momento-x:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
.lk-momento .lk-estado { width: 100%; max-width: 480px; }
.lk-linhas { display: flex; flex-direction: column; gap: 8px; }
.lk-linha {
  display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 10px 12px; border-radius: 14px; border: 1px solid var(--bx-border); background: var(--bx-surface);
  color: inherit; text-decoration: none; transition: background 0.15s ease, border-color 0.15s ease;
}
a.lk-linha:hover { background: var(--bx-surface-2); border-color: var(--bx-border-2); }
.lk-linha-c { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.lk-linha-c b { font-size: 14.5px; font-weight: 700; color: var(--bx-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-linha-c small { font-size: 12.5px; color: var(--bx-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-linha-v { flex-shrink: 0; font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--bx-text); }
.lk-linha-s { flex-shrink: 0; color: var(--bx-text-3); display: flex; }
.lk-item { display: flex; flex-direction: column; gap: 8px; }
.lk-item-acoes { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: -2px; }
.lk-item-acoes .lk-btn { min-height: 44px; padding: 0 14px; font-size: 13.5px; }
.lk-mini { width: 44px; height: auto; flex-shrink: 0; border-radius: 5px; display: block; }

.lk-aviso { display: flex; gap: 10px; padding: 12px 14px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--lk-c) 34%, transparent); background: color-mix(in srgb, var(--lk-c) 8%, transparent); font-size: 13.5px; line-height: 1.45; color: var(--bx-text-2); }
.lk-aviso > svg { flex-shrink: 0; color: var(--lk-c); margin-top: 1px; }
.lk-aviso b { display: block; color: var(--bx-text); }

.lk-rec { border-bottom: 1px solid var(--bx-border); }
.lk-rec summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 48px; cursor: pointer; list-style: none; font-size: 14.5px; font-weight: 600; color: var(--bx-text); }
.lk-rec summary::-webkit-details-marker { display: none; }
.lk-rec summary svg { color: var(--bx-text-3); flex-shrink: 0; transition: transform 0.15s ease; }
.lk-rec[open] summary svg { transform: rotate(180deg); }
.lk-rec-c { display: flex; flex-direction: column; gap: 8px; padding-bottom: 14px; font-size: 14px; line-height: 1.5; color: var(--bx-text-2); }
.lk-rec-c p { margin: 0; }

.lk-abas {
  display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px; margin: -2px;
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent);
}
.lk-abas::-webkit-scrollbar { display: none; }
.lk-aba {
  display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0; min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--bx-border);
  color: var(--bx-text-2); font-size: 13.5px; font-weight: 700; text-decoration: none; white-space: nowrap; transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.lk-aba-b { background: transparent; cursor: pointer; font-family: inherit; }
.lk-aba:hover { background: var(--bx-surface-2); border-color: var(--bx-border-2); }
.lk-aba[aria-current="page"] { border-color: var(--ac-1); color: var(--ac-1); background: rgba(var(--ac-1-rgb), 0.12); }
.lk-aba b { font-size: 12px; font-weight: 800; color: var(--bx-text-3); font-variant-numeric: tabular-nums; }
.lk-aba[aria-current="page"] b { color: var(--ac-1); }

.lk-barra { display: flex; flex-direction: column; gap: 8px; padding: 10px 16px calc(12px + env(safe-area-inset-bottom, 0px)); background: var(--bx-bg-elev); border-top: 1px solid var(--bx-border); box-shadow: var(--bx-shadow); }
.lk-barra p { display: flex; justify-content: space-between; gap: 10px; margin: 0; font-size: 13px; font-weight: 600; color: var(--bx-text-2); }
.lk-barra p b { color: var(--bx-text); font-variant-numeric: tabular-nums; white-space: nowrap; }
.lk-barra small { font-size: 12px; text-align: center; color: var(--bx-text-3); }

.lk-esq { display: block; border-radius: 12px; background: var(--bx-surface-2); }

@media (prefers-reduced-motion: reduce) {
  .lk-estado { animation: none; }
  .lk-btn, .lk-linha, .lk-aba, .lk-rec summary svg { transition: none; }
}
`
