// Atwater: proteína 4 kcal/g, carboidrato 4 kcal/g, gordura 9 kcal/g.
// Tabelas nutricionais têm arredondamento e fibra não contabilizada,
// então 10% de folga é o normal, não frouxidão.
const TOLERANCIA_ATWATER = 0.10;

export function calcularItens(itens, alimentos) {
  const total = { kcal: 0, p: 0, c: 0, g: 0 };
  for (const item of itens) {
    const a = alimentos[item.alimento];
    if (!a) throw new Error(`alimento desconhecido: ${item.alimento}`);
    const fator = item.g / 100;
    total.kcal += a.kcal * fator;
    total.p    += a.p    * fator;
    total.c    += a.c    * fator;
    total.g    += a.g    * fator;
  }
  return total;
}

export function validarAlimento(a) {
  const calculado = a.p * 4 + a.c * 4 + a.g * 9;
  if (calculado === 0 && a.kcal === 0) return { ok: true, desvio: 0 };
  if (calculado === 0) return { ok: false, desvio: 1 };
  const desvio = Math.abs(calculado - a.kcal) / a.kcal;
  return { ok: desvio <= TOLERANCIA_ATWATER, desvio };
}

// Chave de um ingrediente dentro do dia, no formato da spec
// `refeicaoId:letra:alimento`. Vive aqui, e não no app, porque é o
// identificador de domínio que o armazenamento grava.
export function chaveIngrediente(refeicaoId, letra, alimento) {
  return `${refeicaoId}:${letra}:${alimento}`;
}

// Estado de uma refeição diante do que está marcado. "completa" quer dizer
// que ao menos uma opção teve todos os seus itens marcados — itens sem
// `alimento` (as linhas cruas do combustível) não contam para nada.
// Marcar itens de A e de B sem fechar nenhuma das duas é "parcial".
export function estadoDa(refeicao, marcados) {
  let algum = false;
  let completa = false;
  for (const opcao of refeicao.opcoes) {
    const itens = opcao.itens.filter(i => i.alimento);
    if (itens.length === 0) continue;
    let quantos = 0;
    for (const item of itens) {
      if (marcados.has(chaveIngrediente(refeicao.id, opcao.letra, item.alimento))) quantos += 1;
    }
    if (quantos > 0) algum = true;
    if (quantos === itens.length) completa = true;
  }
  if (!algum) return 'vazia';
  return completa ? 'completa' : 'parcial';
}
