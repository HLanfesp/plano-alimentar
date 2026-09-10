import { test } from 'node:test';
import assert from 'node:assert';
import { escolherPlano } from '../src/indice.js';

test('com um unico plano no indice, usa ele', () => {
  const indice = { planos: [{ mes: '2026-09', arquivo: 'dados/plano-2026-09.json' }] };
  assert.deepStrictEqual(
    escolherPlano(indice, '2026-09-09'),
    { mes: '2026-09', arquivo: 'dados/plano-2026-09.json' },
  );
});

test('com varios meses, usa o mais recente que nao seja futuro', () => {
  const indice = {
    planos: [
      { mes: '2026-09', arquivo: 'dados/plano-2026-09.json' },
      { mes: '2026-10', arquivo: 'dados/plano-2026-10.json' },
      { mes: '2026-08', arquivo: 'dados/plano-2026-08.json' },
    ],
  };
  // hoje ainda em setembro: outubro e futuro, nao pode ser escolhido.
  assert.deepStrictEqual(
    escolherPlano(indice, '2026-09-09'),
    { mes: '2026-09', arquivo: 'dados/plano-2026-09.json' },
  );
});

test('a virada de mes troca o plano sozinha, sem editar codigo', () => {
  const indice = {
    planos: [
      { mes: '2026-09', arquivo: 'dados/plano-2026-09.json' },
      { mes: '2026-10', arquivo: 'dados/plano-2026-10.json' },
    ],
  };
  assert.deepStrictEqual(
    escolherPlano(indice, '2026-10-01'),
    { mes: '2026-10', arquivo: 'dados/plano-2026-10.json' },
  );
});

test('se todos os planos do indice forem futuros, cai para o mais antigo', () => {
  const indice = {
    planos: [
      { mes: '2026-11', arquivo: 'dados/plano-2026-11.json' },
      { mes: '2026-12', arquivo: 'dados/plano-2026-12.json' },
    ],
  };
  assert.deepStrictEqual(
    escolherPlano(indice, '2026-09-09'),
    { mes: '2026-11', arquivo: 'dados/plano-2026-11.json' },
  );
});

test('indice sem planos devolve null, nunca lanca', () => {
  assert.strictEqual(escolherPlano({ planos: [] }, '2026-09-09'), null);
  assert.strictEqual(escolherPlano(null, '2026-09-09'), null);
});
