import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { somarPorcao, somarExtrasDia } from '../src/nutricao.js';

const extras = JSON.parse(readFileSync('dados/extras.json', 'utf8'));
const combustivel = JSON.parse(readFileSync('dados/combustivel.json', 'utf8'));

const zero = () => ({ kcal: 0, p: 0, c: 0 });

// Este é exatamente o defeito que passou pelos testes antigos de
// `semana.js`: eles só usavam fixtures com `extras`/`combustivel` vazios,
// então a soma por porção nunca foi exercitada. Aqui ela é.

test('somarPorcao multiplica pela quantidade de porcoes, nao pela gramagem', () => {
  // pao_de_queijo é por unidade (140 kcal, 3 p, 15 c cada). Duas unidades
  // tem que dar o dobro — nao ha fator de 100 g envolvido, diferente de
  // calcularItens.
  const total = somarPorcao(zero(), extras.pao_de_queijo, 2);
  assert.strictEqual(total.kcal, 280);
  assert.strictEqual(total.p, 6);
  assert.strictEqual(total.c, 30);
});

test('somarPorcao com porcao desconhecida (undefined) nao altera o acumulador', () => {
  const total = somarPorcao(zero(), undefined, 3);
  assert.deepStrictEqual(total, zero());
});

test('somarExtrasDia soma extras e combustivel do mesmo dia, em porcoes inteiras', () => {
  // Um dia com um extra (pao_de_queijo x1) e uma dose de combustivel
  // (saltz x2): a soma tem que refletir as duas listas juntas.
  const dia = {
    marcados: [],
    extras: [{ id: 'pao_de_queijo', qtd: 1 }],
    combustivel: [{ id: 'saltz', qtd: 2 }],
    perfil: null,
  };
  const total = somarExtrasDia(zero(), dia, extras, combustivel);
  assert.strictEqual(total.kcal, extras.pao_de_queijo.kcal + combustivel.saltz.kcal * 2);
  assert.strictEqual(total.c, extras.pao_de_queijo.c + combustivel.saltz.c * 2);
});

test('somarExtrasDia com dia so de extras (combustivel vazio) soma so os extras', () => {
  const dia = { marcados: [], extras: [{ id: 'fatia_pizza', qtd: 2 }], combustivel: [], perfil: null };
  const total = somarExtrasDia(zero(), dia, extras, combustivel);
  assert.strictEqual(total.kcal, extras.fatia_pizza.kcal * 2);
  assert.strictEqual(total.p, extras.fatia_pizza.p * 2);
});

test('somarExtrasDia com dia so de combustivel (extras vazio) soma so o combustivel', () => {
  const dia = { marcados: [], extras: [], combustivel: [{ id: 'hora_pedal', qtd: 1 }], perfil: null };
  const total = somarExtrasDia(zero(), dia, extras, combustivel);
  assert.strictEqual(total.kcal, combustivel.hora_pedal.kcal);
  assert.strictEqual(total.c, combustivel.hora_pedal.c);
});

test('somarExtrasDia com dia sem nenhum dos dois devolve o acumulador intacto', () => {
  const dia = { marcados: [], extras: [], combustivel: [], perfil: null };
  const total = somarExtrasDia(zero(), dia, extras, combustivel);
  assert.deepStrictEqual(total, zero());
});
