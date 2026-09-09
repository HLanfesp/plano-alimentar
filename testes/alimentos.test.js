import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { validarAlimento } from '../src/nutricao.js';

const alimentos = JSON.parse(readFileSync('dados/alimentos.json', 'utf8'));
const unidades = JSON.parse(readFileSync('dados/unidades.json', 'utf8'));

const ESPERADOS = [
  'whey','salada_verde','banana','ovo','pao_integral','frango_grelhado',
  'leite_desnatado','mel','arroz_branco','aveia','azeite','legumes_salteados',
  'queijo_minas','batata_doce','pasta_amendoim','feijao','granola','tilapia',
  'goma_tapioca','geleia','iogurte_grego','whey_isolado','queijo_cottage',
  'iogurte_natural','fruta_estacao','torrada_integral','carne_bovina_magra',
  'patinho_moido','flocao_milho','castanha_caju','arroz_integral','brocolis',
  'morango','macarrao_integral','queijo_coalho','maca','atum_agua','mandioca',
  'vagem_cenoura','salmao','cafe','pera','pao_frances','amendoa','lentilha',
  'noz','inhame','couve_refogada','grao_de_bico','rapadura',
  'leite_achocolatado','suco_laranja',
];

test('a base cobre todos os alimentos do plano', () => {
  for (const chave of ESPERADOS) {
    assert.ok(alimentos[chave], `alimento ausente na base: ${chave}`);
  }
});

test('todo alimento tem os campos obrigatorios e fonte declarada', () => {
  for (const [chave, a] of Object.entries(alimentos)) {
    for (const campo of ['nome', 'kcal', 'p', 'c', 'g', 'fonte']) {
      assert.ok(campo in a, `${chave} sem o campo ${campo}`);
    }
    assert.ok(a.fonte.length > 0, `${chave} com fonte vazia`);
    for (const campo of ['kcal', 'p', 'c', 'g']) {
      assert.ok(a[campo] >= 0, `${chave}.${campo} negativo`);
    }
  }
});

test('kcal bate com os macros pela formula de Atwater', () => {
  const ruins = [];
  for (const [chave, a] of Object.entries(alimentos)) {
    const { ok, desvio } = validarAlimento(a);
    if (!ok) ruins.push(`${chave}: desvio ${(desvio * 100).toFixed(1)}%`);
  }
  assert.deepStrictEqual(ruins, [], `alimentos com kcal inconsistente:\n${ruins.join('\n')}`);
});

test('unidades naturais tem conversao em gramas', () => {
  for (const chave of ['ovo','banana','pao_integral','torrada_integral','maca','pera','cafe','fruta_estacao']) {
    assert.ok(unidades[chave] > 0, `sem conversao de unidade: ${chave}`);
  }
});
