import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { expandirPorData, perfilDoCalendario, chaveDaData } from '../src/porData.js';
import { resumoSemana } from '../src/semana.js';

const ler = f => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url)));
const alimentos = ler('dados/alimentos.json');
const indice = ler('dados/indice.json');

test('expandirPorData coloca a data especial em dias com a chave @AAAA-MM-DD, sem mutar o original', () => {
  const plano = { dias: { sab: { meta: { kcal: 1 } } }, porData: { '2026-11-28': { meta: { kcal: 2 } } } };
  const ex = expandirPorData(plano);
  assert.strictEqual(ex.dias['@2026-11-28'].meta.kcal, 2);
  assert.strictEqual(plano.dias['@2026-11-28'], undefined);
});

test('plano sem porData passa intacto', () => {
  const plano = { dias: { sab: {} } };
  assert.strictEqual(expandirPorData(plano), plano);
});

test('perfilDoCalendario: data especial vence o dia da semana; sem ela, dia da semana', () => {
  const ex = expandirPorData({ dias: { sab: {} }, porData: { '2026-11-28': {} } });
  assert.strictEqual(perfilDoCalendario(ex, '2026-11-28'), '@2026-11-28');
  assert.strictEqual(perfilDoCalendario(ex, '2026-11-21'), 'sab');
});

test('resumo: dia sem troca é medido contra o cardápio da data; troca gravada continua mandando', () => {
  const dia = kcal => ({ meta: { kcal, p: 0 }, refeicoes: [] });
  const ex = expandirPorData({ dias: { sab: dia(3000) }, porData: { '2026-11-28': dia(2000) } });
  const r = resumoSemana({ '2026-11-28': { marcados: [] }, '2026-11-21': { marcados: [], perfil: null } }, ex, alimentos);
  assert.strictEqual(r.perfisUsados['2026-11-28'], '@2026-11-28');
  assert.strictEqual(r.perfisUsados['2026-11-21'], 'sab');
  const r2 = resumoSemana({ '2026-11-28': { marcados: [], perfil: 'sab' } }, ex, alimentos);
  assert.strictEqual(r2.perfisUsados['2026-11-28'], 'sab');
});

for (const { mes, arquivo } of indice.planos) {
  const plano = ler(arquivo);
  if (!plano.porData) continue;

  test(`[${mes}] porData: cada data é do próprio mês e tem rótulo, meta e refeições`, () => {
    for (const [iso, d] of Object.entries(plano.porData)) {
      assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
      assert.strictEqual(iso.slice(0, 7), mes, `${iso} fora do mês ${mes}`);
      assert.ok(d.rotulo && d.meta && d.meta.kcal > 0 && d.meta.p > 0, `${iso}: rótulo/meta`);
      assert.ok(Array.isArray(d.refeicoes) && d.refeicoes.length > 0, `${iso}: sem refeições`);
      assert.ok(d.refeicoes.find(r => r.id === 'ceia'), `${iso}: sem ceia`);
    }
  });

  test(`[${mes}] porData: todo ingrediente resolve e kcal_plano bate com a base`, () => {
    for (const [iso, d] of Object.entries(plano.porData)) {
      for (const r of d.refeicoes) {
        if (r.tipo === 'combustivel') {
          assert.strictEqual(r.opcoes[0].kcal_plano, null, `${iso}: combustível com kcal`);
          continue;
        }
        for (const o of r.opcoes) {
          let kcal = 0;
          for (const i of o.itens) {
            assert.ok(alimentos[i.alimento], `${iso}: ${i.alimento} sem entrada na base`);
            assert.ok(i.g > 0);
            kcal += alimentos[i.alimento].kcal * i.g / 100;
          }
          assert.ok(Math.abs(kcal - o.kcal_plano) <= Math.max(15, 0.03 * kcal),
            `${iso} ${r.id} ${o.letra}: kcal_plano ${o.kcal_plano} vs ${Math.round(kcal)}`);
        }
      }
    }
  });

  test(`[${mes}] porData: chave expandida não colide com os dias da semana`, () => {
    const ex = expandirPorData(plano);
    for (const iso of Object.keys(plano.porData)) assert.ok(ex.dias[chaveDaData(iso)]);
    assert.deepStrictEqual(Object.keys(plano.dias).sort(), ['dom', 'qua', 'qui', 'sab', 'seg', 'sex', 'ter']);
  });
}
