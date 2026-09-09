# App do Plano Alimentar — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um PWA offline em que o atleta toca nos ingredientes que comeu e vê na hora onde está em relação à meta de kcal, proteína e carboidrato do dia.

**Architecture:** Dados em dois JSON (base nutricional + plano do mês) gerados por um extrator Python a partir do HTML do plano. Lógica pura em módulos ES separados da UI, testados por linha de comando com `node --test`. `index.html` é a única camada de apresentação. Sem framework, sem build, sem backend.

**Tech Stack:** HTML/CSS/JavaScript (ES modules), Python 3.13 (só no extrator, fora do runtime), `node:test` (embutido, zero dependências), localStorage, service worker, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-09-plano-alimentar-app-design.md`

## Global Constraints

- **Zero digitação pelo usuário.** Nenhum campo de texto ou número em nenhum fluxo. Toda entrada é toque. Esta é a restrição de projeto declarada; viola-la é rejeitar a tarefa.
- **Zero dependências de runtime.** Nada de npm no que é servido. `node:test` é built-in e só roda em desenvolvimento.
- **Zero build.** O que está no repositório é o que o navegador executa.
- **Nunca inventar valor nutricional.** Todo número vem da TACO, de rótulo conferido, ou é derivado do próprio plano — e a origem fica declarada no campo `fonte`.
- **Alerta assimétrico.** Acima da meta é verde. Abaixo é que alerta. Nunca o contrário.
- **Idioma:** todo texto de interface, nome de arquivo e mensagem de commit em português.
- **Cor primária:** `#22c55e` sobre fundo claro.
- **Alvo:** Safari iOS, em modo standalone (tela de início).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `dados/alimentos.json` | 51 alimentos, macro por 100 g, com campo de fonte |
| `dados/unidades.json` | Conversão de unidade natural para gramas (1 ovo = 50 g) |
| `dados/combustivel.json` | Itens de combustível de treino (§6.3 da spec) |
| `dados/extras.json` | Lista semente de porções prontas (§6.5 da spec) |
| `dados/plano-2026-09.json` | 7 dias × 7 refeições × 3 opções, gerado |
| `ferramentas/extrair-plano.py` | HTML do plano → `plano-YYYY-MM.json` |
| `src/nutricao.js` | Soma de macros de itens marcados |
| `src/metas.js` | Meta de carbo derivada e status do alerta |
| `src/sugestao.js` | Ordenação das opções por aderência à meta |
| `src/armazenamento.js` | localStorage: ler, gravar, exportar |
| `src/semana.js` | Agregação semanal |
| `src/app.js` | Render e eventos — única camada que toca no DOM |
| `index.html` | Casca e estilo |
| `manifest.json`, `sw.js` | PWA |
| `testes/*.test.js` | Testes de lógica pura, rodam com `node --test` |

`src/app.js` é o único arquivo que conhece o DOM. Todo o resto é função pura, testável sem navegador. Essa é a fronteira que torna o TDD possível aqui.

---

### Task 1: Base nutricional e validador de Atwater

**Files:**
- Create: `dados/alimentos.json`
- Create: `dados/unidades.json`
- Create: `src/nutricao.js`
- Test: `testes/alimentos.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `dados/alimentos.json` no formato `{ chave: { nome, kcal, p, c, g, fonte } }`, valores por 100 g. `dados/unidades.json` no formato `{ chave: gramas_por_unidade }`. De `src/nutricao.js`: `validarAlimento(alimento) -> { ok: boolean, desvio: number }`.

Os 51 alimentos a catalogar, medidos do plano (número = ocorrências):

```
whey 27 · salada_verde 25 · banana 23 · ovo 23 · pao_integral 22
frango_grelhado 22 · leite_desnatado 21 · mel 20 · arroz_branco 19
aveia 18 · azeite 15 · legumes_salteados 15 · queijo_minas 12
batata_doce 11 · pasta_amendoim 11 · feijao 10 · granola 10 · tilapia 9
goma_tapioca 7 · geleia 7 · iogurte_grego 7 · whey_isolado 7
queijo_cottage 7 · iogurte_natural 7 · fruta_estacao 7 · torrada_integral 6
carne_bovina_magra 5 · patinho_moido 4 · flocao_milho 3 · castanha_caju 3
arroz_integral 3 · brocolis 3 · morango 3 · macarrao_integral 3
queijo_coalho 2 · maca 2 · atum_agua 2 · mandioca 2 · vagem_cenoura 2
salmao 2 · cafe 1 · pera 1 · pao_frances 1 · amendoa 1 · lentilha 1
noz 1 · inhame 1 · couve_refogada 1 · grao_de_bico 1 · rapadura 1
leite_achocolatado 1 · suco_laranja 1
```

Todos no estado em que são consumidos: arroz cozido, não cru.

- [ ] **Step 1: Escrever o teste que falha**

`testes/alimentos.test.js`:

```javascript
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test testes/alimentos.test.js`
Expected: FAIL — `Cannot find module '../src/nutricao.js'`

- [ ] **Step 3: Escrever o validador**

`src/nutricao.js`:

```javascript
// Atwater: proteína 4 kcal/g, carboidrato 4 kcal/g, gordura 9 kcal/g.
// Tabelas nutricionais têm arredondamento e fibra não contabilizada,
// então 10% de folga é o normal, não frouxidão.
const TOLERANCIA_ATWATER = 0.10;

