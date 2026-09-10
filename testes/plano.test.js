import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const DIAS = ['seg','ter','qua','qui','sex','sab','dom'];

// Os testes deste arquivo percorrem TODOS os planos registrados em
// dados/indice.json, não um arquivo fixo. Cada mês novo que entrar no
// índice passa a ser validado automaticamente, sem precisar tocar neste
// arquivo. As asserções aqui são estruturais — valem para qualquer mês
// (7 dias, 49 refeições, ingredientes resolvidos, combustível do sábado,
// etc). Valores numéricos específicos de um mês (as metas de kcal de
// setembro, por exemplo) ficam isolados no bloco rotulado no fim do
// arquivo, para não passar a impressão de que valeriam para outro mês.
const indice = JSON.parse(readFileSync('dados/indice.json', 'utf8'));
const alimentos = JSON.parse(readFileSync('dados/alimentos.json', 'utf8'));

for (const { mes, arquivo } of indice.planos) {
  const plano = JSON.parse(readFileSync(arquivo, 'utf8'));

  describe(`plano ${mes}`, () => {
    test(`[${mes}] o plano tem 7 dias`, () => {
      assert.deepStrictEqual(Object.keys(plano.dias).sort(), [...DIAS].sort(), `${mes}: dias incompletos`);
    });

    test(`[${mes}] o plano tem 49 refeicoes e 147 opcoes`, () => {
      let refeicoes = 0, opcoes = 0;
      for (const dia of DIAS) {
        refeicoes += plano.dias[dia].refeicoes.length;
        for (const r of plano.dias[dia].refeicoes) opcoes += r.opcoes.length;
      }
      assert.strictEqual(refeicoes, 49, `${mes}: numero de refeicoes inesperado`);
      assert.strictEqual(opcoes, 147, `${mes}: numero de opcoes inesperado`);
    });

    test(`[${mes}] todo ingrediente resolve na base de alimentos`, () => {
      const orfaos = new Set();
      for (const dia of DIAS) {
        for (const r of plano.dias[dia].refeicoes) {
          if (r.tipo === 'combustivel') continue;
          for (const o of r.opcoes) {
            for (const item of o.itens) {
              if (!alimentos[item.alimento]) orfaos.add(item.alimento);
              assert.ok(item.g > 0, `${mes}: gramagem invalida em ${item.alimento}`);
            }
          }
        }
      }
      assert.deepStrictEqual([...orfaos], [], `${mes}: ingredientes sem entrada na base: ${[...orfaos]}`);
    });

    test(`[${mes}] quarta e sexta tem pre-natacao obrigatorio`, () => {
      for (const dia of ['qua','sex']) {
        const r = plano.dias[dia].refeicoes.find(x => x.nome.includes('Pré-natação'));
        assert.ok(r, `${mes} ${dia}: sem pre-natacao`);
        assert.strictEqual(r.obrigatorio, true, `${mes} ${dia}: pre-natacao deveria ser obrigatoria`);
      }
    });

    test(`[${mes}] o lanche das 10h e opcional`, () => {
      const r = plano.dias.seg.refeicoes.find(x => x.nome.includes('Lanche da manhã'));
      assert.strictEqual(r.opcional, true, `${mes}: lanche da manha deveria ser opcional`);
    });

    test(`[${mes}] sabado tem a linha de combustivel, sem kcal`, () => {
      const r = plano.dias.sab.refeicoes.find(x => x.tipo === 'combustivel');
      assert.ok(r, `${mes}: sabado sem linha de combustivel`);
      assert.strictEqual(r.opcoes[0].kcal_plano, null, `${mes}: combustivel do sabado deveria ter kcal_plano nulo`);
    });

    // O plano usa "⚠️" como marca de obrigatoriedade e a linha do sábado traz o
    // símbolo sozinho, sem a palavra. O extrator precisa enxergar isso — era
    // por aqui que a interface acabava inventando a etiqueta.
    test(`[${mes}] o combustivel do sabado e obrigatorio no dado, nao na interface`, () => {
      const r = plano.dias.sab.refeicoes.find(x => x.tipo === 'combustivel');
      assert.strictEqual(r.obrigatorio, true, `${mes}: combustivel do sabado deveria ser obrigatorio`);
    });

    // A versão anterior deste teste nunca executava o assert: o corpo ficava
    // dentro de `if (r.tipo === 'combustivel' && dia !== 'sab')` e só o sábado
    // tem refeição de combustível, então a condição era sempre falsa. Um teste
    // que não pode falhar não é portão. Agora conta as refeições de
    // combustível do plano inteiro e afirma o que o plano diz: existe
    // exatamente uma, no sábado, obrigatória.
    test(`[${mes}] existe exatamente uma refeicao de combustivel, no sabado, obrigatoria`, () => {
      const achadas = [];
      for (const dia of DIAS) {
        for (const r of plano.dias[dia].refeicoes) {
          if (r.tipo === 'combustivel') achadas.push({ dia, obrigatorio: r.obrigatorio });
        }
      }
      assert.strictEqual(achadas.length, 1,
        `${mes}: esperava 1 refeicao de combustivel, achei ${achadas.length} (${achadas.map(a => a.dia).join(', ')})`);
      assert.strictEqual(achadas[0].dia, 'sab', `${mes}: combustivel caiu em ${achadas[0].dia}, nao no sabado`);
      assert.strictEqual(achadas[0].obrigatorio, true, `${mes}: o combustivel do sabado nao esta obrigatorio`);
    });
  });
}

// Valores fixos de setembro/2026 — dados daquele mês, não critério geral.
// Não generalize estas asserções para outros meses: elas existem para
// provar que o plano de setembro foi extraído com os números certos.
describe('valores fixos de setembro/2026 (nao generalizar para outros meses)', () => {
  const planoSetembro = JSON.parse(readFileSync('dados/plano-2026-09.json', 'utf8'));

  test('as metas por dia batem com o plano impresso de setembro', () => {
    assert.strictEqual(planoSetembro.dias.seg.meta.kcal, 2507);
    assert.strictEqual(planoSetembro.dias.seg.meta.p, 203);
    assert.strictEqual(planoSetembro.dias.sab.meta.kcal, 2952);
    assert.strictEqual(planoSetembro.dias.sab.meta.p, 218);
    assert.strictEqual(planoSetembro.dias.dom.meta.kcal, 2671);
  });
});
