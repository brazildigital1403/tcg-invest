// Estilo da tela Album do Club no /admin (21/11/2026). O /admin crava valores proprios
// (nao usa --ac-*): os mesmos das outras telas (raio 12, input 48 px com fonte 16, botao 44 px).

export const AC_CSS = `
.ac-box{border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.02);padding:16px;display:flex;flex-direction:column;gap:12px;min-width:0}
.ac-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ac-row.sp{justify-content:space-between}
.ac-h2{font-size:18px;font-weight:800;letter-spacing:-0.02em;margin:0;color:#f0f0f0}
.ac-h3{font-size:15px;font-weight:800;margin:0;color:#f0f0f0}
.ac-mut{font-size:12.5px;color:rgba(255,255,255,0.45);margin:0;line-height:1.45}
.ac-mut b{color:rgba(255,255,255,0.8)}
.ac-btn{min-height:44px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:#f0f0f0;font:inherit;font-size:14px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;transition:background .15s ease,opacity .15s ease}
.ac-btn:hover:not(:disabled){background:rgba(255,255,255,0.05)}
.ac-btn.pri{background:linear-gradient(135deg,#f59e0b,#ef4444);border-color:transparent;color:#0d0d0d}
.ac-btn.pri:hover:not(:disabled){background:linear-gradient(135deg,#f59e0b,#ef4444);opacity:.92}
.ac-btn.red{color:#ef4444;border-color:rgba(239,68,68,0.3)}
.ac-btn.sm{min-height:36px;padding:0 12px;font-size:12.5px;border-radius:10px}
.ac-btn:disabled{opacity:.45;cursor:default}
.ac-fase{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border:1px solid rgba(255,255,255,0.14);color:rgba(255,255,255,0.6)}
.ac-fase.aberta{color:#22c55e;border-color:rgba(34,197,94,0.35);background:rgba(34,197,94,0.08)}
.ac-fase.agendada{color:#60a5fa;border-color:rgba(96,165,250,0.35);background:rgba(96,165,250,0.08)}
.ac-fase.so_pedidos,.ac-fase.prazo_encerrado{color:#f59e0b;border-color:rgba(245,158,11,0.4);background:rgba(245,158,11,0.08)}
.ac-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.ac-num{border:1px solid rgba(255,255,255,0.08);border-radius:10px;background:rgba(255,255,255,0.03);padding:10px 12px}
.ac-num b{display:block;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#f0f0f0;font-variant-numeric:tabular-nums}
.ac-num span{font-size:11.5px;color:rgba(255,255,255,0.45)}
.ac-datas{display:flex;gap:6px 18px;flex-wrap:wrap;font-size:12.5px;color:rgba(255,255,255,0.55)}
.ac-datas b{color:#f0f0f0;font-weight:700}
.ac-falta{font-size:13px;border-radius:10px;padding:10px 12px;border:1px solid rgba(245,158,11,0.35);background:rgba(245,158,11,0.07);color:#f0f0f0;line-height:1.5}
.ac-falta button{background:transparent;border:0;padding:0;font:inherit;font-weight:800;color:#f59e0b;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.ac-tabs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.ac-tabs::-webkit-scrollbar{display:none}
.ac-tab{flex:none;min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:rgba(255,255,255,0.7);font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.ac-tab.on{background:rgba(245,158,11,0.12);border-color:rgba(245,158,11,0.45);color:#f59e0b}
.ac-f{display:flex;flex-direction:column;gap:5px;min-width:0}
.ac-lb{font-size:12px;font-weight:700;color:rgba(255,255,255,0.6)}
.ac-in{width:100%;min-height:48px;border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:10px 12px;color:#f0f0f0;background:rgba(255,255,255,0.04);font:inherit;font-size:16px;outline:none;transition:border-color .15s ease}
.ac-in:focus{border-color:rgba(245,158,11,0.5)}
.ac-in:disabled{opacity:.55}
.ac-in.ta{min-height:96px;resize:vertical;line-height:1.45}
.ac-hint{font-size:11.5px;color:rgba(255,255,255,0.4)}
.ac-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ac-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.ac-msg{font-size:13px;border-radius:10px;padding:9px 12px;border:1px solid rgba(255,255,255,0.14);color:#f0f0f0;background:rgba(255,255,255,0.03)}
.ac-msg.erro{color:#ef4444;border-color:rgba(239,68,68,0.35);background:rgba(239,68,68,0.08)}
.ac-msg.ok{color:#22c55e;border-color:rgba(34,197,94,0.35);background:rgba(34,197,94,0.08)}
.ac-cartas{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px}
.ac-carta{border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.02);padding:14px;display:flex;gap:14px;min-width:0;scroll-margin-top:16px}
.ac-prev{width:132px;flex:none;display:flex;flex-direction:column;gap:8px}
.ac-prev .ac-btn{width:100%}
.ac-campos{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}
.ac-cab{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
.ac-cab b{font-size:14px;font-weight:800;color:#f0f0f0}
.ac-cab span{font-size:11.5px;color:rgba(255,255,255,0.45)}
.ac-tg{display:flex;align-items:center;gap:10px;min-height:44px;font-size:13.5px;color:#f0f0f0;cursor:pointer}
.ac-tg input{width:20px;height:20px;accent-color:#f59e0b;flex:none}
.ac-tg.off{opacity:.5;cursor:default}
.ac-lin{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13.5px;color:#f0f0f0}
.ac-lin:last-child{border-bottom:0}
.ac-lin .tx{flex:1;min-width:0}
.ac-lin .tx b{display:block;font-weight:700;overflow-wrap:anywhere}
.ac-lin .tx small{display:block;color:rgba(255,255,255,0.45);font-size:12px}
.ac-est{display:inline-block;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;border:1px solid rgba(255,255,255,0.14);color:rgba(255,255,255,0.7);white-space:nowrap}
.ac-est.recebe{color:#22c55e;border-color:rgba(34,197,94,0.35)}
.ac-est.ja_tem{color:rgba(255,255,255,0.55)}
.ac-est.nao_membro,.ac-est.ambiguo{color:#f59e0b;border-color:rgba(245,158,11,0.4)}
.ac-est.sem_conta{color:#ef4444;border-color:rgba(239,68,68,0.35)}
.ac-est.desfeito{color:rgba(255,255,255,0.45)}
.ac-chips{display:flex;gap:8px;flex-wrap:wrap}
.ac-tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:760px}
.ac-tbl th{text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,0.45);padding:11px 10px;border-bottom:1px solid rgba(255,255,255,0.08)}
.ac-tbl td{padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);vertical-align:top;color:#f0f0f0}
.ac-tbl td b{display:block;font-weight:700}
.ac-tbl td small{display:block;color:rgba(255,255,255,0.45);font-size:12px}
.ac-tbl tr.cancelado td{opacity:.5}
.ac-tbl select{min-height:40px;border:1px solid rgba(255,255,255,0.14);border-radius:10px;background:rgba(255,255,255,0.04);color:#f0f0f0;font:inherit;font-size:13px;padding:0 8px}
.ac-scroll{overflow-x:auto}
.ac-a{color:#f59e0b;text-underline-offset:3px}
@media (max-width:900px){
  .ac-cartas{grid-template-columns:1fr}
}
@media (max-width:640px){
  .ac-carta{flex-direction:column}
  .ac-prev{width:100%;flex-direction:row;align-items:flex-end}
  .ac-prev>.pv{width:110px;flex:none}
  .ac-prev .ac-btn{flex:1}
  .ac-2,.ac-3{grid-template-columns:1fr}
  .ac-tbl{min-width:0}
  .ac-tbl thead{display:none}
  .ac-tbl,.ac-tbl tbody,.ac-tbl tr,.ac-tbl td{display:block}
  .ac-tbl tr{padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06)}
  .ac-tbl td{border:0;padding:3px 0}
}
`
