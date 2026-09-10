# Plano Alimentar — App de Acompanhamento

Um app que você abre no iPhone durante o dia, toca nos ingredientes que comeu, e vê na hora se está dentro do alvo de calorias e proteína. Funciona completamente offline — os dados ficam só no seu aparelho.

## Para Hiallyson

### Como instalar no iPhone

1. Abra este link no Safari: `https://hlanfesp.github.io/plano-alimentar`
2. Toque no ícone de compartilhar (caixa com seta para cima)
3. Escolha "Adicionar à Tela de Início"
4. Dê um nome (ex: "Plano Alimentar") e toque "Adicionar"

Pronto. O app fica um ícone na tela inicial do seu iPhone, igual a um app de verdade. Abre instantaneamente.

### Funciona offline

Depois que você abrir uma vez, o app funciona sem internet. Nas 5h da manhã antes do treino, na ceia das 22h — abre normal, sem rede.

### Os dados ficam só no seu iPhone

Nada do que você marca entra em nuvem, nunca. Nem servidor, nem sincronização. É tudo armazenado na memória do Safari do seu próprio telefone.

### Aviso: limpar os dados do Safari apaga tudo

Se você for em Configurações → Safari → Limpar Histórico e Dados do Website, o app esquece tudo que você registrou. Use antes de fazer uma limpeza:

1. Abra o app
2. Vá para a aba "Semana"
3. Toque em "Exportar JSON" no fim da tela
4. Salve o arquivo

Esse arquivo é um backup. Guarde se quiser, mas não é necessário para o app funcionar — é só para referência ou para passar dados para o nutricionista rever o plano do mês seguinte.

## Para quem atualizar o plano do mês

Quando chegar o plano novo em HTML (ex: `Plano_Alimentar_Outubro_2026.html`), siga estes passos:

### 1. Converter o HTML para JSON

Dentro da pasta do repositório, rode:

```bash
python3 ferramentas/extrair-plano.py Plano_Alimentar_Outubro_2026.html dados/plano-2026-10.json
```

O script vai:
- Ler o HTML do nutricionista
- Procurar cada ingrediente em `dados/alimentos.json`
- Gerar o arquivo JSON estruturado

Se algum ingrediente não for conhecido, o script **vai parar e listar os desconhecidos**. Não inventa valor. Se isso acontecer, adicione o ingrediente em `dados/alimentos.json` (veja o formato abaixo) e rode de novo.

Sucesso fica assim:
```
OK: 7 dias, 49 refeições, 147 opções -> dados/plano-2026-10.json
```

### 2. Registrar a entrada no índice

Abra `dados/indice.json` e adicione a nova entrada:

```json
{
  "planos": [
    { "mes": "2026-09", "arquivo": "dados/plano-2026-09.json" },
    { "mes": "2026-10", "arquivo": "dados/plano-2026-10.json" }
  ]
}
```

**Importante:** a ordem da lista não importa. O app escolhe automaticamente o mês atual (ou o mais novo se ainda não chegou). Não edite nenhum arquivo `.js` — o índice cuida de tudo.

### 3. Service worker: quando mexer em `CACHE_NOME`

Abra `sw.js` e procure pela linha:

```javascript
const CACHE_NOME = PREFIXO_CACHE + "v1";
```

**Mude só se um arquivo do casco mudar** (index.html, ou qualquer arquivo em `src/`). Se você só adicionou um plano novo em `dados/`:

- **Não mude nada em `sw.js`**

A estratégia de cache é:
- **Casco** (HTML, CSS, JS): cache-first — servido do cache pronto, rápido
- **Dados** (planos, ingredientes): network-first — a rede tenta primeiro, cai no cache se falhar

Assim, qualquer pessoa que já tiver o app instalado **descobre o plano de outubro na rede automaticamente, sem precisar atualizar manualmente**.

Se você mexer no `index.html` ou em algum `src/*.js`, **então sim, mude `CACHE_NOME` para `v2`, `v3`, etc.**. Isso força o navegador a descartar o cache antigo e baixar a versão nova.

### 4. Verificar que funcionou

Rode os testes (todos devem passar):

```bash
node --test testes/*.test.js
```

Os testes percorrem `dados/indice.json`, não um arquivo fixo: assim que você registrar o plano de outubro no índice (passo 2), ele passa a ser validado junto com os demais, automaticamente. Para cada plano do índice, os testes garantem:

- estrutura: 7 dias, 49 refeições, 147 opções
- todo ingrediente resolve em `dados/alimentos.json` e tem gramagem > 0
- a linha de combustível do sábado existe e não tem kcal própria
- refeições opcionais/obrigatórias (pré-natação, lanche da manhã, combustível do sábado) estão marcadas corretamente
- nenhuma opção diverge mais de 80 kcal do valor impresso no plano
- o desvio absoluto médio de kcal fica em até 25 kcal
- seguir sempre a opção A, sempre B ou sempre C fecha a meta diária de kcal entre 88% e 112%
- o desvio médio de proteína fica abaixo de 8%

Só os valores numéricos específicos de setembro (as metas de kcal daquele mês, as opções de referência da spec) ficam fixados em setembro — são dados daquele mês, não critério para os demais.

Se algum teste falhar, a mensagem mostra de qual mês veio a falha (ex: `[2026-10] ...`) e o que não bateu. Leia a mensagem de erro — ela aponta o problema.

### 5. Commit e push

Faça um commit com os dois arquivos:

```bash
git add dados/indice.json dados/plano-2026-10.json
git commit -m "Adiciona plano de outubro"
git push
```

Pronto. O app descobre o novo plano na próxima vez que alguém abrir ou recarregar.

---

## Como rodar os testes

```bash
node --test testes/*.test.js
```

O app tem 84 testes de núcleo (cálculos de macro, validação do plano, persistência). Todos devem passar antes de publicar.

**Não use** `node --test testes/` (sem `*.test.js`). Isso falha com MODULE_NOT_FOUND neste ambiente.

---

## Estrutura do projeto

```
plano-alimentar/
├── index.html              casco HTML + CSS; o JavaScript vive em src/*.js
├── manifest.json           declaração PWA (ícone, nome, modo standalone)
├── sw.js                   service worker (cache, offline, estratégia de rede)
│
├── src/
│   ├── app.js              camada de interface — lê o DOM, monta telas, trata toques
│   ├── nutricao.js         cálculos de macro — calcula kcal, proteína, carbo de um item
│   ├── metas.js            meta do dia e status assimétrico (verde/amarelo/vermelho)
│   ├── sugestao.js         ordenação de opções, resumo do que falta, fatia por refeição
│   ├── armazenamento.js    persistência em localStorage — salva/lê o que foi marcado
│   ├── semana.js           resumo semanal — aderência, médias, refeições mais puladas
│   └── indice.js           escolhe qual plano usar a partir de dados/indice.json
│
├── dados/
│   ├── indice.json         lista de planos disponíveis e seus arquivos
│   ├── alimentos.json      base de 52 ingredientes com macro por 100g
│   ├── unidades.json       unidade natural de cada ingrediente (1 banana, 1 ovo, etc)
│   ├── combustivel.json    itens de treino de endurance (Energy Kick, Saltz, etc)
│   ├── extras.json         porções prontas (pão de queijo, cerveja, pizza, etc)
│   └── plano-2026-0X.json  cardápio do mês (gerado pelo extrator)
│
├── ferramentas/
│   └── extrair-plano.py    script que converte HTML do nutricionista em JSON
│
├── testes/
│   ├── *.test.js           84 testes de núcleo (Node.js nativo, sem framework)
│   └── dados/              arquivos JSON dos testes
│
└── docs/superpowers/specs/
    └── 2026-09-09-plano-alimentar-app-design.md  spec completa do projeto
```

### Papel de cada módulo

**`app.js`** — a única camada que escreve no DOM. Lê o estado dos módulos abaixo, constrói HTML, ouve toques do usuário. Sem lógica de negócio.

**`nutricao.js`** — cálculos puros: dado um item (ex: "frango 135g"), calcula kcal, proteína, carboidrato. Resolve nomes de ingredientes contra `dados/alimentos.json`. Sem estado, sem DOM.

**`metas.js`** — meta do dia (kcal e proteína) e status de cada macro. Decide a cor (verde/amarelo/vermelho) conforme o alerta assimétrico documentado na seção Decisões abaixo.

**`sugestao.js`** — ordena as 3 opções de uma refeição por qual delas melhor aproxima você da meta do dia. Calcula quanto falta de cada macro. Sem DOM.

**`armazenamento.js`** — salva e lê em `localStorage` o que você marcou. Uma chave por dia (ex: `pa:2026-09-10`). Preserva o histórico mesmo depois que você troca de dia.

