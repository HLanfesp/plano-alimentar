import { test } from 'node:test';
import assert from 'node:assert';
import { chaveIngrediente, estadoDa } from '../src/nutricao.js';

// Duas opções de três e de dois itens, mais uma linha crua sem `alimento`
// (o formato do "Durante o pedal"), que não deve contar para nada.
const refeicao = {
  id: 'almoco',
  nome: 'Almoço',
  opcoes: [
    { letra: 'A', itens: [{ alimento: 'frango_grelhado', g: 180 }, { alimento: 'arroz_branco', g: 200 }, { alimento: 'brocolis', g: 100 }] },
    { letra: 'B', itens: [{ alimento: 'tilapia', g: 200 }, { alimento: 'batata_doce', g: 250 }] },
    { letra: 'C', itens: [{ raw: '1 gel Z2/h + 1 Saltz/h' }] },
  ],
};

const chaves = (...pares) => new Set(pares.map(([l, a]) => chaveIngrediente('almoco', l, a)));

test('a chave segue o formato refeicao:letra:alimento da spec', () => {
  assert.strictEqual(chaveIngrediente('almoco', 'A', 'frango_grelhado'), 'almoco:A:frango_grelhado');
});

test('nada marcado e refeicao vazia', () => {
  assert.strictEqual(estadoDa(refeicao, new Set()), 'vazia');
});

test('marcas de outra refeicao nao contaminam esta', () => {
  assert.strictEqual(estadoDa(refeicao, new Set(['jantar:A:frango_grelhado'])), 'vazia');
});

test('parte de uma opcao e parcial', () => {
  assert.strictEqual(estadoDa(refeicao, chaves(['A', 'frango_grelhado'])), 'parcial');
});

test('itens de A e de B sem fechar nenhuma opcao continua parcial', () => {
  const m = chaves(['A', 'frango_grelhado'], ['A', 'arroz_branco'], ['B', 'tilapia']);
  assert.strictEqual(estadoDa(refeicao, m), 'parcial');
});

test('uma opcao inteira marcada e completa', () => {
  const m = chaves(['B', 'tilapia'], ['B', 'batata_doce']);
  assert.strictEqual(estadoDa(refeicao, m), 'completa');
});

test('opcao inteira mais sobras de outra continua completa', () => {
  const m = chaves(['B', 'tilapia'], ['B', 'batata_doce'], ['A', 'brocolis']);
  assert.strictEqual(estadoDa(refeicao, m), 'completa');
});

test('opcao so de linhas cruas nunca fecha a refeicao', () => {
  const soCru = { id: 'pedal', opcoes: [{ letra: 'A', itens: [{ raw: '1 gel' }] }] };
  assert.strictEqual(estadoDa(soCru, new Set([chaveIngrediente('pedal', 'A', undefined)])), 'vazia');
});