export function validarAlimento(a) {
  const calculado = a.p * 4 + a.c * 4 + a.g * 9;
  if (calculado === 0 && a.kcal === 0) return { ok: true, desvio: 0 };
  if (calculado === 0) return { ok: false, desvio: 1 };
  const desvio = Math.abs(calculado - a.kcal) / a.kcal;
  return { ok: desvio <= TOLERANCIA_ATWATER, desvio };
}
```

- [ ] **Step 4: Preencher a base**

`dados/alimentos.json`. Valores TACO por 100 g no estado consumido; USDA para industrializados. Exemplos com os formatos exatos exigidos:

```json
{
  "frango_grelhado":  { "nome": "Frango grelhado",  "kcal": 165, "p": 31.0, "c": 0.0,  "g": 3.6,  "fonte": "TACO" },
  "arroz_branco":     { "nome": "Arroz branco",     "kcal": 128, "p": 2.5,  "c": 28.1, "g": 0.2,  "fonte": "TACO (cozido)" },
  "arroz_integral":   { "nome": "Arroz integral",   "kcal": 124, "p": 2.6,  "c": 25.8, "g": 1.0,  "fonte": "TACO (cozido)" },
  "feijao":           { "nome": "Feijão carioca",   "kcal": 76,  "p": 4.8,  "c": 13.6, "g": 0.5,  "fonte": "TACO (cozido)" },
  "ovo":              { "nome": "Ovo de galinha",   "kcal": 143, "p": 13.0, "c": 1.6,  "g": 9.5,  "fonte": "TACO (cozido)" },
  "azeite":           { "nome": "Azeite de oliva",  "kcal": 884, "p": 0.0,  "c": 0.0,  "g": 100.0,"fonte": "TACO" },
  "whey":             { "nome": "Whey concentrado", "kcal": 400, "p": 80.0, "c": 8.0,  "g": 6.0,  "fonte": "Rótulo médio" }
}
```

Regra para os três nomes genéricos do plano, com o representante **declarado no campo `nome`** para o atleta poder contestar:

```json
{
  "fruta_estacao": { "nome": "Fruta da estação (representada por banana)", "kcal": 92, "p": 1.3, "c": 23.8, "g": 0.1, "fonte": "TACO — banana prata, representante declarado" }
}
```

`dados/unidades.json`:

```json
{
  "ovo": 50,
  "banana": 100,
  "pao_integral": 25,
  "torrada_integral": 8,
  "maca": 130,
  "pera": 130,
  "cafe": 50,
  "fruta_estacao": 100,
  "pasta_amendoim_colher_cha": 5,
  "mel_colher_cha": 7
}
```

- [ ] **Step 5: Rodar até passar**

Run: `node --test testes/alimentos.test.js`
Expected: PASS, 4 testes. Se algum alimento estourar Atwater, o valor está errado — corrija o valor, nunca a tolerância.

- [ ] **Step 6: Commit**

```bash
git add dados/alimentos.json dados/unidades.json src/nutricao.js testes/alimentos.test.js
git commit -m "Base nutricional dos 51 alimentos do plano

Valores por 100 g no estado consumido, com fonte declarada por item.
Validador de Atwater rejeita kcal inconsistente com os macros."
```

---

### Task 2: Extrator do plano

**Files:**
- Create: `ferramentas/extrair-plano.py`
- Create: `dados/plano-2026-09.json` (gerado)
- Test: `testes/plano.test.js`

**Interfaces:**
- Consumes: `dados/alimentos.json`, `dados/unidades.json` da Task 1.
- Produces: `dados/plano-2026-09.json` conforme §5.2 da spec. Chave de ingrediente: `refeicaoId:letra:alimento`.

Estrutura medida do HTML de origem, que o extrator deve reproduzir:

- 7 dias, 49 refeições (7 por dia), 147 opções (3 por refeição).
- Os horários e nomes de refeição **variam por dia**: quarta tem "Pré-natação · 16h00 ⚠️ obrigatório" e "Jantar pós-natação · 20h30"; sábado tem "Durante o pedal · a partir de 60 min ⚠️" e almoço às 13h00; domingo começa às 06h00.
- Marcadores: `· opcional` no lanche das 10h; `⚠️ obrigatório` no pré-natação.
- A linha "Durante o pedal" do sábado **não tem kcal** — suas opções são `~50 g carbo/h`. Ela é marcada `tipo: "combustivel"` e não vira refeição comum.
- Ingredientes vêm em `<div class="od">` separados por ` + `. A gramagem está entre parênteses; quando ausente, o número vem antes do nome (`4 ovos`, `2 fatias de pão integral`) e resolve-se por `unidades.json`.
- Cuidado: `Atum em água (drenado) (85 g)` tem **dois** parênteses — vale o último que contenha número.
- `1 c. chá` resolve por `unidades.json`.

- [ ] **Step 1: Escrever o teste que falha**

`testes/plano.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const plano = JSON.parse(readFileSync('dados/plano-2026-09.json', 'utf8'));
const alimentos = JSON.parse(readFileSync('dados/alimentos.json', 'utf8'));
const DIAS = ['seg','ter','qua','qui','sex','sab','dom'];

test('o plano tem 7 dias', () => {
  assert.deepStrictEqual(Object.keys(plano.dias).sort(), [...DIAS].sort());
});

test('o plano tem 49 refeicoes e 147 opcoes', () => {
  let refeicoes = 0, opcoes = 0;
  for (const dia of DIAS) {
    refeicoes += plano.dias[dia].refeicoes.length;
    for (const r of plano.dias[dia].refeicoes) opcoes += r.opcoes.length;
  }
  assert.strictEqual(refeicoes, 49);
  assert.strictEqual(opcoes, 147);
});

