import { test } from 'node:test';
import assert from 'node:assert';
import { ordenarOpcoes, resumoRestante, fatiaPorRefeicao } from '../src/sugestao.js';

const alimentos = {
  frango_grelhado: { nome: 'Frango', kcal: 165, p: 31, c: 0, g: 3.6, fonte: 't' },
  arroz_branco:    { nome: 'Arroz',  kcal: 128, p: 2.5, c: 28.1, g: 0.2, fonte: 't' },
  banana:          { nome: 'Banana', kcal: 92,  p: 1.3, c: 23.8, g: 0.1, fonte: 't' },
};

const opcoes = [
  { letra: 'A', itens: [{ alimento: 'banana', g: 200 }] },
  { letra: 'B', itens: [{ alimento: 'frango_grelhado', g: 200 }] },
  { letra: 'C', itens: [{ alimento: 'arroz_branco', g: 200 }] },
];

test('com deficit grande de proteina, a opcao proteica vence', () => {
  const r = ordenarOpcoes(opcoes, { kcal: 400, p: 60 }, alimentos);
  assert.strictEqual(r[0].opcao.letra, 'B');
});

test('sem deficit de proteina, a opcao que fecha kcal vence', () => {
  const r = ordenarOpcoes(opcoes, { kcal: 250, p: 2 }, alimentos);
  assert.notStrictEqual(r[0].opcao.letra, 'B');
});

test('devolve todas as opcoes, nunca filtra', () => {
  assert.strictEqual(ordenarOpcoes(opcoes, { kcal: 400, p: 60 }, alimentos).length, 3);
});

test('a ordem e crescente por custo', () => {
  const r = ordenarOpcoes(opcoes, { kcal: 400, p: 60 }, alimentos);
  assert.ok(r[0].custo <= r[1].custo && r[1].custo <= r[2].custo);
});

test('o resumo conta o que falta em linguagem natural', () => {
  assert.strictEqual(
    resumoRestante({ kcal: 1800, p: 149 }, { kcal: 2507, p: 203 }, 2),
    'faltam 54 g de proteína em 2 refeições'
  );
});

test('meta ja batida devolve mensagem de meta cumprida', () => {
  assert.strictEqual(
    resumoRestante({ kcal: 2600, p: 210 }, { kcal: 2507, p: 203 }, 1),
    'meta de proteína cumprida'
  );
});

test('com uma refeicao restante, a fatia e o deficit inteiro', () => {
  const f = fatiaPorRefeicao({ kcal: 2000, p: 150 }, { kcal: 2500, p: 200 }, 1);
  assert.deepStrictEqual(f, { kcal: 500, p: 50 });
});

test('com varias refeicoes restantes, o deficit e dividido', () => {
  const f = fatiaPorRefeicao({ kcal: 1000, p: 50 }, { kcal: 2500, p: 200 }, 5);
  assert.deepStrictEqual(f, { kcal: 300, p: 30 });
});

test('deficit ja zerado devolve fatia zero, nunca negativa', () => {
  const f = fatiaPorRefeicao({ kcal: 2800, p: 220 }, { kcal: 2500, p: 200 }, 3);
  assert.deepStrictEqual(f, { kcal: 0, p: 0 });
});

test('zero refeicoes restantes nao divide por zero', () => {
  const f = fatiaPorRefeicao({ kcal: 2000, p: 150 }, { kcal: 2500, p: 200 }, 0);
  assert.deepStrictEqual(f, { kcal: 500, p: 50 });
});

test('a fatia alimenta ordenarOpcoes sem deformar a escolha', () => {
  const f = fatiaPorRefeicao({ kcal: 0, p: 0 }, { kcal: 2400, p: 360 }, 6);
  const r = ordenarOpcoes(opcoes, f, alimentos);
  assert.strictEqual(r[0].opcao.letra, 'B');
});
