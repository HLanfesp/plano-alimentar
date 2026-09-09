import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcularItens } from '../src/nutricao.js';

const plano = JSON.parse(readFileSync('dados/plano-2026-09.json', 'utf8'));
const alimentos = JSON.parse(readFileSync('dados/alimentos.json', 'utf8'));

function todasAsOpcoes() {
  const saida = [];
  for (const [dia, d] of Object.entries(plano.dias)) {
    for (const r of d.refeicoes) {
      if (r.tipo === 'combustivel') continue;
      for (const o of r.opcoes) saida.push({ dia, refeicao: r.nome, letra: o.letra, o });
    }
  }
  return saida;
}

test('nenhuma opcao diverge mais de 8% do kcal impresso no plano', () => {
  const fora = [];
  for (const { dia, refeicao, letra, o } of todasAsOpcoes()) {
    const calc = calcularItens(o.itens, alimentos);
    const desvio = Math.abs(calc.kcal - o.kcal_plano) / o.kcal_plano;
    if (desvio > 0.08) {
      fora.push(`${dia} ${refeicao} ${letra}: plano ${o.kcal_plano} vs calc ${Math.round(calc.kcal)} (${(desvio*100).toFixed(1)}%)`);
    }
  }
  assert.deepStrictEqual(fora, [], `opcoes fora da faixa:\n${fora.join('\n')}`);
});

test('o desvio medio de kcal fica abaixo de 4%', () => {
  const opcoes = todasAsOpcoes();
  const soma = opcoes.reduce((acc, { o }) => {
    const calc = calcularItens(o.itens, alimentos);
    return acc + Math.abs(calc.kcal - o.kcal_plano) / o.kcal_plano;
  }, 0);
  const medio = soma / opcoes.length;
  assert.ok(medio < 0.04, `desvio medio de ${(medio*100).toFixed(2)}%`);
});

test('o desvio medio de proteina fica abaixo de 8%', () => {
  const opcoes = todasAsOpcoes().filter(({ o }) => o.p_plano >= 5);
  const soma = opcoes.reduce((acc, { o }) => {
    const calc = calcularItens(o.itens, alimentos);
    return acc + Math.abs(calc.p - o.p_plano) / o.p_plano;
  }, 0);
  assert.ok(soma / opcoes.length < 0.08);
});

test('as duas opcoes de referencia da spec batem', () => {
  const almoco = plano.dias.seg.refeicoes.find(r => r.nome.includes('Almoço'));
  const a = calcularItens(almoco.opcoes[0].itens, alimentos);
  assert.ok(Math.abs(a.kcal - 674) / 674 < 0.05, `almoco seg A: ${Math.round(a.kcal)} kcal`);
  assert.ok(a.c > 55 && a.c < 85, `carbo fora do esperado: ${Math.round(a.c)} g`);
});