**`semana.js`** — resumo dos últimos 7 dias: aderência em %, médias de macro vs meta, qual refeição você mais pula. Usado na tela "Semana".

**`indice.js`** — lê `dados/indice.json` e escolhe qual plano mensal usar. Regra: o mês mais novo que não seja futuro em relação a hoje. Se todos forem futuros, usa o mais antigo disponível.

---

## Decisões de projeto que precisam ficar registradas

### 1. Alerta assimétrico DE PROPÓSITO

A barra de kcal (e proteína) só alerta para BAIXO:
- **Acima da meta:** verde (neutro)
- **Abaixo de 90% da meta:** amarelo
- **Abaixo de 75% da meta:** vermelho

Consumir **mais** que a meta fica verde. O plano do atleta diz textualmente: *"O ajuste é para cima, não para baixo."* O risco dele é déficit, não excesso. Alerta ao contrário seria errado — pioraria a aderência.

### 2. Meta de carboidrato é DERIVADA, não prescrita

O plano só traz kcal e proteína. O app calcula carboidrato assim:

```
gordura_alvo = 25% das kcal do dia  (padrão para atleta endurance)
carbo_alvo = (kcal_dia − p_dia×4 − gordura_alvo) / 4
```

Exemplo — Segunda (2507 kcal, 203g proteína):
```
gordura_alvo = 2507 × 0.25 = 627 kcal
carbo_alvo = (2507 − 812 − 627) / 4 = 267 g
```

O app rotula essa meta como **"(derivada)"** para deixar claro que ela não veio da prescrição — é um cálculo. Isso evita que o atleta trate carboidrato com o mesmo peso de kcal e proteína.

---

## Limitações (com honestidade)

**Nunca foi aberto num iPhone, nem em simulador.** Toda a verificação foi feita no Chrome do desktop, em viewport 375×812, inclusive o modo offline (servidor derrubado, app continua abrindo pelo service worker). Safari de iOS não foi testado — nem em simulador, nem em hardware. Onde isso tende a doer primeiro: `localStorage` em navegação privada (daí o aviso de falha de armazenamento), o comportamento do service worker e os 100vh com a barra do Safari.

**Gel Z2 não tem rótulo conferido.** Ele está no combustível de treino como parte do composto "+1h de pedal", mas isolado não é item — porque o rótulo não foi verificado. Se o nutricionista confirmar o valor depois, a gente adiciona.

**As opções C ficam ~5% abaixo da meta, de forma sistemática.** Seguindo sempre a opção C, a cobertura média do dia é 94,9% da meta, contra ~100% das opções A e B — cerca de **130 kcal/dia a menos** que o prescrito. Na proteína o pior caso é sexta sempre-C: 174 g contra meta de 206 g (84,5%). Isso passa dentro dos portões de teste de propósito, registrado como exceção nomeada em `testes/validacao.test.js`. Não é defeito do app: é achado para levar ao nutricionista. Quem prefere a C por gosto deve saber que está comendo menos do que o plano pede — e o risco declarado deste atleta é déficit.

**Mililitro é convertido como se fosse grama (densidade 1:1).** O app trata `10 ml` como `10 g`. Para água e caldos dá no mesmo; para óleo, não: azeite tem 0,92 g/ml, então cada ~10 ml de azeite **superestima ~7 kcal**. O erro é pequeno por refeição, mas é na direção ruim — barra mais verde do que a realidade.

**Extras e combustível de treino não trazem gordura nos dados.** Os arquivos `dados/extras.json` e `dados/combustivel.json` só têm kcal, proteína e carboidrato. Como a meta de carbo é derivada assumindo que 25% das kcal vêm da gordura (ver acima), o que foi comido fora do cardápio não participa dessa premissa: num dia de muito extra ou muito pedal, a meta de carbo exibida está um pouco mais frouxa do que a conta sugere. A tela Semana diz isso em uma linha, ao lado da nota de meta derivada.

**Base nutricional mescla tabela com rótulo.** Alguns ingredientes vêm da TACO (Tabela Brasileira de Composição de Alimentos), outros da média de rótulos (whey, granola), outros do USDA. Cada item em `dados/alimentos.json` tem um campo `fonte` que diz de onde veio — se você abrir o arquivo JSON, consegue ver. Não é ciência de precisão, mas é referência honesta.

---

## Licença e Público

O repositório é público em GitHub. Qualquer pessoa com o link consegue ver o plano alimentar. Nenhum dado de consumo sai do seu iPhone — o repositório só tem o plano prescrito e o código.
