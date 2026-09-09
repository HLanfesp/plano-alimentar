import { test } from 'node:test';
import assert from 'node:assert';
import { criarArmazenamento } from '../src/armazenamento.js';

function storageFalso() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    key: i => [...m.keys()][i],
    get length() { return m.size; },
  };
}

test('dia sem registro volta vazio, nunca nulo', () => {
  const a = criarArmazenamento(storageFalso());
  assert.deepStrictEqual(a.lerDia('2026-09-10'), { marcados: [], extras: [], combustivel: [], perfil: null });
});

test('marcar e desmarcar um ingrediente', () => {
  const a = criarArmazenamento(storageFalso());
  a.marcar('2026-09-10', 'almoco:A:frango_grelhado');
  assert.deepStrictEqual(a.lerDia('2026-09-10').marcados, ['almoco:A:frango_grelhado']);
  a.desmarcar('2026-09-10', 'almoco:A:frango_grelhado');
  assert.deepStrictEqual(a.lerDia('2026-09-10').marcados, []);
});

test('marcar duas vezes nao duplica', () => {
  const a = criarArmazenamento(storageFalso());
  a.marcar('2026-09-10', 'ceia:A:whey_isolado');
  a.marcar('2026-09-10', 'ceia:A:whey_isolado');
  assert.strictEqual(a.lerDia('2026-09-10').marcados.length, 1);
});

test('ingredientes de opcoes diferentes convivem na mesma refeicao', () => {
  const a = criarArmazenamento(storageFalso());
  a.marcar('2026-09-10', 'almoco:A:frango_grelhado');
  a.marcar('2026-09-10', 'almoco:B:arroz_branco');
  assert.strictEqual(a.lerDia('2026-09-10').marcados.length, 2);
});

test('dias sao independentes', () => {
  const a = criarArmazenamento(storageFalso());
  a.marcar('2026-09-10', 'ceia:A:whey_isolado');
  assert.deepStrictEqual(a.lerDia('2026-09-11').marcados, []);
});

test('extras acumulam quantidade em vez de duplicar linha', () => {
  const a = criarArmazenamento(storageFalso());
  a.addExtra('2026-09-10', 'pao_de_queijo');
  a.addExtra('2026-09-10', 'pao_de_queijo');
  assert.deepStrictEqual(a.lerDia('2026-09-10').extras, [{ id: 'pao_de_queijo', qtd: 2 }]);
});

test('combustivel acumula por hora', () => {
  const a = criarArmazenamento(storageFalso());
  a.addCombustivel('2026-09-12', 'hora_pedal');
  a.addCombustivel('2026-09-12', 'hora_pedal');
  assert.deepStrictEqual(a.lerDia('2026-09-12').combustivel, [{ id: 'hora_pedal', qtd: 2 }]);
});

test('perfil do dia pode ser trocado', () => {
  const a = criarArmazenamento(storageFalso());
  a.definirPerfil('2026-09-10', 'ter');
  assert.strictEqual(a.lerDia('2026-09-10').perfil, 'ter');
});

test('exportar devolve todos os dias com registro', () => {
  const a = criarArmazenamento(storageFalso());
  a.marcar('2026-09-10', 'ceia:A:whey_isolado');
  a.marcar('2026-09-11', 'ceia:B:queijo_cottage');
  const dump = a.exportar();
  assert.deepStrictEqual(Object.keys(dump.dias).sort(), ['2026-09-10', '2026-09-11']);
});