test('todo ingrediente resolve na base de alimentos', () => {
  const orfaos = new Set();
  for (const dia of DIAS) {
    for (const r of plano.dias[dia].refeicoes) {
      if (r.tipo === 'combustivel') continue;
      for (const o of r.opcoes) {
        for (const item of o.itens) {
          if (!alimentos[item.alimento]) orfaos.add(item.alimento);
          assert.ok(item.g > 0, `gramagem invalida em ${item.alimento}`);
        }
      }
    }
  }
  assert.deepStrictEqual([...orfaos], [], `ingredientes sem entrada na base: ${[...orfaos]}`);
});

test('as metas por dia batem com o plano impresso', () => {
  assert.strictEqual(plano.dias.seg.meta.kcal, 2507);
  assert.strictEqual(plano.dias.seg.meta.p, 203);
  assert.strictEqual(plano.dias.sab.meta.kcal, 2952);
  assert.strictEqual(plano.dias.sab.meta.p, 218);
  assert.strictEqual(plano.dias.dom.meta.kcal, 2671);
});

test('quarta e sexta tem pre-natacao obrigatorio', () => {
  for (const dia of ['qua','sex']) {
    const r = plano.dias[dia].refeicoes.find(x => x.nome.includes('Pré-natação'));
    assert.ok(r, `${dia} sem pre-natacao`);
    assert.strictEqual(r.obrigatorio, true);
  }
});

test('o lanche das 10h e opcional', () => {
  const r = plano.dias.seg.refeicoes.find(x => x.nome.includes('Lanche da manhã'));
  assert.strictEqual(r.opcional, true);
});

