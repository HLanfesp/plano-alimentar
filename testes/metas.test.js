import { test } from 'node:test';
import assert from 'node:assert';
import { metaDoDia, statusMacro } from '../src/metas.js';

test('deriva a meta de carbo da segunda', () => {
  const m = metaDoDia({ kcal: 2507, p: 203 });
  assert.strictEqual(m.c, 267);
  assert.strictEqual(m.cDerivado, true);
});

test('deriva a meta de carbo do sabado', () => {
  assert.strictEqual(metaDoDia({ kcal: 2952, p: 218 }).c, 336);
});

test('kcal e proteina passam intactos, sem derivacao', () => {
  const m = metaDoDia({ kcal: 2749, p: 211 });
  assert.strictEqual(m.kcal, 2749);
  assert.strictEqual(m.p, 211);
});

test('o alerta e assimetrico: acima da meta e verde', () => {
  assert.strictEqual(statusMacro(3300, 2507), 'verde');
  assert.strictEqual(statusMacro(2507, 2507), 'verde');
  assert.strictEqual(statusMacro(2400, 2507), 'verde');
});

test('abaixo de 90% da meta acende amarelo', () => {
  assert.strictEqual(statusMacro(2200, 2507), 'amarelo');
});

test('abaixo de 75% da meta acende vermelho', () => {
  assert.strictEqual(statusMacro(1700, 2507), 'vermelho');
});

test('dia vazio e vermelho, nao um estado especial', () => {
  assert.strictEqual(statusMacro(0, 2507), 'vermelho');
});
