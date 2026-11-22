// Cardápio de uma data específica, por cima do cardápio do dia da semana.
//
// O plano mensal é por dia da semana (`dias.seg` … `dias.dom`). Algumas
// datas pedem outro cardápio sem mexer no resto do mês — ex.: o ensaio geral
// de 28/11/2026 cai num sábado, mas não é o "brick longo" dos outros
// sábados de novembro. Trocar `dias.sab` mudaria a meta dos sábados que já
// passaram e distorceria o resumo do mês. Por isso a data especial fica em
// `porData["AAAA-MM-DD"]` e entra no plano carregado com a chave `@AAAA-MM-DD`.
//
// Regra de prioridade (igual à de antes, com um degrau a mais):
//   perfil gravado pelo atleta  >  cardápio da data  >  dia da semana.

const CHAVES_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export const chaveDaData = iso => `@${iso}`;

export function diaDaSemana(iso) {
  const [ano, mes, dia] = String(iso).split('-').map(Number);
  return CHAVES_DIA[new Date(ano, mes - 1, dia).getDay()];
}

// Devolve uma cópia rasa do plano com as datas especiais dentro de `dias`.
// Não muta o objeto lido do JSON.
export function expandirPorData(plano) {
  if (!plano || !plano.porData) return plano;
  const dias = { ...plano.dias };
  for (const [iso, dia] of Object.entries(plano.porData)) dias[chaveDaData(iso)] = dia;
  return { ...plano, dias };
}

// Cardápio "do calendário" para a data: o da data especial, se existir no
// plano, senão o do dia da semana.
export function perfilDoCalendario(plano, iso) {
  const chave = chaveDaData(iso);
  return plano && plano.dias && plano.dias[chave] ? chave : diaDaSemana(iso);
}