test('sabado tem a linha de combustivel, sem kcal', () => {
  const r = plano.dias.sab.refeicoes.find(x => x.tipo === 'combustivel');
  assert.ok(r, 'sabado sem linha de combustivel');
  assert.strictEqual(r.opcoes[0].kcal_plano, null);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test testes/plano.test.js`
Expected: FAIL — `ENOENT: dados/plano-2026-09.json`

- [ ] **Step 3: Escrever o extrator**

`ferramentas/extrair-plano.py`. Requisitos de comportamento:

- Uso: `python3 ferramentas/extrair-plano.py <html-de-entrada> <json-de-saida>`
- Resolve cada nome de ingrediente contra `alimentos.json` por um dicionário de sinônimos explícito no topo do arquivo (`"fatias de pão integral" -> "pao_integral"`, `"ovos" -> "ovo"`, `"patinho moído" -> "patinho_moido"`).
- **Ao encontrar ingrediente desconhecido, imprime a lista completa e sai com código 1. Nunca adivinha e nunca inventa valor.**
- Preserva `kcal_plano` e `p_plano` de cada opção para a validação da Task 3.
- Marca `opcional`, `obrigatorio` e `tipo: "combustivel"` pelos marcadores textuais.
- Grava `rotulo` quando a unidade natural é mais legível (`"1 banana"` em vez de `"Banana (100 g)"`).

- [ ] **Step 4: Gerar e rodar até passar**

Run:
```bash
python3 ferramentas/extrair-plano.py \
  "/Users/hiallysonlandim/Library/Mobile Documents/com~apple~CloudDocs/01. Hiallyson Landim/07. TREINO_NUTRIÇÃO/2. Planejamento Mensal/09 SETEMBRO/Plano_Alimentar_Setembro_2026.html" \
  dados/plano-2026-09.json
node --test testes/plano.test.js
```
Expected: PASS, 7 testes.

- [ ] **Step 5: Commit**

```bash
git add ferramentas/extrair-plano.py dados/plano-2026-09.json testes/plano.test.js
git commit -m "Extrator do plano: HTML para JSON

147 opcoes, 49 refeicoes, 7 dias. Falha em vez de adivinhar quando
encontra ingrediente fora da base."
```

---

### Task 3: Validação cruzada — o teste que sustenta o projeto

**Files:**
- Modify: `src/nutricao.js`
- Test: `testes/validacao.test.js`

**Interfaces:**
- Consumes: Tasks 1 e 2.
- Produces: `calcularItens(itens, alimentos) -> { kcal, p, c, g }` — a função central do app, usada por toda a UI.

Este é o teste mais importante do repositório. Ele prova que calcular por ingrediente reproduz o plano do nutricionista. Se falhar, tudo o que o app mostra é ficção.

- [ ] **Step 1: Escrever o teste que falha**

`testes/validacao.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcularItens } from '../src/nutricao.js';

const plano = JSON.parse(readFileSync('dados/plano-2026-09.json', 'utf8'));
const alimentos = JSON.parse(readFileSync('dados/alimentos.json', 'utf8'));

function todasAsOpcoes() {
  const saida = [];
  for (const [dia, d] of Object.entries(plano.dias)) {
    for (const r of d.refeicoes) {
      if (r.tipo === 'combustivel') continue;
      for (const o of r.opcoes) saida.push({ dia, refeicao: r.nome, letra: o.letra, o });
    }
  }
  return saida;
}

test('nenhuma opcao diverge mais de 8% do kcal impresso no plano', () => {
  const fora = [];
  for (const { dia, refeicao, letra, o } of todasAsOpcoes()) {
    const calc = calcularItens(o.itens, alimentos);
    const desvio = Math.abs(calc.kcal - o.kcal_plano) / o.kcal_plano;
    if (desvio > 0.08) {
      fora.push(`${dia} ${refeicao} ${letra}: plano ${o.kcal_plano} vs calc ${Math.round(calc.kcal)} (${(desvio*100).toFixed(1)}%)`);
    }
  }
  assert.deepStrictEqual(fora, [], `opcoes fora da faixa:\n${fora.join('\n')}`);
});

test('o desvio medio de kcal fica abaixo de 4%', () => {
  const opcoes = todasAsOpcoes();
  const soma = opcoes.reduce((acc, { o }) => {
    const calc = calcularItens(o.itens, alimentos);
    return acc + Math.abs(calc.kcal - o.kcal_plano) / o.kcal_plano;
  }, 0);
  const medio = soma / opcoes.length;
  assert.ok(medio < 0.04, `desvio medio de ${(medio*100).toFixed(2)}%`);
});

test('o desvio medio de proteina fica abaixo de 8%', () => {
  const opcoes = todasAsOpcoes().filter(({ o }) => o.p_plano >= 5);
  const soma = opcoes.reduce((acc, { o }) => {
    const calc = calcularItens(o.itens, alimentos);
    return acc + Math.abs(calc.p - o.p_plano) / o.p_plano;
  }, 0);
  assert.ok(soma / opcoes.length < 0.08);
});

test('as duas opcoes de referencia da spec batem', () => {
  const almoco = plano.dias.seg.refeicoes.find(r => r.nome.includes('Almoço'));
  const a = calcularItens(almoco.opcoes[0].itens, alimentos);
  assert.ok(Math.abs(a.kcal - 674) / 674 < 0.05, `almoco seg A: ${Math.round(a.kcal)} kcal`);
  assert.ok(a.c > 55 && a.c < 85, `carbo fora do esperado: ${Math.round(a.c)} g`);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test testes/validacao.test.js`
Expected: FAIL — `calcularItens is not a function`

- [ ] **Step 3: Implementar**

Acrescentar a `src/nutricao.js`:

```javascript
export function calcularItens(itens, alimentos) {
  const total = { kcal: 0, p: 0, c: 0, g: 0 };
  for (const item of itens) {
    const a = alimentos[item.alimento];
    if (!a) throw new Error(`alimento desconhecido: ${item.alimento}`);
    const fator = item.g / 100;
    total.kcal += a.kcal * fator;
    total.p    += a.p    * fator;
    total.c    += a.c    * fator;
    total.g    += a.g    * fator;
  }
  return total;
}
```

- [ ] **Step 4: Rodar até passar**

Run: `node --test testes/validacao.test.js`
Expected: PASS, 4 testes.

Se uma opção estourar 8%, o defeito está no valor da base ou na gramagem extraída — corrija o dado, **nunca afrouxe o limite**. Registre no commit quais valores foram corrigidos e por quê.

- [ ] **Step 5: Commit**

```bash
git add src/nutricao.js testes/validacao.test.js
git commit -m "Validacao cruzada: calculo por ingrediente vs plano impresso

As 147 opcoes reproduzem o kcal do plano dentro de 8% individual e 4%
medio. E este teste que sustenta a confianca em tudo que o app mostra."
```

---

### Task 4: Metas, carboidrato derivado e alerta assimétrico

**Files:**
- Create: `src/metas.js`
- Test: `testes/metas.test.js`

**Interfaces:**
- Consumes: `plano.dias[dia].meta` da Task 2.
- Produces: `metaDoDia(metaPlano) -> { kcal, p, c, cDerivado: true }` e `statusMacro(consumido, meta) -> 'verde' | 'amarelo' | 'vermelho'`.

Fórmula da §5.3 da spec, com gordura em 25% das kcal:

```
carbo_alvo = (kcal − p×4 − kcal×0,25) / 4
```

- [ ] **Step 1: Escrever o teste que falha**

`testes/metas.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { metaDoDia, statusMacro } from '../src/metas.js';

test('deriva a meta de carbo da segunda', () => {
  const m = metaDoDia({ kcal: 2507, p: 203 });
  assert.strictEqual(m.c, 267);
  assert.strictEqual(m.cDerivado, true);
});

test('deriva a meta de carbo do sabado', () => {
  assert.strictEqual(metaDoDia({ kcal: 2952, p: 218 }).c, 336);
});

test('kcal e proteina passam intactos, sem derivacao', () => {
  const m = metaDoDia({ kcal: 2749, p: 211 });
  assert.strictEqual(m.kcal, 2749);
  assert.strictEqual(m.p, 211);
});

test('o alerta e assimetrico: acima da meta e verde', () => {
  assert.strictEqual(statusMacro(3300, 2507), 'verde');
  assert.strictEqual(statusMacro(2507, 2507), 'verde');
  assert.strictEqual(statusMacro(2400, 2507), 'verde');
});

test('abaixo de 90% da meta acende amarelo', () => {
  assert.strictEqual(statusMacro(2200, 2507), 'amarelo');
});

test('abaixo de 75% da meta acende vermelho', () => {
  assert.strictEqual(statusMacro(1700, 2507), 'vermelho');
});

test('dia vazio e vermelho, nao um estado especial', () => {
  assert.strictEqual(statusMacro(0, 2507), 'vermelho');
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test testes/metas.test.js`
Expected: FAIL — módulo inexistente

- [ ] **Step 3: Implementar**

`src/metas.js`:

```javascript
// O plano não prescreve carboidrato — só kcal e proteína. A meta de carbo
// é derivada do restante calórico depois da proteína e de uma gordura
// assumida em 25% das kcal, padrão para atleta endurance. O app rotula
// essa meta como derivada para não a confundir com prescrição.
const FRACAO_GORDURA = 0.25;

export function metaDoDia(metaPlano) {
  const gorduraKcal = metaPlano.kcal * FRACAO_GORDURA;
  const c = Math.round((metaPlano.kcal - metaPlano.p * 4 - gorduraKcal) / 4);
  return { kcal: metaPlano.kcal, p: metaPlano.p, c, cDerivado: true };
}

// Assimétrico de propósito. O risco declarado do atleta é déficit, não
// excesso: "O ajuste é para cima, não para baixo." Passar da meta não é
// falha, é dia de treino grande.
export function statusMacro(consumido, meta) {
  if (meta <= 0) return 'verde';
  const razao = consumido / meta;
  if (razao >= 0.90) return 'verde';
  if (razao >= 0.75) return 'amarelo';
  return 'vermelho';
}
```

- [ ] **Step 4: Rodar até passar**

Run: `node --test testes/metas.test.js`
Expected: PASS, 7 testes.

- [ ] **Step 5: Commit**

```bash
git add src/metas.js testes/metas.test.js
git commit -m "Metas do dia com carbo derivado e alerta assimetrico

Acima da meta e verde. Abaixo e que alerta — o risco do atleta e
deficit, nao excesso."
```

---

### Task 5: Armazenamento por dia

**Files:**
- Create: `src/armazenamento.js`
- Test: `testes/armazenamento.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `criarArmazenamento(storage)` devolvendo `{ lerDia(data), marcar(data, chave), desmarcar(data, chave), addExtra(data, id), addCombustivel(data, id), definirPerfil(data, dia), exportar() }`. `lerDia` devolve `{ marcados: string[], extras: {id, qtd}[], combustivel: {id, qtd}[], perfil: string | null }`.

Recebe o `storage` por parâmetro para ser testável em Node sem navegador.

- [ ] **Step 1: Escrever o teste que falha**

`testes/armazenamento.test.js`:

```javascript
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test testes/armazenamento.test.js`
Expected: FAIL — módulo inexistente

- [ ] **Step 3: Implementar**

`src/armazenamento.js`:

```javascript
const PREFIXO = 'pa:';
const VAZIO = () => ({ marcados: [], extras: [], combustivel: [], perfil: null });

export function criarArmazenamento(storage) {
  const ler = data => {
    const bruto = storage.getItem(PREFIXO + data);
    if (!bruto) return VAZIO();
    try {
      return { ...VAZIO(), ...JSON.parse(bruto) };
    } catch {
      return VAZIO();
    }
  };
  const gravar = (data, dia) => storage.setItem(PREFIXO + data, JSON.stringify(dia));

  const somar = (lista, id) => {
    const achado = lista.find(x => x.id === id);
    if (achado) achado.qtd += 1;
    else lista.push({ id, qtd: 1 });
  };

  return {
    lerDia: ler,
    marcar(data, chave) {
      const dia = ler(data);
      if (!dia.marcados.includes(chave)) dia.marcados.push(chave);
      gravar(data, dia);
    },
    desmarcar(data, chave) {
      const dia = ler(data);
      dia.marcados = dia.marcados.filter(c => c !== chave);
      gravar(data, dia);
    },
    addExtra(data, id) {
      const dia = ler(data);
      somar(dia.extras, id);
      gravar(data, dia);
    },
    addCombustivel(data, id) {
      const dia = ler(data);
      somar(dia.combustivel, id);
      gravar(data, dia);
    },
    definirPerfil(data, perfil) {
      const dia = ler(data);
      dia.perfil = perfil;
      gravar(data, dia);
    },
    exportar() {
      const dias = {};
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith(PREFIXO)) dias[k.slice(PREFIXO.length)] = ler(k.slice(PREFIXO.length));
      }
      return { versao: 1, geradoEm: new Date().toISOString(), dias };
    },
  };
}
```

- [ ] **Step 4: Rodar até passar**

Run: `node --test testes/armazenamento.test.js`
Expected: PASS, 9 testes.

- [ ] **Step 5: Commit**

```bash
git add src/armazenamento.js testes/armazenamento.test.js
git commit -m "Armazenamento por dia em localStorage

Ingredientes de opcoes diferentes convivem na mesma refeicao — e a
mistura livre entre A, B e C que motivou o app."
```

---

### Task 6: Sugestão de qual opção fecha o dia

**Files:**
- Create: `src/sugestao.js`
- Test: `testes/sugestao.test.js`

**Interfaces:**
- Consumes: `calcularItens` (Task 3), `metaDoDia` (Task 4).
- Produces: `ordenarOpcoes(opcoes, restante, alimentos) -> [{ opcao, custo }]` em ordem crescente de custo, e `resumoRestante(consumido, meta, refeicoesRestantes) -> string`.

Função de custo da §6.2 da spec — proteína pesa o dobro, porque é o macro que o plano trata como inegociável:

```
custo = |déficit_p_após| × 2 + |déficit_kcal_após| / 100
```

- [ ] **Step 1: Escrever o teste que falha**

`testes/sugestao.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { ordenarOpcoes, resumoRestante } from '../src/sugestao.js';

const alimentos = {
  frango_grelhado: { nome: 'Frango', kcal: 165, p: 31, c: 0, g: 3.6, fonte: 't' },
  arroz_branco:    { nome: 'Arroz',  kcal: 128, p: 2.5, c: 28.1, g: 0.2, fonte: 't' },
  banana:          { nome: 'Banana', kcal: 92,  p: 1.3, c: 23.8, g: 0.1, fonte: 't' },
};

const opcoes = [
  { letra: 'A', itens: [{ alimento: 'banana', g: 200 }] },
  { letra: 'B', itens: [{ alimento: 'frango_grelhado', g: 200 }] },
  { letra: 'C', itens: [{ alimento: 'arroz_branco', g: 200 }] },
];

test('com deficit grande de proteina, a opcao proteica vence', () => {
  const r = ordenarOpcoes(opcoes, { kcal: 400, p: 60 }, alimentos);
  assert.strictEqual(r[0].opcao.letra, 'B');
});

test('sem deficit de proteina, a opcao que fecha kcal vence', () => {
  const r = ordenarOpcoes(opcoes, { kcal: 250, p: 2 }, alimentos);
  assert.notStrictEqual(r[0].opcao.letra, 'B');
});

test('devolve todas as opcoes, nunca filtra', () => {
  assert.strictEqual(ordenarOpcoes(opcoes, { kcal: 400, p: 60 }, alimentos).length, 3);
});

test('a ordem e crescente por custo', () => {
  const r = ordenarOpcoes(opcoes, { kcal: 400, p: 60 }, alimentos);
  assert.ok(r[0].custo <= r[1].custo && r[1].custo <= r[2].custo);
});

test('o resumo conta o que falta em linguagem natural', () => {
  assert.strictEqual(
    resumoRestante({ kcal: 1800, p: 149 }, { kcal: 2507, p: 203 }, 2),
    'faltam 54 g de proteína em 2 refeições'
  );
});

test('meta ja batida devolve mensagem de meta cumprida', () => {
  assert.strictEqual(
    resumoRestante({ kcal: 2600, p: 210 }, { kcal: 2507, p: 203 }, 1),
    'meta de proteína cumprida'
  );
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test testes/sugestao.test.js`
Expected: FAIL — módulo inexistente

- [ ] **Step 3: Implementar**

`src/sugestao.js`:

```javascript
import { calcularItens } from './nutricao.js';

// Proteína pesa o dobro de propósito: o plano a trata como inegociável
// (2,9 g/kg, e proíbe reduzir a do café da manhã e a da ceia). kcal entra
// dividido por 100 para ficar na mesma ordem de grandeza dos gramas.
export function ordenarOpcoes(opcoes, restante, alimentos) {
  return opcoes
    .map(opcao => {
      const calc = calcularItens(opcao.itens, alimentos);
      const sobraP = Math.abs(restante.p - calc.p);
      const sobraKcal = Math.abs(restante.kcal - calc.kcal);
      return { opcao, custo: sobraP * 2 + sobraKcal / 100 };
    })
    .sort((a, b) => a.custo - b.custo);
}

export function resumoRestante(consumido, meta, refeicoesRestantes) {
  const faltaP = Math.round(meta.p - consumido.p);
  if (faltaP <= 0) return 'meta de proteína cumprida';
  const r = refeicoesRestantes === 1 ? '1 refeição' : `${refeicoesRestantes} refeições`;
  return `faltam ${faltaP} g de proteína em ${r}`;
}
```

- [ ] **Step 4: Rodar até passar**

Run: `node --test testes/sugestao.test.js`
Expected: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/sugestao.js testes/sugestao.test.js
git commit -m "Sugestao de qual opcao fecha a conta do dia

Ordena A/B/C por aderencia a meta restante. Sugestao, nunca imposicao:
as tres continuam igualmente clicaveis."
```

---

### Task 7: Combustível de treino e extras

**Files:**
- Create: `dados/combustivel.json`
- Create: `dados/extras.json`
- Test: `testes/combustivel.test.js`

**Interfaces:**
- Consumes: `calcularItens` (Task 3).
- Produces: `dados/combustivel.json` e `dados/extras.json`, ambos `{ id: { nome, kcal, p, c, fonte } }` com valores **por porção** (não por 100 g).

- [ ] **Step 1: Escrever o teste que falha**

`testes/combustivel.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const comb = JSON.parse(readFileSync('dados/combustivel.json', 'utf8'));
const extras = JSON.parse(readFileSync('dados/extras.json', 'utf8'));

test('a hora de pedal vale 45 g de carbo e 180 kcal', () => {
  assert.strictEqual(comb.hora_pedal.c, 45);
  assert.strictEqual(comb.hora_pedal.kcal, 180);
});

test('os valores de rotulo conferidos estao corretos', () => {
  assert.strictEqual(comb.energy_kick.kcal, 137);
  assert.strictEqual(comb.energy_kick.c, 30);
  assert.strictEqual(comb.saltz.kcal, 44);
  assert.strictEqual(comb.saltz.c, 11);
  assert.strictEqual(comb.saltz.sodio_mg, 1000);
});

test('o gel isolado nao entra: rotulo nao conferido', () => {
  assert.ok(!comb.gel_z2, 'gel Z2 nao deve ser item ate o rotulo ser conferido');
});

test('todo item de combustivel declara a fonte do numero', () => {
  for (const [id, item] of Object.entries(comb)) {
    assert.ok(item.fonte && item.fonte.length > 0, `${id} sem fonte`);
  }
});

test('duas horas de pedal cobrem o deficit medido do sabado', () => {
  const duasHoras = comb.hora_pedal.kcal * 2;
  assert.ok(duasHoras >= 174 && duasHoras <= 400, `${duasHoras} kcal fora da faixa do deficit`);
});

test('a lista de extras tem ao menos 15 itens com macro completo', () => {
  const ids = Object.keys(extras);
  assert.ok(ids.length >= 15, `apenas ${ids.length} extras`);
  for (const [id, e] of Object.entries(extras)) {
    for (const campo of ['nome', 'kcal', 'p', 'c', 'fonte']) {
      assert.ok(campo in e, `extra ${id} sem ${campo}`);
    }
  }
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test testes/combustivel.test.js`
Expected: FAIL — `ENOENT: dados/combustivel.json`

- [ ] **Step 3: Criar os dados**

`dados/combustivel.json`:

```json
{
  "hora_pedal": {
    "nome": "+1h de pedal",
    "sublabel": "gel + Energy Kick + Saltz · 1 dose/h",
    "kcal": 180, "p": 0, "c": 45, "sodio_mg": 1000,
    "fonte": "Média das 3 opções do plano (~50/45/40 g carbo/h)"
  },
  "energy_kick": {
    "nome": "DUX Energy Kick",
    "sublabel": "sachê 30 g",
    "kcal": 137, "p": 0, "c": 30,
    "fonte": "Rótulo conferido em 07/Set/2026"
  },
  "saltz": {
    "nome": "Saltz Z2",
    "sublabel": "dose 15 g · 1000 mg sódio",
    "kcal": 44, "p": 0, "c": 11, "sodio_mg": 1000,
    "fonte": "Rótulo conferido em 07/Set/2026"
  }
}
```

`dados/extras.json` com no mínimo estes 15, valores por porção, `fonte: "TACO"` ou `"Rótulo médio de mercado"`: pão de queijo (unidade), fatia de pizza, lata de cerveja 350 ml, taça de vinho 150 ml, açaí 300 ml, brigadeiro, pastel, coxinha, barra de chocolate 25 g, sorvete 1 bola, refrigerante lata 350 ml, salgado de padaria, tapioca simples, pão francês com manteiga, pipoca de cinema média.

- [ ] **Step 4: Rodar até passar**

Run: `node --test testes/combustivel.test.js`
Expected: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
git add dados/combustivel.json dados/extras.json testes/combustivel.test.js
git commit -m "Combustivel de treino e lista semente de extras

A hora de pedal e composta e derivada do plano, nao de rotulo. O gel Z2
isolado fica de fora ate o rotulo ser conferido."
```

---

### Task 8: Tela Hoje

**Files:**
- Create: `index.html`
- Create: `src/app.js`

**Interfaces:**
- Consumes: todos os módulos das Tasks 1-7.
- Produces: o app navegável. Chave de ingrediente no DOM via `data-chave="refeicaoId:letra:alimento"`.

Requisitos de comportamento, todos verificáveis à mão:

1. Abre no dia da semana corrente com o perfil correto no cabeçalho (sessão, kcal-alvo, proteína-alvo).
2. Topo pegajoso com três barras — kcal, proteína, carbo — visíveis durante todo o scroll, cada uma colorida por `statusMacro`.
3. As 7 refeições na ordem do relógio, com hora, estado (vazia / parcial / completa) e subtotal.
4. Tocar numa refeição expande as 3 opções.
5. **Cada ingrediente é um alvo de toque independente. Marcar itens de A, B e C ao mesmo tempo é permitido e é o ponto do app.** Não existe seleção exclusiva de opção.
6. Ingrediente marcado: fundo `#22c55e`, texto branco. Toque de novo desmarca.
7. Dentro de refeição ainda não registrada, as opções aparecem ordenadas por `ordenarOpcoes` com uma marca na melhor, e acima delas a linha de `resumoRestante`.
8. Refeição `opcional: true` traz o rótulo "opcional"; `obrigatorio: true` traz "⚠️ obrigatório".
9. A seção de combustível aparece em todos os dias: expandida e destacada no sábado, recolhida nos demais. Cada toque em "+1h de pedal" incrementa; a quantidade aparece ao lado.
10. Alvos de toque com no mínimo 44×44 px (mínimo da Apple para toque confiável).
11. Nenhum `<input type="text">` ou `type="number"` em lugar algum do app.

- [ ] **Step 1: Escrever a casca e o render**

`index.html` com `<script type="module" src="src/app.js">`, e `src/app.js` carregando os JSON via `fetch`. Todo acesso ao DOM vive aqui e em nenhum outro módulo.

- [ ] **Step 2: Servir e verificar à mão**

Run: `python3 -m http.server 8000`
Abrir `http://localhost:8000` e conferir os 11 requisitos acima, um a um. Módulos ES não carregam de `file://` — o servidor local é obrigatório.

- [ ] **Step 3: Confirmar que a lógica pura seguiu intacta**

Run: `node --test testes/`
Expected: PASS, todos.

- [ ] **Step 4: Commit**

```bash
git add index.html src/app.js
git commit -m "Tela Hoje: refeicoes, ingredientes clicaveis e tres barras

Ingredientes de A, B e C sao marcaveis simultaneamente — opcoes sao
agrupamentos visuais sugeridos, nunca selecao exclusiva."
```

---

### Task 9: Extras, troca de perfil do dia e tela Semana

**Files:**
- Create: `src/semana.js`
- Modify: `src/app.js`
- Modify: `index.html`
- Test: `testes/semana.test.js`

**Interfaces:**
- Consumes: `criarArmazenamento` (Task 5), `metaDoDia` (Task 4), `calcularItens` (Task 3).
- Produces: `resumoSemana(dias, plano, alimentos) -> { aderencia, mediaKcal, mediaP, mediaC, refeicoesMaisPuladas }`.

- [ ] **Step 1: Escrever o teste que falha**

`testes/semana.test.js`:

```javascript
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test testes/semana.test.js`
Expected: FAIL — módulo inexistente

- [ ] **Step 3: Implementar `src/semana.js` e ligar na UI**

Na UI acrescentar:
- Botão `+ Extra` fixo no rodapé, abrindo folha com a lista de `extras.json`, ordenada por frequência de uso (contagem em `localStorage`, chave `pa:freq`). Um toque adiciona.
- Extras aparecem em seção própria no fim do dia, separados do plano, e somam nas barras.
- No seletor de dia, a ação **"usar este dia como hoje"**, que grava `perfil` via `definirPerfil`.
- Tela Semana com aderência, médias vs meta, refeições mais puladas, a nota explicando a derivação da meta de carbo, e o botão **Exportar JSON** (via `Blob` + `URL.createObjectURL`).

- [ ] **Step 4: Rodar até passar e verificar à mão**

Run: `node --test testes/`
Expected: PASS, todos. Depois conferir extras, troca de perfil e exportação no navegador.

- [ ] **Step 5: Commit**

```bash
git add src/semana.js src/app.js index.html testes/semana.test.js
git commit -m "Extras, troca de perfil do dia e tela Semana

Exporta JSON para calibrar o plano do mes seguinte pelo consumo real."
```

---

### Task 10: PWA e verificação offline no iPhone

**Files:**
- Create: `manifest.json`
- Create: `sw.js`
- Create: `icone-192.png`, `icone-512.png`
- Modify: `index.html`

- [ ] **Step 1: Escrever manifest e service worker**

`manifest.json` com `display: "standalone"`, `theme_color: "#22c55e"`, `background_color: "#ffffff"`, `name: "Plano Alimentar"`, `short_name: "Plano"`, e os dois ícones.

`sw.js` com estratégia cache-first sobre uma lista explícita: `index.html`, `src/*.js`, `dados/*.json`, os ícones. Versionar o nome do cache (`plano-v1`) e apagar caches antigos no `activate`.

- [ ] **Step 2: Verificar que registra**

Servir, abrir o app, e no console conferir que o service worker registrou e que a segunda carga vem do cache.

- [ ] **Step 3: Teste manual obrigatório no iPhone**

Este teste é condição para publicar:
1. Abrir a URL no Safari do iPhone.
2. Compartilhar → Adicionar à Tela de Início.
3. Ativar o modo avião.
4. Abrir pelo ícone: deve carregar e permitir marcar ingredientes.
5. Fechar, reabrir ainda offline: as marcações continuam lá.

- [ ] **Step 4: Commit**

```bash
git add manifest.json sw.js icone-192.png icone-512.png index.html
git commit -m "PWA: manifest, service worker e icones

Verificado no iPhone em modo aviao: abre, registra e preserva estado."
```

---

### Task 11: Publicação no GitHub Pages

**Files:**
- Create: `README.md`
- Create: `.gitignore`

- [ ] **Step 1: README**

Explicar o que é, como atualizar o plano do mês seguinte (rodar `extrair-plano.py` e commitar o JSON novo), e como rodar os testes (`node --test testes/`).

- [ ] **Step 2: Criar o repositório e publicar**

```bash
gh repo create plano-alimentar --public --source=. --remote=origin --push
gh api -X POST repos/HLanfesp/plano-alimentar/pages -f 'source[branch]=main' -f 'source[path]=/'
```

- [ ] **Step 3: Verificar no ar**

Abrir `https://hlanfesp.github.io/plano-alimentar` e refazer o teste do iPhone da Task 10 contra a URL pública.

- [ ] **Step 4: Commit**

```bash
git add README.md .gitignore
git commit -m "README e publicacao no GitHub Pages"
git push
```

---

## Auto-revisão do plano

**Cobertura da spec:**

| Seção da spec | Task |
|---|---|
| §4 validação da abordagem | 3 |
| §5.1 alimentos.json | 1 |
| §5.2 plano-YYYY-MM.json | 2 |
| §5.3 meta de carbo derivada | 4 |
| §6.1 tela Hoje | 8 |
| §6.2 sugestão de fechamento | 6 |
| §6.3 combustível de treino | 7, 8 |
| §6.4 troca de perfil do dia | 9 |
| §6.5 extras | 7, 9 |
| §6.6 semana e exportação | 9 |
| §7 persistência | 5 |
| §8 testes | distribuídos por task |
| §9 publicação | 11 |
| §10 atualização mensal | 2 (extrator), 11 (README) |

Sem lacunas.

**Consistência de tipos:** `calcularItens(itens, alimentos)` devolve `{kcal, p, c, g}` e é consumida com essa forma nas Tasks 6, 8 e 9. `metaDoDia` devolve `{kcal, p, c, cDerivado}` e `statusMacro(consumido, meta)` recebe números, não objetos — conferido nos testes das Tasks 4, 8 e 9. `lerDia` sempre devolve as quatro chaves, nunca `null`, o que dispensa guarda em todo consumidor.

**Riscos conhecidos:**

1. A Task 3 pode reprovar alimentos cujo valor TACO eu estimei. É o comportamento desejado: o teste existe para pegar isso. Corrigir o dado, nunca o limite.
2. O rótulo do gel Z2 nunca foi conferido — item em aberto registrado na spec §6.3, não bloqueia a v1.
3. O representante de "fruta da estação" é uma escolha declarada, não um dado. Está visível no campo `nome` para o atleta contestar.
