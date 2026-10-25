// src/lib/parceriaMaterial.ts
//
// Apresentacao do Programa de Parceiros (PDF de 9 slides feito no Figma).
// PURO: usado pela landing /criadores, pela Central do Parceiro e pelos
// e-mails de parceria.
//
// O arquivo mora no Supabase Storage (bucket publico `parceria-material`),
// FORA do repositorio: o repo e publico e o git guardaria para sempre um
// binario com arte de terceiros e numeros que envelhecem. Versao nova sobe
// AO LADO da anterior com outro nome; trocar aqui e o rollback e uma linha.
//
// O PDF so aparece DEPOIS que a pessoa pede a parceria (decisao de 23/10/2026):
// no celular ele abre fora do navegador e nao tem caminho de volta, entao
// antes do pedido ele tiraria a pessoa do cadastro.

export const APRESENTACAO_PARCERIA = {
  url: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/parceria-material/bynx-parceiros-2026-10.pdf',
  capa: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/parceria-material/capa-2026-10.jpg',
  tamanho: '5 MB',
  paginas: 9,
  versao: 'out/2026',
} as const
