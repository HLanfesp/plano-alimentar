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

// Soma uma porção inteira (extra ou combustível) ao acumulador, multiplicada
// pela quantidade de porções — `extras.json`/`combustivel.json` já vêm por
// porção, não por 100 g, então aqui não tem fator de gramagem como em
// `calcularItens`.
export function somarPorcao(acc, porcao, qtd) {
  if (!porcao) return acc;
  acc.kcal += (porcao.kcal || 0) * qtd;
  acc.p += (porcao.p || 0) * qtd;
  acc.c += (porcao.c || 0) * qtd;
  if ('g' in acc) acc.g += (porcao.g || 0) * qtd;
  return acc;
}

// Soma ao acumulador os extras e o combustível registrados num dia. Usada
// tanto pela tela Hoje (`calcular`, em app.js) quanto pela tela Semana (soma
// da janela de 7 dias) — é a regra de "o que o atleta comeu além do plano",
// e precisa valer nas duas telas por igual.
export function somarExtrasDia(acc, dia, extras, combustivel) {
  for (const e of dia.extras || []) somarPorcao(acc, extras[e.id], e.qtd);
  for (const c of dia.combustivel || []) somarPorcao(acc, combustivel[c.id], c.qtd);
  return acc;
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
