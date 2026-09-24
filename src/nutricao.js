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
// Refeição completa pelos valores (24/Set/2026)
// -----------------------------------------------
// O atleta mistura ingredientes de opções diferentes da mesma refeição — é a
// razão de o app existir. A regra original só fechava a refeição quando TODOS
// os itens de UMA opção estavam marcados; nos 16 primeiros dias de uso real,
// 48 de 110 refeições ficaram "parciais", várias com 105–146% do previsto.
//
// Agora há dois caminhos para "completa":
//   1. uma opção inteira marcada (o que o plano prescreve nunca vira parcial);
//   2. o consumido na refeição bate LIMIAR_REFEICAO das kcal E da proteína do
//      alvo da refeição — a média das opções, que o plano desenha equivalentes.
// 90% é o mesmo corte que deixa a barra do dia verde (src/metas.js).
//
// Refeições de carbo (pré-treino) têm alvo de proteína de décimos de grama;
// exigir 90% disso deixaria qualquer mistura "parcial" por arredondamento.
// Abaixo de PROTEINA_MINIMA_ALVO gramas, só as kcal decidem.
//
// Sem `alimentos`, vale só o caminho 1 (compatível com chamadores antigos).
export const LIMIAR_REFEICAO = 0.9;
const PROTEINA_MINIMA_ALVO = 5;

const resolviveis = (opcao, alimentos) =>
  opcao.itens.filter(i => i.alimento && (!alimentos || alimentos[i.alimento]));

export function alvoDaRefeicao(refeicao, alimentos) {
  const opcoes = refeicao.opcoes
    .map(o => resolviveis(o, alimentos))
    .filter(itens => itens.length > 0)
    .map(itens => calcularItens(itens, alimentos));
  if (opcoes.length === 0) return { kcal: 0, p: 0 };
  return {
    kcal: opcoes.reduce((s, x) => s + x.kcal, 0) / opcoes.length,
    p: opcoes.reduce((s, x) => s + x.p, 0) / opcoes.length,
  };
}

function consumidoNaRefeicao(refeicao, marcados, alimentos) {
  const itens = [];
  for (const opcao of refeicao.opcoes) {
    for (const item of resolviveis(opcao, alimentos)) {
      if (marcados.has(chaveIngrediente(refeicao.id, opcao.letra, item.alimento))) itens.push(item);
    }
  }
  return calcularItens(itens, alimentos);
}

export function estadoDa(refeicao, marcados, alimentos) {
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
  if (completa) return 'completa';
  if (!alimentos) return 'parcial';

  const alvo = alvoDaRefeicao(refeicao, alimentos);
  if (alvo.kcal <= 0) return 'parcial';
  const comido = consumidoNaRefeicao(refeicao, marcados, alimentos);
  const kcalOk = comido.kcal >= alvo.kcal * LIMIAR_REFEICAO;
  const proteinaOk = alvo.p < PROTEINA_MINIMA_ALVO || comido.p >= alvo.p * LIMIAR_REFEICAO;
  return kcalOk && proteinaOk ? 'completa' : 'parcial';
}

// Dupla contagem do combustível de treino
// ---------------------------------------
// Os itens de `combustivel.json` NÃO são independentes entre si. `hora_pedal`
// é a própria linha "Durante o pedal" do cardápio, e Energy Kick + Saltz
// somados dão praticamente o mesmo número (137 + 44 = 181 kcal contra 180;
// 30 + 11 = 41 g C contra 45). Tocar nos três uma vez daria 361 kcal e 86 g
// de carbo para uma hora de pedal que vale 180 kcal e 45 g — o dobro.
// A orientação do plano é explícita: "gel + Energy Kick + Saltz já são a
// linha 'Durante o pedal' do cardápio — não somam ao resto do dia". Era o
// erro que o atleta já cometia na vida real; o app não pode repeti-lo.
// Qual item contém quais vem do dado (campo `inclui`), não de regra escrita
// aqui: se o cardápio do mês mudar o composto, só o JSON muda.
export function conflitosCombustivel(dia, combustivel) {
  const qtds = new Map((dia.combustivel || []).map(c => [c.id, c.qtd || 0]));
  const ativo = id => (qtds.get(id) || 0) > 0;

  const pares = [];
  for (const [composto, item] of Object.entries(combustivel || {})) {
    for (const contido of item.inclui || []) {
      if (combustivel[contido]) pares.push([composto, contido]);
    }
  }

  const bloqueados = new Map(); // id que NÃO pode somar -> id que já ocupa a conta
  const sobrepostos = new Set(); // itens que já estão somando duas vezes
  for (const [composto, contido] of pares) {
    if (ativo(composto)) bloqueados.set(contido, composto);
    if (ativo(contido)) bloqueados.set(composto, contido);
    if (ativo(composto) && ativo(contido)) {
      sobrepostos.add(composto);
      sobrepostos.add(contido);
    }
  }
  // Quem já está registrado não se bloqueia: o bloqueio é só do "+".
  for (const id of [...bloqueados.keys()]) if (ativo(id)) bloqueados.delete(id);

  return { bloqueados, sobrepostos, temSobreposicao: sobrepostos.size > 0 };
}
