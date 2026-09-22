-- Escala de condicao no padrao brasileiro: NM / SP / MP / HP / D
-- (22/09/2026, decisao do Du a partir do brief de concorrencia).
--
-- O que muda: LP vira SP e DMG vira D, no dado. A tela le a lista de
-- src/lib/condicoes.ts e entende as duas grafias antigas, entao nenhuma carta
-- some se sobrar valor velho em algum lugar.
--
-- Medido antes: 151 cartas com LP, 15 anuncios com LP, nenhum DMG em lugar
-- nenhum (o DMG so existia no modal da Pokedex, nunca chegou a ser gravado).
-- Nenhuma funcao do banco cita 'LP'.

-- Cartas: a chave LP soma em SP, preservando a quantidade de cada copia.
update user_cards
   set condicoes = (condicoes - 'LP')
                 || jsonb_build_object('SP', coalesce((condicoes->>'SP')::numeric, 0) + (condicoes->>'LP')::numeric)
 where jsonb_exists(condicoes, 'LP');

update user_cards
   set condicoes = (condicoes - 'DMG')
                 || jsonb_build_object('D', coalesce((condicoes->>'D')::numeric, 0) + (condicoes->>'DMG')::numeric)
 where jsonb_exists(condicoes, 'DMG');

-- Anuncios.
update marketplace set condicao = 'SP' where condicao = 'LP';
update marketplace set condicao = 'D'  where condicao = 'DMG';

-- Trava para nao nascer uma quarta grafia. Anuncio sem condicao continua
-- valendo: 14 dos anuncios de hoje estao assim.
alter table marketplace
  add constraint chk_mk_condicao
  check (condicao is null or condicao = any (array['NM','SP','MP','HP','D']));
