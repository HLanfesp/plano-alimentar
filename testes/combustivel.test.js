import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { conflitosCombustivel } from '../src/nutricao.js';

const comb = JSON.parse(readFileSync('dados/combustivel.json', 'utf8'));
const extras = JSON.parse(readFileSync('dados/extras.json', 'utf8'));

test('a hora de pedal vale 45 g de carbo e 180 kcal', () => {
  assert.strictEqual(comb.hora_pedal.c, 45);
  assert.strictEqual(comb.hora_pedal.kcal, 180);
});

test('os valores de rotulo conferidos estao corretos', () => {
  assert.strictEqual(comb.energy_kick.kcal, 137);
  assert.strictEqual(comb.energy_kick.c, 30);
  assert.strictEqual(comb.saltz.kcal, 44);
  assert.strictEqual(comb.saltz.c, 11);
  assert.strictEqual(comb.saltz.sodio_mg, 1000);
});

test('o gel isolado nao entra: rotulo nao conferido', () => {
  assert.ok(!comb.gel_z2, 'gel Z2 nao deve ser item ate o rotulo ser conferido');
});

test('todo item de combustivel declara a fonte do numero', () => {
  for (const [id, item] of Object.entries(comb)) {
    assert.ok(item.fonte && item.fonte.length > 0, `${id} sem fonte`);
  }
});

test('duas horas de pedal cobrem o deficit medido do sabado', () => {
  const duasHoras = comb.hora_pedal.kcal * 2;
  assert.ok(duasHoras >= 174 && duasHoras <= 400, `${duasHoras} kcal fora da faixa do deficit`);
});

test('a lista de extras tem ao menos 15 itens com macro completo', () => {
  const ids = Object.keys(extras);
  assert.ok(ids.length >= 15, `apenas ${ids.length} extras`);
  for (const [id, e] of Object.entries(extras)) {
    for (const campo of ['nome', 'kcal', 'p', 'c', 'fonte']) {
      assert.ok(campo in e, `extra ${id} sem ${campo}`);
    }
  }
});

// Dupla contagem: hora_pedal JÁ CONTÉM Energy Kick + Saltz
// -------------------------------------------------------
// 137 + 44 = 181 kcal contra os 180 de hora_pedal. Os três somados dariam
// 361 kcal / 86 g C para uma hora de pedal que vale 180 kcal / 45 g C. O
// plano diz: "gel + Energy Kick + Saltz já são a linha 'Durante o pedal' —
// não somam ao resto do dia". O dado tem que declarar essa relação, e a
// regra tem que bloquear o lado conflitante.
test('energy_kick + saltz dao praticamente o mesmo que hora_pedal', () => {
  const soma = comb.energy_kick.kcal + comb.saltz.kcal;
  assert.ok(Math.abs(soma - comb.hora_pedal.kcal) <= 5,
    `${soma} kcal contra ${comb.hora_pedal.kcal} — se divergirem, a relacao "inclui" precisa ser revista`);
});

test('hora_pedal declara no dado que contem energy_kick e saltz', () => {
  assert.deepStrictEqual(comb.hora_pedal.inclui, ['energy_kick', 'saltz']);
});

// I7: o sublabel dizia "gel + Energy Kick + Saltz", mas 180 kcal não cabe
// os três — é a média das 3 OPÇÕES do plano, e coincide com Energy Kick +
// Saltz sozinhos. O sublabel não pode prometer o gel dentro do número.
test('o sublabel da hora de pedal nao promete gel dentro do numero', () => {
  assert.ok(!/gel/i.test(comb.hora_pedal.sublabel),
    `sublabel ainda cita gel: "${comb.hora_pedal.sublabel}"`);
  assert.ok(/Energy Kick/.test(comb.hora_pedal.sublabel) && /Saltz/.test(comb.hora_pedal.sublabel),
    'o sublabel deve dizer a que o numero equivale');
});

test('dia vazio nao bloqueia nada', () => {
  const c = conflitosCombustivel({ combustivel: [] }, comb);
  assert.strictEqual(c.bloqueados.size, 0);
  assert.strictEqual(c.temSobreposicao, false);
});

test('com a hora de pedal marcada, energy kick e saltz ficam bloqueados', () => {
  const c = conflitosCombustivel({ combustivel: [{ id: 'hora_pedal', qtd: 1 }] }, comb);
  assert.deepStrictEqual([...c.bloqueados.keys()].sort(), ['energy_kick', 'saltz']);
  assert.strictEqual(c.bloqueados.get('energy_kick'), 'hora_pedal');
  assert.strictEqual(c.temSobreposicao, false);
});

test('com o energy kick marcado, a hora de pedal fica bloqueada', () => {
  const c = conflitosCombustivel({ combustivel: [{ id: 'energy_kick', qtd: 2 }] }, comb);
  assert.ok(c.bloqueados.has('hora_pedal'));
  assert.ok(!c.bloqueados.has('energy_kick'), 'o item ja marcado nao se bloqueia');
  assert.ok(!c.bloqueados.has('saltz'), 'saltz nao conflita com energy kick');
});

test('quantidade zerada nao conta como marcado', () => {
  const c = conflitosCombustivel({ combustivel: [{ id: 'hora_pedal', qtd: 0 }] }, comb);
  assert.strictEqual(c.bloqueados.size, 0);
});

// Dado legado (gravado antes da correção) pode ter os dois lados marcados.
// Aí não dá para bloquear retroativamente: a tela tem que AVISAR.
test('os dois lados ja marcados viram sobreposicao avisada, nao silencio', () => {
  const c = conflitosCombustivel(
    { combustivel: [{ id: 'hora_pedal', qtd: 1 }, { id: 'saltz', qtd: 1 }] }, comb);
  assert.strictEqual(c.temSobreposicao, true);
  assert.deepStrictEqual([...c.sobrepostos].sort(), ['hora_pedal', 'saltz']);
  assert.ok(c.bloqueados.has('energy_kick'), 'o lado ainda nao tocado continua bloqueado');
});

// A regra mora no dado: sem `inclui`, nada é bloqueado.
test('sem o campo inclui nao ha bloqueio nenhum', () => {
  const semInclui = { a: { nome: 'A', kcal: 1, c: 1 }, b: { nome: 'B', kcal: 1, c: 1 } };
  const c = conflitosCombustivel({ combustivel: [{ id: 'a', qtd: 1 }] }, semInclui);
  assert.strictEqual(c.bloqueados.size, 0);
});
