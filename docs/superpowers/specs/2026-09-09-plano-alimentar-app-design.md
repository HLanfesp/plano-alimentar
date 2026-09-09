# Plano Alimentar — App de Acompanhamento

**Data:** 2026-09-09
**Status:** Aprovado (design), aguardando plano de implementação
**Atleta:** Hiallyson Landim
**Repositório:** `HLanfesp/plano-alimentar` (público, GitHub Pages)

## 1. Problema

O plano alimentar mensal existe como um HTML estático de leitura
(`Plano_Alimentar_Setembro_2026.html`): 7 dias × 7 refeições × 3 opções.
Ele informa, mas não acompanha. Na prática o atleta:

- mistura ingredientes entre as opções A, B e C da mesma refeição, e aí
  perde a referência de kcal e proteína, porque os números do plano são
  por opção inteira;
- não tem visibilidade de carboidrato — o plano não traz esse dado em
  lugar nenhum, só kcal e proteína;
- come coisas fora do plano sem saber o impacto no alvo do dia;
- não sabe, no meio do dia, se está indo abaixo ou acima da meta.

O risco declarado no próprio plano não é excesso, é déficit: *"Se a
balança cair mais de ~0,3 kg/semana por 2 semanas seguidas... O ajuste é
para cima, não para baixo."* O app existe para proteger o peso e o
treino, não para policiar consumo.

## 2. Objetivo

Um app que o atleta abre no iPhone, toca nos ingredientes que comeu, e vê
na hora onde está em relação à meta do dia — sem digitar nada.

**Restrição de projeto declarada pelo usuário: simplicidade acima de
tudo, para não perder a motivação de usar.** Toda decisão de escopo abaixo
é subordinada a essa restrição. "Nunca digitar" é regra, não preferência.

## 3. Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Cálculo de macros | Base de ingredientes (por 100 g) | É o que permite misturar A/B/C e é o que produz carboidrato, ausente do plano |
| Gramagem | Fixa, vinda do plano | O usuário nunca digita quantidade |
| Plataforma | PWA offline, HTML/JS puro, localStorage | Grátis, sem login, sem backend, ícone na tela de início |
| Registro | Ingrediente sim/não | Sem ajuste de porção — simplicidade |
| Dashboard | kcal + proteína + carbo | As três que importam para o objetivo |
| Extras | Lista de porções prontas | Dois toques, zero digitação |
| Histórico | Diário + resumo semanal | Alimenta a revisão mensal do plano |
| Visual | Verde #22c55e, tema claro | Referência escolhida pelo usuário; mesmo verde dos planos atuais |
| Combustível de treino | Seção própria, presente todos os dias (§6.5) | É uma refeição real do cardápio no sábado e o treino troca de dia |
| Suplementos (ômega-3, magnésio, creatina) | Fora do escopo v1 | Não afetam macro; nada a somar |

## 4. Validação da abordagem por ingrediente

O risco central da escolha de calcular por ingrediente é divergir dos
números do plano. Testado com valores TACO em duas opções reais:

| Opção | Plano | Calculado | Desvio |
|---|---|---|---|
| 4 ovos + 2 fatias pão integral + queijo minas (35 g) | 510 kcal · 37 g P | 503 kcal · 36,6 g P | 1,4% |
| Frango (135 g) + arroz integral (190 g) + feijão (120 g) + salada (120 g) + azeite (10 ml) | 674 kcal · 55 g P | 662 kcal · 54,5 g P | 1,8% |

Desvio abaixo de 2%. A abordagem se sustenta.

**Critério de aceite:** ao gerar `plano-setembro.json`, cada uma das 147
opções tem seu kcal e proteína calculados comparados ao valor impresso no
plano. Nenhuma opção pode divergir mais de 8%; a média não pode passar de
4%. Opções fora da faixa indicam erro de gramagem ou de valor na base e
devem ser corrigidas antes do app ir ao ar.

A linha "Durante o pedal" do sábado é a única refeição sem kcal impresso e
fica fora dessa comparação. Em seu lugar, um teste separado: sábado
completo (uma opção por refeição + 2h de combustível) deve cair a menos de
6% dos 2952 kcal da meta.

## 5. Arquitetura

Três arquivos, zero dependências, zero build.

```
plano-alimentar/
├── index.html          app completo: HTML + CSS + JS puro
├── manifest.json       PWA (nome, ícone, standalone)
├── sw.js               service worker: cache-first, funciona offline
├── dados/
│   ├── alimentos.json  51 alimentos, macro por 100 g
│   └── plano-2026-09.json  7 dias × 7 refeições × 3 opções
└── docs/superpowers/specs/
```

