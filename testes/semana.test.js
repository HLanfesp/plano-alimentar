import { test } from 'node:test';
import assert from 'node:assert';
import { resumoSemana } from '../src/semana.js';

const alimentos = { banana: { nome: 'Banana', kcal: 92, p: 1.3, c: 23.8, g: 0.1, fonte: 't' } };
const plano = {
  dias: {
    seg: {
      meta: { kcal: 2507, p: 203 },
      refeicoes: [
        { id: 'pre', nome: 'Pré-treino', opcoes: [{ letra: 'A', itens: [{ alimento: 'banana', g: 100 }] }] },
        { id: 'ceia', nome: 'Ceia', opcoes: [{ letra: 'A', itens: [{ alimento: 'banana', g: 100 }] }] },
      ],
    },
  },
};

test('semana sem registro tem aderencia zero, nao erro', () => {
  const r = resumoSemana({}, plano, alimentos);
  assert.strictEqual(r.aderencia, 0);
  assert.strictEqual(r.mediaKcal, 0);
});

test('metade das refeicoes registradas da 50% de aderencia', () => {
  const dias = { '2026-09-07': { marcados: ['pre:A:banana'], extras: [], combustivel: [], perfil: null } };
  assert.strictEqual(resumoSemana(dias, plano, alimentos).aderencia, 50);
});

test('identifica a refeicao mais pulada', () => {
  const dias = { '2026-09-07': { marcados: ['ceia:A:banana'], extras: [], combustivel: [], perfil: null } };
  assert.strictEqual(resumoSemana(dias, plano, alimentos).refeicoesMaisPuladas[0].nome, 'Pré-treino');
});

test('o perfil trocado manda sobre o dia do calendario', () => {
  const dias = { '2026-09-09': { marcados: [], extras: [], combustivel: [], perfil: 'seg' } };
  const r = resumoSemana(dias, plano, alimentos);
  assert.strictEqual(r.perfisUsados['2026-09-09'], 'seg');
});
