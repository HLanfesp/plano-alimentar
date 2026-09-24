import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { chaveIngrediente, estadoDa, alvoDaRefeicao, LIMIAR_REFEICAO } from '../src/nutricao.js';

const alimentos = JSON.parse(readFileSync('dados/alimentos.json', 'utf8'));

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

test('sem a base de alimentos, misturar opcoes nao fecha a refeicao (regra antiga)', () => {
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

// ---------------------------------------------------------------------------
// Regra de 24/Set/2026: refeição completa pelos valores.
// O atleta mistura ingredientes de opções diferentes da mesma refeição. Com a
// regra antiga ("todos os itens de UMA opção"), 48 de 110 refeições dos 16
// primeiros dias apareciam parciais — várias com 105–146% do previsto. Agora a
// refeição também fecha quando o consumido bate ≥90% das kcal E ≥90% da
// proteína do alvo da refeição (média das opções), o mesmo corte que deixa a
// barra do dia verde. Números abaixo calculados com a base real.
// ---------------------------------------------------------------------------

test('o limiar da refeicao e 90%, o mesmo corte verde da barra do dia', () => {
  assert.strictEqual(LIMIAR_REFEICAO, 0.9);
});

test('o alvo da refeicao e a media das opcoes que tem alimento resolvivel', () => {
  // A = 578 kcal / 62,9 g P; B = 449 kcal / 53,5 g P; C e linha crua e fica fora.
  const alvo = alvoDaRefeicao(refeicao, alimentos);
  assert.ok(Math.abs(alvo.kcal - 513.5) < 2, `kcal ${alvo.kcal}`);
  assert.ok(Math.abs(alvo.p - 58.2) < 0.5, `p ${alvo.p}`);
});

test('misturar A e B batendo kcal e proteina fecha a refeicao', () => {
  // frango (A) + batata-doce (B) = 490 kcal (95%) e 57,3 g P (98%)
  const m = chaves(['A', 'frango_grelhado'], ['B', 'batata_doce']);
  assert.strictEqual(estadoDa(refeicao, m, alimentos), 'completa');
});

test('outra mistura valida de A e B tambem fecha', () => {
  // tilapia (B) + arroz (A) = 512 kcal (99,7%) e 57 g P (98%)
  const m = chaves(['B', 'tilapia'], ['A', 'arroz_branco']);
  assert.strictEqual(estadoDa(refeicao, m, alimentos), 'completa');
});

test('proteina batida mas kcal curta continua parcial', () => {
  // so o frango: 297 kcal (58%) apesar de 55,8 g P (96%)
  assert.strictEqual(estadoDa(refeicao, chaves(['A', 'frango_grelhado']), alimentos), 'parcial');
});

test('kcal batida mas proteina curta continua parcial', () => {
  // arroz (A) + brocolis (A) + batata-doce (B): ~474 kcal (92%) mas ~8,6 g P (15%)
  const m = chaves(['A', 'arroz_branco'], ['A', 'brocolis'], ['B', 'batata_doce']);
  assert.strictEqual(estadoDa(refeicao, m, alimentos), 'parcial');
});

test('uma opcao inteira continua completa mesmo abaixo da media das opcoes', () => {
  // B inteira = 449 kcal, 87% da media (513,5): o que o plano prescreve nunca vira parcial
  const m = chaves(['B', 'tilapia'], ['B', 'batata_doce']);
  assert.strictEqual(estadoDa(refeicao, m, alimentos), 'completa');
});

test('refeicao de carbo (alvo de proteina < 5 g) fecha so pelas kcal', () => {
  // Pre-treino: exigir 90% de proteina onde o alvo e ~0,8 g deixaria qualquer
  // mistura de carbo "parcial" por decimos de grama.
  const pre = {
    id: 'pre_treino',
    nome: 'Pré-treino',
    opcoes: [
      { letra: 'A', itens: [{ alimento: 'banana', g: 100 }, { alimento: 'mel', g: 10 }] },
      { letra: 'B', itens: [{ alimento: 'goma_tapioca', g: 35 }, { alimento: 'geleia', g: 20 }] },
    ],
  };
  const m = new Set([chaveIngrediente('pre_treino', 'B', 'goma_tapioca'), chaveIngrediente('pre_treino', 'A', 'mel')]);
  assert.strictEqual(estadoDa(pre, m, alimentos), 'completa');
});

test('refeicao de carbo com kcal curta continua parcial', () => {
  const pre = {
    id: 'pre_treino',
    nome: 'Pré-treino',
    opcoes: [
      { letra: 'A', itens: [{ alimento: 'banana', g: 100 }, { alimento: 'mel', g: 10 }] },
      { letra: 'B', itens: [{ alimento: 'goma_tapioca', g: 35 }, { alimento: 'geleia', g: 20 }] },
    ],
  };
  // so o mel (A): ~31 kcal, ~21% do alvo
  assert.strictEqual(estadoDa(pre, new Set([chaveIngrediente('pre_treino', 'A', 'mel')]), alimentos), 'parcial');
});

test('nada marcado continua vazia com a base de alimentos', () => {
  assert.strictEqual(estadoDa(refeicao, new Set(), alimentos), 'vazia');
});
