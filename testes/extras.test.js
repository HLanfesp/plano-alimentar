import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { validarAlimento } from '../src/nutricao.js';

// Lista de extras revisada em 24/Set/2026, a pedido do atleta, depois de
// 16 dias de uso real: saem as bebidas que ele não consome; entram as duas
// barras de proteína que ele come (até 3/dia) e os itens que ele mais marcou
// nos lanches (whey 12×, pão integral 9×, banana 8×, ovo 7×, pasta de
// amendoim 6×, iogurte grego 5×).
const extras = JSON.parse(readFileSync('dados/extras.json', 'utf8'));
const alimentos = JSON.parse(readFileSync('dados/alimentos.json', 'utf8'));

test('saem as bebidas que o atleta nao consome', () => {
  for (const id of ['cerveja_lata', 'vinho_taca', 'refrigerante_lata_350ml']) {
    assert.ok(!extras[id], `${id} ainda esta na lista`);
  }
});

test('os extras ja usados no historico real continuam existindo', () => {
  // Registrados entre 09 e 24/Set: remover qualquer um sumiria kcal dos dias passados.
  for (const id of ['pao_frances_manteiga', 'pao_de_queijo']) assert.ok(extras[id], `${id} sumiu`);
});

test('barra Nutrata Whey Grego Bar tem os valores do rotulo', () => {
  const b = extras.barra_nutrata_whey_grego;
  assert.ok(b, 'barra Nutrata ausente');
  assert.deepStrictEqual([b.kcal, b.p, b.c, b.g], [170, 11, 15, 7.3]);
});

test('barra Bold tem os valores do rotulo', () => {
  const b = extras.barra_bold;
  assert.ok(b, 'barra Bold ausente');
  assert.deepStrictEqual([b.kcal, b.p, b.c, b.g], [153, 14, 12.5, 5.7]);
});

test('entram os itens mais marcados nos lanches', () => {
  for (const id of ['iogurte_grego_pote', 'iogurte_natural_pote', 'whey_dose', 'ovo_unidade', 'banana_unidade', 'pao_integral_fatia', 'pasta_amendoim_colher']) {
    assert.ok(extras[id], `${id} ausente`);
  }
});

test('itens vindos da base batem com a base na porcao declarada', () => {
  // Porção em gramas declarada no campo `porcao_g` + alimento de origem em `alimento`.
  const derivados = Object.entries(extras).filter(([, e]) => e.alimento);
  assert.ok(derivados.length >= 7);
  for (const [id, e] of derivados) {
    const base = alimentos[e.alimento];
    assert.ok(base, `${id}: alimento ${e.alimento} nao existe na base`);
    const f = e.porcao_g / 100;
    for (const campo of ['kcal', 'p', 'c', 'g']) {
      assert.ok(Math.abs(e[campo] - base[campo] * f) < 0.6, `${id}.${campo}: ${e[campo]} vs ${(base[campo] * f).toFixed(2)}`);
    }
  }
});

test('todo extra com gordura declarada passa no Atwater', () => {
  for (const [id, e] of Object.entries(extras)) {
    if (!('g' in e)) continue;
    const { ok, desvio } = validarAlimento(e);
    assert.ok(ok, `${id} desvio ${(desvio * 100).toFixed(1)}%`);
  }
});

test('todo extra declara a fonte do numero', () => {
  for (const [id, e] of Object.entries(extras)) assert.ok(e.fonte && e.fonte.length > 10, `${id} sem fonte`);
});
