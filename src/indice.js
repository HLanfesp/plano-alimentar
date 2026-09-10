// Escolhe qual plano mensal usar a partir do indice (dados/indice.json),
// em vez de ter o nome do arquivo do mes fixo no codigo de src/app.js.
//
// Regra: o mes mais recente que NAO seja futuro em relacao a "hoje". Assim,
// publicar um novo mes e so acrescentar uma entrada em dados/indice.json —
// o app descobre o arquivo certo sozinho, sem editar app.js nem sw.js.
//
// Se por algum motivo todas as entradas forem de meses futuros (ex.: o
// indice foi publicado antes do mes comecar), cai para a mais antiga
// disponivel, para o app nunca abrir sem nenhum plano carregado.
export function escolherPlano(indice, hojeISO) {
  const planos = indice && Array.isArray(indice.planos) ? indice.planos : [];
  if (planos.length === 0) return null;

  const mesAtual = String(hojeISO).slice(0, 7);
  const ordenados = [...planos].sort((a, b) => a.mes.localeCompare(b.mes));
  const naoFuturos = ordenados.filter((p) => p.mes <= mesAtual);

  return naoFuturos.length > 0 ? naoFuturos[naoFuturos.length - 1] : ordenados[0];
}
