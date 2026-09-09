import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const plano = JSON.parse(readFileSync('dados/plano-2026-09.json', 'utf8'));
const alimentos = JSON.parse(readFileSync('dados/alimentos.json', 'utf8'));
const DIAS = ['seg','ter','qua','qui','sex','sab','dom'];

test('o plano tem 7 dias', () => {
  assert.deepStrictEqual(Object.keys(plano.dias).sort(), [...DIAS].sort());
});

test('o plano tem 49 refeicoes e 147 opcoes', () => {
  let refeicoes = 0, opcoes = 0;
  for (const dia of DIAS) {
    refeicoes += plano.dias[dia].refeicoes.length;
    for (const r of plano.dias[dia].refeicoes) opcoes += r.opcoes.length;
  }
  assert.strictEqual(refeicoes, 49);
  assert.strictEqual(opcoes, 147);
});

test('todo ingrediente resolve na base de alimentos', () => {
  const orfaos = new Set();
  for (const dia of DIAS) {
    for (const r of plano.dias[dia].refeicoes) {
      if (r.tipo === 'combustivel') continue;
      for (const o of r.opcoes) {
        for (const item of o.itens) {
          if (!alimentos[item.alimento]) orfaos.add(item.alimento);
          assert.ok(item.g > 0, `gramagem invalida em ${item.alimento}`);
        }
      }
    }
  }
  assert.deepStrictEqual([...orfaos], [], `ingredientes sem entrada na base: ${[...orfaos]}`);
});

test('as metas por dia batem com o plano impresso', () => {
  assert.strictEqual(plano.dias.seg.meta.kcal, 2507);
  assert.strictEqual(plano.dias.seg.meta.p, 203);
  assert.strictEqual(plano.dias.sab.meta.kcal, 2952);
  assert.strictEqual(plano.dias.sab.meta.p, 218);
  assert.strictEqual(plano.dias.dom.meta.kcal, 2671);
});

test('quarta e sexta tem pre-natacao obrigatorio', () => {
  for (const dia of ['qua','sex']) {
    const r = plano.dias[dia].refeicoes.find(x => x.nome.includes('Pré-natação'));
    assert.ok(r, `${dia} sem pre-natacao`);
    assert.strictEqual(r.obrigatorio, true);
  }
});

test('o lanche das 10h e opcional', () => {
  const r = plano.dias.seg.refeicoes.find(x => x.nome.includes('Lanche da manhã'));
  assert.strictEqual(r.opcional, true);
});

test('sabado tem a linha de combustivel, sem kcal', () => {
  const r = plano.dias.sab.refeicoes.find(x => x.tipo === 'combustivel');
  assert.ok(r, 'sabado sem linha de combustivel');
  assert.strictEqual(r.opcoes[0].kcal_plano, null);
});
