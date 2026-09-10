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

test('decrementar extra reduz a quantidade', () => {
  const a = criarArmazenamento(storageFalso());
  a.addExtra('2026-09-10', 'pao_de_queijo');
  a.addExtra('2026-09-10', 'pao_de_queijo');
  a.removerExtra('2026-09-10', 'pao_de_queijo');
  assert.deepStrictEqual(a.lerDia('2026-09-10').extras, [{ id: 'pao_de_queijo', qtd: 1 }]);
});

test('extra em quantidade 1 desaparece da lista ao decrementar', () => {
  const a = criarArmazenamento(storageFalso());
  a.addExtra('2026-09-10', 'pao_de_queijo');
  a.removerExtra('2026-09-10', 'pao_de_queijo');
  assert.deepStrictEqual(a.lerDia('2026-09-10').extras, []);
});

test('decrementar extra inexistente nao cria linha negativa', () => {
  const a = criarArmazenamento(storageFalso());
  a.removerExtra('2026-09-10', 'pao_de_queijo');
  assert.deepStrictEqual(a.lerDia('2026-09-10').extras, []);
});

test('decrementar combustivel reduz e remove a linha no zero', () => {
  const a = criarArmazenamento(storageFalso());
  a.addCombustivel('2026-09-12', 'hora_pedal');
  a.addCombustivel('2026-09-12', 'hora_pedal');
  a.removerCombustivel('2026-09-12', 'hora_pedal');
  assert.deepStrictEqual(a.lerDia('2026-09-12').combustivel, [{ id: 'hora_pedal', qtd: 1 }]);
  a.removerCombustivel('2026-09-12', 'hora_pedal');
  assert.deepStrictEqual(a.lerDia('2026-09-12').combustivel, []);
});

test('decrementar so mexe no item pedido', () => {
  const a = criarArmazenamento(storageFalso());
  a.addCombustivel('2026-09-12', 'hora_pedal');
  a.addCombustivel('2026-09-12', 'gel_z2');
  a.removerCombustivel('2026-09-12', 'hora_pedal');
  assert.deepStrictEqual(a.lerDia('2026-09-12').combustivel, [{ id: 'gel_z2', qtd: 1 }]);
});

// Safari em navegação privada lança em setItem. O app não pode engolir isso.
function storageQueLancaNoSet() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: () => { throw new DOMException('QuotaExceededError'); },
    key: i => [...m.keys()][i],
    get length() { return m.size; },
  };
}

test('storage que lanca em setItem nao derruba o app e avisa quem chamou', () => {
  const avisos = [];
  const a = criarArmazenamento(storageQueLancaNoSet(), (erro, operacao) => avisos.push(operacao));
  let ok;
  assert.doesNotThrow(() => { ok = a.marcar('2026-09-10', 'almoco:A:frango_grelhado'); });
  assert.strictEqual(ok, false, 'marcar deve relatar que nao gravou');
  assert.deepStrictEqual(avisos, ['gravar']);
  assert.deepStrictEqual(a.lerDia('2026-09-10').marcados, [], 'nada foi persistido');
});

test('todas as escritas relatam falha quando o storage lanca', () => {
  const avisos = [];
  const a = criarArmazenamento(storageQueLancaNoSet(), (_e, op) => avisos.push(op));
  assert.strictEqual(a.desmarcar('2026-09-10', 'x'), false);
  assert.strictEqual(a.addExtra('2026-09-10', 'pao_de_queijo'), false);
  assert.strictEqual(a.removerExtra('2026-09-10', 'pao_de_queijo'), false);
  assert.strictEqual(a.addCombustivel('2026-09-10', 'hora_pedal'), false);
  assert.strictEqual(a.removerCombustivel('2026-09-10', 'hora_pedal'), false);
  assert.strictEqual(a.definirPerfil('2026-09-10', 'ter'), false);
  assert.strictEqual(avisos.length, 6);
});

test('storage que lanca em getItem devolve dia vazio e avisa', () => {
  const avisos = [];
  const a = criarArmazenamento({
    getItem: () => { throw new DOMException('SecurityError'); },
    setItem: () => {},
    key: () => null,
    length: 0,
  }, (_e, op) => avisos.push(op));
  assert.deepStrictEqual(a.lerDia('2026-09-10'), { marcados: [], extras: [], combustivel: [], perfil: null });
  assert.deepStrictEqual(avisos, ['ler']);
});

test('uma escrita bem-sucedida nao dispara aviso', () => {
  const avisos = [];
  const a = criarArmazenamento(storageFalso(), (_e, op) => avisos.push(op));
  assert.strictEqual(a.marcar('2026-09-10', 'ceia:A:whey_isolado'), true);
  assert.deepStrictEqual(avisos, []);
});
