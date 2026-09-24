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

// Esta é a regra mais central do produto: o atleta pode comer o frango da
// opção A com o arroz da opção B, e as duas marcações têm que coexistir na
// mesma refeição. Contar `length === 2` não provava isso — duas gravações da
// MESMA chave, ou uma chave sobrescrevendo a outra, passariam igual. O teste
// agora exige as duas chaves distintas, nomeadas.
test('ingredientes de opcoes diferentes convivem na mesma refeicao', () => {
  const a = criarArmazenamento(storageFalso());
  a.marcar('2026-09-10', 'almoco:A:frango_grelhado');
  a.marcar('2026-09-10', 'almoco:B:arroz_branco');
  const marcados = a.lerDia('2026-09-10').marcados;
  assert.deepStrictEqual([...marcados].sort(),
    ['almoco:A:frango_grelhado', 'almoco:B:arroz_branco']);
  assert.strictEqual(new Set(marcados).size, 2, 'as duas chaves tem que ser distintas');
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

// ---------------------------------------------------------------------------
// Importar backup (24/Set/2026). O app exportava mas não sabia importar: o
// JSON de backup não tinha como voltar para dentro. Regra de ouro: importar
// NUNCA sobrescreve um dia que já existe no aparelho — só acrescenta os que
// faltam. Um backup antigo jamais apaga registro mais novo.
// ---------------------------------------------------------------------------

const backup = {
  versao: 1,
  geradoEm: '2026-09-24T21:20:20.968Z',
  dias: {
    '2026-09-10': { marcados: ['ceia:A:whey_isolado'], extras: [{ id: 'pao_de_queijo', qtd: 2 }], combustivel: [], perfil: null },
    '2026-09-12': { marcados: ['almoco:A:arroz_branco'], extras: [], combustivel: [{ id: 'hora_pedal', qtd: 2 }], perfil: null },
  },
};

test('importar restaura os dias que faltam no aparelho', () => {
  const a = criarArmazenamento(storageFalso());
  const r = a.importar(backup);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.restaurados, 2);
  assert.deepStrictEqual(a.lerDia('2026-09-10'), backup.dias['2026-09-10']);
  assert.deepStrictEqual(a.lerDia('2026-09-12').combustivel, [{ id: 'hora_pedal', qtd: 2 }]);
});

test('importar NUNCA sobrescreve um dia que ja existe no aparelho', () => {
  const a = criarArmazenamento(storageFalso());
  a.marcar('2026-09-10', 'almoco:B:tilapia'); // registro mais novo, feito no aparelho
  const r = a.importar(backup);
  assert.strictEqual(r.mantidos, 1);
  assert.strictEqual(r.restaurados, 1);
  assert.deepStrictEqual(a.lerDia('2026-09-10').marcados, ['almoco:B:tilapia']);
});

test('importar o mesmo backup duas vezes nao duplica nada', () => {
  const a = criarArmazenamento(storageFalso());
  a.importar(backup);
  const r = a.importar(backup);
  assert.strictEqual(r.restaurados, 0);
  assert.strictEqual(r.mantidos, 2);
  assert.deepStrictEqual(a.lerDia('2026-09-10').extras, [{ id: 'pao_de_queijo', qtd: 2 }]);
});

test('exportar e importar em outro aparelho reproduz os mesmos dias', () => {
  const origem = criarArmazenamento(storageFalso());
  origem.marcar('2026-09-15', 'almoco:A:feijao');
  origem.addExtra('2026-09-15', 'pao_de_queijo');
  origem.definirPerfil('2026-09-16', 'ter');
  const destino = criarArmazenamento(storageFalso());
  destino.importar(origem.exportar());
  assert.deepStrictEqual(destino.exportar().dias, origem.exportar().dias);
});

test('arquivo que nao e backup e recusado sem gravar nada', () => {
  for (const ruim of [null, 'texto', 42, {}, { dias: 'x' }, { dias: [] }]) {
    const s = storageFalso();
    const a = criarArmazenamento(s);
    const r = a.importar(ruim);
    assert.strictEqual(r.ok, false, `aceitou ${JSON.stringify(ruim)}`);
    assert.ok(r.erro && r.erro.length > 0);
    assert.strictEqual(s.length, 0);
  }
});

test('data invalida no backup e ignorada e contada, sem derrubar o resto', () => {
  const a = criarArmazenamento(storageFalso());
  const r = a.importar({ dias: { 'lixo': { marcados: [] }, '2026-13-40': { marcados: [] }, '2026-09-10': backup.dias['2026-09-10'] } });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.restaurados, 1);
  assert.strictEqual(r.invalidos, 2);
});

test('registro incompleto no backup ganha os campos que faltam', () => {
  const a = criarArmazenamento(storageFalso());
  a.importar({ dias: { '2026-09-10': { marcados: ['ceia:A:whey_isolado'] } } });
  assert.deepStrictEqual(a.lerDia('2026-09-10'), { marcados: ['ceia:A:whey_isolado'], extras: [], combustivel: [], perfil: null });
});

test('falha de gravacao durante o import e relatada, nao escondida', () => {
  const s = storageFalso();
  s.setItem = () => { throw new Error('QuotaExceededError'); };
  let avisos = 0;
  const a = criarArmazenamento(s, () => { avisos += 1; });
  const r = a.importar(backup);
  assert.strictEqual(r.restaurados, 0);
  assert.strictEqual(r.falhas, 2);
  assert.ok(avisos > 0);
});