### 5.1 `alimentos.json`

O plano contém 59 nomes de ingrediente distintos (medido, não estimado).
Destes, 5 são combustível de treino fora do escopo v1 (Saltz Z2, gel Z2,
DUX Energy Kick, gel de carboidrato, rapadura) e 3 são genéricos que
precisam de resolução explícita ("fruta da estação", "fruta", "canela ou
mel") — mapeados para um valor representativo declarado na base. Restam
**51 alimentos** a catalogar. Fonte: TACO (Tabela Brasileira de Composição de Alimentos),
USDA como fallback para itens industrializados (whey, granola).

```json
{
  "frango_grelhado": { "nome": "Frango grelhado", "kcal": 165, "p": 31.0, "c": 0.0, "g": 3.6 },
  "arroz_integral":  { "nome": "Arroz integral",  "kcal": 124, "p": 2.6,  "c": 25.8, "g": 1.0 }
}
```

Valores por 100 g (ou 100 ml para líquidos), no **estado em que é
consumido** — arroz cozido, não cru. Gordura é armazenada mas não exibida
na v1; existe para fechar a conta calórica e permitir exibi-la depois sem
migração de dados.

### 5.2 `plano-2026-09.json`

```json
{
  "mes": "2026-09",
  "titulo": "Setembro 2026",
  "dias": {
    "seg": {
      "rotulo": "Push — Força Máxima",
      "sessao": "🏋️",
      "meta": { "kcal": 2507, "p": 203 },
      "refeicoes": [
        {
          "id": "pre",
          "nome": "Pré-treino",
          "hora": "05h00",
          "opcional": false,
          "obrigatorio": false,
          "opcoes": [
            {
              "letra": "A",
              "kcal_plano": 160,
              "p_plano": 1,
              "itens": [
                { "alimento": "banana", "g": 100, "rotulo": "1 banana" },
                { "alimento": "mel", "g": 20 },
                { "alimento": "cafe", "g": 50 }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

Notas de modelagem:

- `rotulo` permite exibir "1 banana" em vez de "Banana (100 g)" quando a
  unidade natural for mais legível.
- `kcal_plano` / `p_plano` são preservados para a validação da seção 4 e
  para exibir a divergência, se houver. O app **exibe o valor calculado**,
  não o do plano — senão a soma de ingredientes misturados não fecharia.
- A meta de carboidrato não é armazenada: é derivada em tempo de execução
  a partir de `kcal` e `p` pela fórmula da seção 5.3.
- `opcional: true` marca o lanche das 10h; `obrigatorio: true` marca o
  pré-natação das 16h de quarta e sexta, que o plano destaca com ⚠️.
- Refeições e horários **variam por dia** (quarta tem "Pré-natação 16h00"
  e "Jantar pós-natação 20h30"; segunda tem "Lanche 17h30"). O modelo é
  por dia, nunca global.

### 5.3 Meta de carboidrato

O plano não prescreve carboidrato. A meta é derivada, e a derivação é
explícita e visível no app (rodapé da tela Semana):

```
gordura_alvo = 25% das kcal do dia        (padrão para atleta endurance)
carbo_alvo   = (kcal_dia − p_dia×4 − gordura_alvo) / 4
```

Segunda: (2507 − 203×4 − 627) / 4 = **267 g**
Sábado:  (2952 − 218×4 − 738) / 4 = **336 g**

O app rotula essa meta como **derivada**, não prescrita, para não induzir
o atleta a tratá-la com o mesmo peso das metas de kcal e proteína.

## 6. Telas

### 6.1 Hoje (principal)

- Abre no dia da semana corrente, já com o perfil correto no cabeçalho
  (sessão, kcal-alvo, proteína-alvo). Seletor de dia permite navegar.
- **Topo pegajoso:** três barras — kcal, proteína, carbo — visíveis
  durante todo o scroll. Números grandes: consumido / meta.
- **Alerta assimétrico:** acima da meta é neutro (verde). Abaixo acende
  amarelo (<90%) e vermelho (<75%). Decisão fundamentada no texto do
  plano: o risco do atleta é déficit, não excesso.
- As 7 refeições empilhadas na ordem do relógio, cada uma com hora,
  estado (vazia / parcial / completa) e subtotal.
- Tocar numa refeição expande as 3 opções. **Cada ingrediente é um alvo
  de toque independente, e o atleta pode marcar itens de A, B e C ao mesmo
  tempo.** Não existe conceito de "escolher uma opção" — as opções são
  agrupamentos visuais sugeridos, não seleções mutuamente exclusivas.
- Ingrediente marcado: fundo verde, tipografia em peso maior. Toque de
  novo desmarca.

### 6.2 Sugestão de fechamento

Dentro de cada refeição ainda não registrada, o app calcula quanto falta
de cada macro e quantas refeições restam no dia, e **ordena as três
opções por quão bem cada uma aproxima o atleta da meta**, marcando a
melhor. Acima da lista, uma linha de texto: *"faltam 62 g de proteína em
2 refeições"*.

Função de aderência para ordenar (menor é melhor):

```
custo = |déficit_p_após − 0| × 2  +  |déficit_kcal_após| / 100
```

Proteína pesa o dobro: é o macro que o plano trata como inegociável
(2,9 g/kg, e o texto proíbe reduzir a do café da manhã e a da ceia).

Isto é uma **sugestão, nunca uma imposição** — as três opções continuam
igualmente acessíveis e clicáveis.

### 6.3 Combustível de treino

**Correção de defeito da revisão de 2026-09-09.** A versão anterior desta
spec mandou o combustível de treino para fora do escopo. Medição
posterior mostrou que isso quebra o sábado:

| Sábado — soma das refeições comestíveis | Meta do plano | Déficit |
|---|---|---|
| 2688 / 2643 / 2778 kcal (sempre A / B / C) | 2952 kcal | **174 a 309 kcal** |

O déficit é a linha **"Durante o pedal · a partir de 60 min ⚠️"**, a única
refeição do plano expressa em `g carbo/h` em vez de kcal. A regra
registrada é explícita: *"Bike 2h+/brick: gel + Energy Kick + Saltz já são
a linha 'Durante o pedal' do cardápio — não somam ao resto do dia."*
"Não somar" significa "não adicionar por cima", não "não contar".

Excluí-la produziria o pior resultado possível: **todo sábado abriria em
vermelho**, no maior dia de treino, para um atleta cujo risco declarado é
déficit. E erraria o carboidrato exatamente no dia em que o plano manda
colocá-lo no topo.

**Modelo:** uma seção "Combustível de treino" existe em **todos os dias**,
não só no sábado — o atleta troca o dia do treino com frequência (pode
fazer a bike na quarta). Um conceito só, sem caso especial e sem risco de
contagem dupla.

- **No sábado:** aparece expandida e marcada ⚠️ obrigatória, na posição da
  linha "Durante o pedal". A meta de 2952 kcal conta com ela.
- **Nos demais dias:** recolhida e discreta. Se usada, soma normalmente e
  o dia passa da meta — o que o alerta assimétrico trata como verde, e é
  o comportamento correto: se pedalou 2h, gastou.

**Itens (valores de rótulo conferidos em 07/Set/2026):**

| Item | Toque | kcal | Carbo | Origem do valor |
|---|---|---|---|---|
| +1h de pedal | 1 por hora | 180 | 45 g | Média das 3 opções do plano (~50/45/40 g carbo/h) |
| DUX Energy Kick (sachê 30 g) | 1 | 137 | 30 g | Rótulo |
| Saltz Z2 (dose 15 g) | 1 | 44 | 11 g | Rótulo (+1000 mg sódio) |

O item "+1h de pedal" é composto e derivado do próprio plano, não de
rótulo — é assim que se evita inventar número. O gel Z2 isolado **não**
entra como item: seu rótulo não foi conferido, e ele já está dentro do
composto por hora.

Sub-rótulo permanente na seção: *"Saltz: 1 dose/h · ~1000 mg sódio/h"*.

Nos pré-treinos, uma linha discreta: *"Se usar Energy Kick, ele substitui
esta refeição — não some os dois."* Sem lógica nova; corrige um erro que
o atleta cometia na prática (somava o Energy Kick ao pré-treino do
cardápio, dobrando o carbo).

**Item em aberto:** o rótulo do gel Z2 nunca foi conferido. Não bloqueia a
v1, porque o composto por hora vem do plano.

### 6.4 Trocar o perfil do dia

O atleta às vezes move o treino de dia. Além de navegar entre os dias, o
seletor oferece **"usar este dia como hoje"**: registrar a quarta contra o
cardápio e a meta da terça, se foi a bike que ele fez. Guardado junto com
o dia (`perfil: "ter"`), e a tela Semana mostra o perfil efetivamente
usado, não o do calendário.

### 6.5 Extra

Botão `+ Extra` fixo no rodapé. Abre uma folha com lista de porções
prontas, cada uma com macro já definido. Semente inicial (~15 itens):
pão de queijo, fatia de pizza, lata de cerveja, taça de vinho, açaí
300 ml, brigadeiro, pastel, coxinha, barra de chocolate, sorvete 1 bola,
refrigerante lata, salgado de padaria, tapioca de rua, pão francês com
manteiga, pipoca de cinema. Um toque adiciona ao dia.

Ordenação por frequência de uso do próprio atleta: o que ele mais usa
sobe. Contagem em localStorage. Extras aparecem numa seção própria no fim
do dia, separados do plano, e somam normalmente nas barras.

### 6.6 Semana

- Aderência ao plano em % (ingredientes marcados / previstos).
- Médias de kcal, proteína e carbo vs meta, por dia e da semana.
- Quais refeições o atleta mais pula — o dado que o plano precisa para se
  corrigir (o texto já suspeita do lanche das 10h e do pré-natação).
- Nota explicando a derivação da meta de carbo.
- **Exportar JSON** — arquivo que alimenta a revisão do plano do mês
  seguinte, para que a prescrição passe a ser calibrada pelo consumo real.

## 7. Persistência

`localStorage`, uma chave por dia: `pa:2026-09-10`.

```json
{
  "marcados": ["pre:A:banana", "pre:A:mel", "pos:B:whey"],
  "extras": [{ "id": "pao_de_queijo", "qtd": 2, "ts": 1757500000 }]
}
```

Chave de ingrediente: `refeicaoId:letra:alimento`. Estável entre versões
do app; muda apenas se o plano do mês mudar, o que é o comportamento
desejado.

**Risco aceito:** limpar dados do Safari apaga o histórico. Mitigação:
botão Exportar JSON na tela Semana, e um aviso no primeiro uso. Nenhuma
sincronização em nuvem na v1.

## 8. Testes

Sem framework. Um arquivo `testes.html` que roda no navegador e imprime
resultados, cobrindo a lógica pura (calculadora de macros, ordenação de
opções, derivação de meta) — a camada onde erro é silencioso e caro:

1. **Validação do plano (seção 4):** as 147 opções, desvio individual
   ≤8% e médio ≤4%. Este é o teste mais importante do projeto.
2. **Soma de ingredientes:** marcar itens de A e B na mesma refeição soma
   corretamente e não conta nada duas vezes.
3. **Derivação de carbo:** os 7 dias produzem os valores da seção 5.3.
4. **Alerta assimétrico:** 110% da meta → verde; 85% → amarelo; 70% →
   vermelho.
5. **Ordenação de opções:** com déficit alto de proteína, a opção de maior
   proteína é marcada como melhor.
6. **Persistência:** marcar, recarregar a página, estado preservado; virar
   o dia, dia novo começa vazio e o anterior permanece no histórico.

Teste manual obrigatório antes de publicar: abrir no Safari do iPhone,
adicionar à tela de início, ativar modo avião, confirmar que abre e
registra offline.

## 9. Publicação

Repositório público `HLanfesp/plano-alimentar`, GitHub Pages na branch
`main`, servindo da raiz. URL: `https://hlanfesp.github.io/plano-alimentar`.

Público implica que qualquer pessoa com o link vê o plano alimentar —
aceito explicitamente pelo atleta. Nenhum dado de consumo sai do
iPhone: o repositório contém apenas o plano prescrito e o código.

## 10. Atualização mensal

Outubro chega em 3 semanas. O fluxo é: eu gero `plano-2026-10.json` a
partir do HTML do plano novo, o atleta faz commit do arquivo, e o app
oferece o mês novo. `index.html` não é tocado. Um seletor de mês permite
consultar meses anteriores.

Para isso, um script `ferramentas/extrair-plano.py` converte o HTML do
plano em JSON, resolvendo nomes de ingredientes contra `alimentos.json` e
reportando qualquer ingrediente desconhecido em vez de adivinhar.

## 11. Fora de escopo (v1)

Adiado deliberadamente, não esquecido:

- Suplementação (ômega-3, magnésio, creatina, vitamina D) — não afeta
  macro, nada a somar. O combustível de treino, que a revisão anterior
  colocava aqui, foi movido para dentro do escopo: ver §6.3.
- Ajuste de porção (½ · 1× · 1½).
- Gordura e fibra no dashboard.
- Sincronização em nuvem, login, notificações.
- Integração com Garmin ou HealthKit.
