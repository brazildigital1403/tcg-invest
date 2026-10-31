/**
 * CSS da casca do Bynx Leiloes (cabecalho, abas, rodape). Injetado uma vez
 * pelo src/app/leiloes/layout.tsx. So tokens `--bx-*` / `--ac-*`: nada de cor
 * cravada, e o motion e o da casa (0.15s ease, sem transform em quem pediu
 * menos movimento).
 */
export const CSS_CASCA = `
.lc-casca { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; background: var(--bx-bg); color: var(--bx-text); }
.lc-main { flex: 1; width: 100%; padding-top: 16px; padding-bottom: 32px; }
@media (min-width: 769px) { .lc-main { padding-top: 24px; padding-bottom: 48px; } }

/* Cabecalho: 56px, logo | Leiloes */
.lc-topo { position: sticky; top: 0; z-index: 120; height: 56px; background: var(--bx-bg-elev); border-bottom: 1px solid var(--bx-border); }
.lc-topo-in { height: 100%; max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 10px; }
.lc-marca { display: inline-flex; align-items: center; gap: 9px; min-height: 44px; text-decoration: none; color: var(--bx-text); flex-shrink: 0; }
.lc-marca img { height: 22px; width: auto; display: block; }
.lc-div { width: 1px; height: 18px; background: var(--bx-border-2); }
.lc-prod { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; }
.lc-sp { flex: 1; min-width: 0; }
.lc-marca:focus-visible, .lc-aovivo:focus-visible, .lc-entrar:focus-visible, .lc-avatar-btn:focus-visible,
.lc-aba:focus-visible, .lc-link:focus-visible, .lc-item:focus-visible, .lc-fechar:focus-visible {
  outline: 2px solid var(--ac-1); outline-offset: 2px;
}

/* Nav do desktop (no celular quem navega sao as abas da home) */
.lc-nav { display: none; }
@media (min-width: 769px) {
  .lc-nav { display: flex; align-items: center; gap: 4px; margin-left: 12px; min-width: 0; }
  .lc-abas { display: none !important; }
}
.lc-nav-l {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 9px; border-radius: 8px; white-space: nowrap;
  font-size: 13.5px; font-weight: 600; color: var(--bx-text-2); text-decoration: none; transition: color 0.15s ease, background 0.15s ease;
}
.lc-nav-l:hover { color: var(--bx-text); background: var(--bx-surface-2); }
.lc-nav-l[aria-current="page"] { color: var(--bx-text); }
.lc-nav-l:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }

/* Selo AO VIVO: so a opacidade pulsa; desligado com prefers-reduced-motion */
.lc-aovivo {
  display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px;
  border: 1px solid var(--ac-2); color: var(--ac-2); font-size: 11px; font-weight: 800; letter-spacing: 0.06em;
  text-decoration: none; white-space: nowrap; flex-shrink: 0;
  /* alvo de toque de 44px sem crescer o desenho do selo */
  position: relative;
}
.lc-aovivo::after { content: ''; position: absolute; inset: -9px -4px; }
.lc-aovivo-ponto { width: 7px; height: 7px; border-radius: 50%; background: var(--ac-2); animation: lc-pulsa 1.2s ease-in-out infinite; }
@keyframes lc-pulsa { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .lc-aovivo-ponto { animation: none; } }

/* Conta: Entrar ou avatar */
/* Desenho de 34px (como no mockup), alvo de toque de 44px pelo ::after. */
.lc-entrar {
  position: relative; height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--bx-border-2); background: transparent;
  color: var(--bx-text); font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.lc-entrar::after { content: ''; position: absolute; inset: -5px -2px; }
.lc-entrar:hover { background: var(--bx-surface-2); }
.lc-avatar-btn { width: 44px; height: 44px; display: grid; place-items: center; border: none; background: transparent; padding: 0; cursor: pointer; flex-shrink: 0; }
.lc-avatar {
  width: 32px; height: 32px; border-radius: 50%; background: var(--bx-surface-3); border: 1px solid var(--bx-border-2);
  display: grid; place-items: center; font-size: 12px; font-weight: 700; color: var(--bx-text); transition: border-color 0.15s ease;
}
.lc-avatar-btn:hover .lc-avatar, .lc-avatar-btn[aria-expanded="true"] .lc-avatar { border-color: var(--ac-1); }
.lc-vaga { width: 44px; height: 44px; flex-shrink: 0; }
.lc-protegido { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--bx-text-2); white-space: nowrap; }

/* Folha da conta: de baixo no celular, menu no desktop */
.lc-folha-fundo { position: fixed; inset: 0; z-index: 500; background: var(--bx-scrim); display: flex; align-items: flex-end; justify-content: center; }
.lc-folha {
  width: 100%; max-width: 520px; background: var(--bx-bg-elev); border: 1px solid var(--bx-border); border-bottom: none;
  border-radius: 18px 18px 0 0; box-shadow: var(--bx-shadow); outline: none;
  padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px)); animation: lc-sobe 0.2s ease;
}
@media (min-width: 769px) {
  .lc-folha-fundo { background: transparent; align-items: flex-start; justify-content: flex-end; }
  .lc-folha {
    position: absolute; top: 60px; right: max(24px, calc((100vw - 1200px) / 2)); width: 300px; border-radius: 14px;
    border-bottom: 1px solid var(--bx-border); padding: 8px; animation: none;
  }
}
@keyframes lc-sobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .lc-folha { animation: none; } }
.lc-folha-topo { display: flex; align-items: center; gap: 10px; padding: 6px 4px 10px; border-bottom: 1px solid var(--bx-border); margin-bottom: 6px; }
.lc-folha-nome { flex: 1; min-width: 0; font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-folha-email { display: block; font-size: 12px; font-weight: 500; color: var(--bx-text-3); overflow: hidden; text-overflow: ellipsis; }
.lc-fechar {
  width: 44px; height: 44px; display: grid; place-items: center; border-radius: 10px; border: 1px solid var(--bx-border);
  background: var(--bx-surface); color: var(--bx-text-2); cursor: pointer; flex-shrink: 0;
}
@media (min-width: 769px) { .lc-fechar { display: none; } }
.lc-item {
  width: 100%; min-height: 48px; display: flex; align-items: center; gap: 12px; padding: 0 10px; border-radius: 10px;
  border: none; background: transparent; color: var(--bx-text); font-family: inherit; font-size: 14px; font-weight: 600;
  text-decoration: none; cursor: pointer; text-align: left; transition: background 0.15s ease;
}
.lc-item:hover { background: var(--bx-surface-2); }
.lc-item svg { color: var(--bx-text-2); flex-shrink: 0; }
.lc-item-sair { color: var(--bx-text-2); }
.lc-sep { height: 1px; background: var(--bx-border); margin: 6px 0; }

/* Abas da home (links ?aba=, funcionam sem JS) */
.lc-abas {
  display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 0 16px 12px; margin: 0 -16px 16px;
  border-bottom: 1px solid var(--bx-border);
}
.lc-abas::-webkit-scrollbar { display: none; }
@media (min-width: 769px) { .lc-abas { margin: 0 0 20px; padding: 0 0 12px; } }
.lc-aba {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 999px; white-space: nowrap;
  border: 1px solid var(--bx-border); color: var(--bx-text-2); font-size: 13px; font-weight: 600; text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.lc-aba:hover { background: var(--bx-surface-2); border-color: var(--bx-border-2); }
.lc-aba[aria-current="page"] { border-color: var(--ac-1); color: var(--ac-1); background: rgba(var(--ac-1-rgb), 0.12); }

/* Rodape enxuto */
.lc-rodape { border-top: 1px solid var(--bx-border); background: var(--bx-bg-elev); padding-top: 18px; padding-bottom: calc(18px + env(safe-area-inset-bottom, 0px)); }
.lc-rodape-in { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
.lc-rodape-protecao { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12px; color: var(--bx-text-2); }
.lc-rodape-links { display: flex; flex-wrap: wrap; column-gap: 16px; }
.lc-link {
  display: inline-flex; align-items: center; min-height: 44px; font-size: 13px; font-weight: 600; color: var(--bx-text-3);
  text-decoration: none; transition: color 0.15s ease;
}
.lc-link:hover { color: var(--bx-text); }
@media (min-width: 769px) { .lc-rodape-in { flex-direction: row; align-items: center; justify-content: space-between; } }
/* CTA fixo no fim da tela (lance ou pagar, so no celular): a folga fica DEPOIS
   do rodape, senao o CTA cobre os links. So existe quando o CTA esta na tela. */
@media (max-width: 768px) {
  .lc-casca:has(.lv-cta-fixo, .pg-cta-fixo) .lc-rodape { padding-bottom: calc(18px + 84px + env(safe-area-inset-bottom, 0px)); }
}
`
