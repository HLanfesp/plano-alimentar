import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

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
