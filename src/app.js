// Única camada que toca o DOM. Toda conta vive nos módulos importados:
// nutricao (macros de itens, chave do ingrediente e estado da refeição),
// metas (meta do dia e status assimétrico), sugestao (ordenar opções,
// resumo do que falta e fatia por refeição) e armazenamento (persistência
// no localStorage). Aqui só há leitura de dados, montagem de HTML e
// tratamento de toque.
import { calcularItens, chaveIngrediente, estadoDa, somarPorcao, somarExtrasDia, conflitosCombustivel } from './nutricao.js';
import { metaDoDia, statusMacro } from './metas.js';
import { ordenarOpcoes, resumoRestante, fatiaPorRefeicao } from './sugestao.js';
import { criarArmazenamento } from './armazenamento.js';
import { resumoSemana } from './semana.js';
import { escolherPlano } from './indice.js';

const CHAVES_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const NOME_DIA = {
  dom: 'Domingo', seg: 'Segunda', ter: 'Terça', qua: 'Quarta',
  qui: 'Quinta', sex: 'Sexta', sab: 'Sábado',
};
const CURTO_DIA = { dom: 'dom', seg: 'seg', ter: 'ter', qua: 'qua', qui: 'qui', sex: 'sex', sab: 'sáb' };
const ID_COMBUSTIVEL = '__combustivel';
// O trilho das barras mostra até 125% da meta, com a marca da meta a 80%
// da largura. Passar da meta fica visível e continua verde: o risco deste
// atleta é déficit, não excesso.
const TETO_TRILHO = 1.25;
// Sinal não-cromático das barras: quem não separa verde de amarelo lê o
// texto. Redundante com a cor de propósito, como já era nas refeições.
const SELO_STATUS = {
  verde: '✓ na meta',
  amarelo: '↓ baixo',
  vermelho: '↓↓ muito baixo',
};

const agora = new Date();
const HOJE = dataISO(agora);

// Duas funções distintas e cumulativas (§6.4 da spec):
//   dataAtiva — QUAL DATA está sendo vista e registrada (navegação);
//   perfil    — QUAL CARDÁPIO da semana vale nessa data ("usar este dia
//               como hoje", para quando o treino troca de dia).
// A tela precisa deixar claro qual das duas está em jogo, então cada uma
// tem seu próprio controle, seu próprio aviso e sua própria cor.
let dataAtiva = HOJE;
let perfil = null; // definido em irPara(), depois que o plano carrega
let limiteTras = HOJE;
let tela = 'hoje'; // 'hoje' ou 'semana'

let dados = null;
let abertas = new Set();

const arm = criarArmazenamento(window.localStorage, (erro, operacao) => mostrarFalha(erro, operacao));

const el = {
  falha: document.getElementById('falha'),
  datas: document.getElementById('datas'),
  cabecalho: document.getElementById('cabecalho'),
  dias: document.getElementById('dias'),
  barras: document.getElementById('barras'),
  refeicoes: document.getElementById('refeicoes'),
  folha: document.getElementById('folha'),
  listaExtras: document.getElementById('lista-extras'),
  abas: document.getElementById('abas'),
  telaHoje: document.getElementById('tela-hoje'),
  telaSemana: document.getElementById('tela-semana'),
  rodape: document.getElementById('rodape'),
};

// Quantos dias a tela Semana olha para trás, incluindo hoje.
const JANELA_SEMANA = 7;

// ---------- utilidades de formato e de data ----------

function dataISO(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function deISO(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function somarDias(iso, n) {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return dataISO(d);
}

const diaDaSemana = iso => CHAVES_DIA[deISO(iso).getDay()];
const exibirData = iso => deISO(iso).toLocaleDateString('pt-BR');

function distanciaEmDias(iso) {
  return Math.round((deISO(HOJE) - deISO(iso)) / 86400000);
}

function rotuloRelativo(iso) {
  const d = distanciaEmDias(iso);
  if (d === 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d === 2) return 'anteontem';
  return `há ${d} dias`;
}

const listar = nomes => nomes.length <= 1 ? (nomes[0] || '')
  : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = v => Math.round(v).toLocaleString('pt-BR');
const gramas = v => (Number.isInteger(v) ? v : Math.round(v)) + ' g';

function somar(acc, macros) {
  acc.kcal += macros.kcal; acc.p += macros.p; acc.c += macros.c; acc.g += macros.g || 0;
  return acc;
}

const zero = () => ({ kcal: 0, p: 0, c: 0, g: 0 });
const comestiveis = diaPlano => diaPlano.refeicoes.filter(r => r.tipo !== 'combustivel');
const linhaCombustivel = diaPlano => diaPlano.refeicoes.find(r => r.tipo === 'combustivel') || null;
const chaveDe = (refeicao, opcao, item) => chaveIngrediente(refeicao.id, opcao.letra, item.alimento);

function minutosDaHora(hora) {
  const m = /^(\d{1,2})h(\d{2})$/.exec(String(hora).trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// ---------- falha de armazenamento visível ----------

// Safari em navegação privada lança em setItem. Sem aviso, o atleta acha
// que marcou e não marcou. O aviso fica na tela até ele fechar.
function mostrarFalha(_erro, operacao) {
  if (!el.falha) return;
  el.falha.innerHTML = `
    <p><b>Não foi possível ${operacao === 'ler' ? 'ler o que já estava salvo' : 'salvar neste aparelho'}.</b>
    O que você tocar agora pode não ser guardado. No iPhone isso costuma ser
    navegação privada ou armazenamento bloqueado: saia da janela privada e
    recarregue.</p>
    <button type="button" data-acao="fechar-falha">Entendi</button>`;
  el.falha.hidden = false;
}

// ---------- carregamento ----------

async function lerJSON(caminho) {
  const resposta = await fetch(caminho);
  if (!resposta.ok) throw new Error(`falha ao carregar ${caminho}`);
  return resposta.json();
}

async function iniciar() {
  // O nome do arquivo do mes nao fica fixo aqui: vem do indice
  // (dados/indice.json), que lista todos os planos publicados. Assim, um
  // mes novo e so uma entrada nova no indice — nao precisa editar este
  // arquivo. escolherPlano() usa o mais recente que nao seja futuro.
  const indice = await lerJSON('dados/indice.json');
  const escolhido = escolherPlano(indice, HOJE);
  if (!escolhido) throw new Error('nenhum plano cadastrado em dados/indice.json');

  const [plano, alimentos, extras, combustivel] = await Promise.all([
    lerJSON(escolhido.arquivo),
    lerJSON('dados/alimentos.json'),
    lerJSON('dados/extras.json'),
    lerJSON('dados/combustivel.json'),
  ]);
  dados = { plano, alimentos, extras, combustivel };

  // Para trás só até o começo do mês do plano: antes disso o cardápio
  // carregado não é o daquele dia, e mostrá-lo seria mentira.
  limiteTras = `${plano.mes}-01`;
  irPara(HOJE, { render: false });

  document.addEventListener('click', aoTocar);
  renderizar();
}

// Troca a data vista/registrada e recarrega o perfil gravado nela.
function irPara(data, { render = true } = {}) {
  dataAtiva = data;
  const gravado = arm.lerDia(dataAtiva).perfil;
  perfil = gravado && dados.plano.dias[gravado] ? gravado : diaDaSemana(dataAtiva);
  abrirPadrao();
  if (render) renderizar();
}

function abrirPadrao() {
  abertas = new Set([refeicaoInicial()]);
  if (linhaCombustivel(dados.plano.dias[perfil])) abertas.add(ID_COMBUSTIVEL);
}

// Em dia passado o caso real é "esqueci de marcar o jantar": abre a última
// refeição. Hoje, abre a do relógio.
function refeicaoInicial() {
  const lista = comestiveis(dados.plano.dias[perfil]);
  if (dataAtiva !== HOJE) return lista[lista.length - 1].id;
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const candidata = lista.find(r => {
    const m = minutosDaHora(r.hora);
    return m !== null && minutosAgora <= m + 90;
  });
  return (candidata || lista[lista.length - 1]).id;
}

// ---------- estado calculado do dia ----------

function calcular() {
  const diaPlano = dados.plano.dias[perfil];
  const dia = arm.lerDia(dataAtiva);
  const meta = metaDoDia(diaPlano.meta);
  const marcados = new Set(dia.marcados);
  const total = zero();
  const porRefeicao = {};

  for (const refeicao of diaPlano.refeicoes) {
    const sub = zero();
    const contadas = new Set();
    for (const opcao of refeicao.opcoes) {
      for (const item of opcao.itens) {
        if (!item.alimento || !dados.alimentos[item.alimento]) continue;
        const chave = chaveDe(refeicao, opcao, item);
        if (!marcados.has(chave) || contadas.has(chave)) continue;
        contadas.add(chave);
        somar(sub, calcularItens([item], dados.alimentos));
      }
    }
    porRefeicao[refeicao.id] = { sub, estado: estadoDa(refeicao, marcados) };
    somar(total, sub);
  }

  somarExtrasDia(total, dia, dados.extras, dados.combustivel);

  const restantes = comestiveis(diaPlano).filter(r => porRefeicao[r.id].estado === 'vazia').length;

  return {
    dia, diaPlano, meta, marcados, total, porRefeicao, restantes,
    restantePorRefeicao: fatiaPorRefeicao(total, meta, restantes),
    conflitosCombustivel: conflitosCombustivel(dia, dados.combustivel),
  };
}

// ---------- render ----------

function renderizar() {
  renderAbas();
  el.telaHoje.hidden = tela !== 'hoje';
  el.telaSemana.hidden = tela !== 'semana';
  el.rodape.hidden = tela !== 'hoje';
  if (tela === 'semana') return renderSemana();

  const e = calcular();
  document.body.dataset.outraData = dataAtiva === HOJE ? '0' : '1';
  renderDatas();
  renderCabecalho(e);
  renderDias();
  renderBarras(e);
  renderRefeicoes(e);
  renderListaExtras();
}

function renderAbas() {
  el.abas.innerHTML = `
    <button type="button" data-tela="hoje" aria-selected="${tela === 'hoje'}">Hoje</button>
    <button type="button" data-tela="semana" aria-selected="${tela === 'semana'}">Semana</button>
  `;
}

// ---------- tela Semana ----------

// Janela de 7 dias terminando hoje, lida do que já está gravado no
// armazenamento. `resumoSemana` mede cada dia contra o perfil que ele
// gravou (§ perfil manda sobre o calendário), não contra o dia real.
function diasDaJanela() {
  const exportado = arm.exportar();
  const inicio = somarDias(HOJE, -(JANELA_SEMANA - 1));
  const diasSemana = {};
  for (const [data, registro] of Object.entries(exportado.dias)) {
    if (data >= inicio && data <= HOJE) diasSemana[data] = registro;
  }
  return diasSemana;
}

// Extras e combustível da janela, nos mesmos dias que `resumoSemana` contou
// (um dia só entra se o perfil gravado nele tiver plano — § perfisUsados).
// `resumoSemana` não pode ganhar essa conta porque sua assinatura não muda;
// é a mesma regra de `calcular()` na tela Hoje, só que somada ao longo da
// janela em vez de um único dia.
function extrasDaJanela(diasSemana, perfisUsados, plano) {
  const total = zero();
  let dias = 0;
  for (const [data, registro] of Object.entries(diasSemana)) {
    if (!plano.dias[perfisUsados[data]]) continue;
    dias += 1;
    somarExtrasDia(total, registro, dados.extras, dados.combustivel);
  }
  return { total, dias };
}

function renderSemana() {
  const diasSemana = diasDaJanela();
  const resumo = resumoSemana(diasSemana, dados.plano, dados.alimentos);

  // As médias de kcal/proteína/carbo de `resumo` só contam o cardápio
  // prescrito (de propósito — é o que alimenta `aderencia` e as refeições
  // puladas). Extras e combustível comidos fora do plano somam aqui por
  // cima, senão a tela Semana subestima o consumo real de quem comeu fora
  // do cardápio — e o risco declarado do atleta é déficit, não superávit.
  const extrasSemana = extrasDaJanela(diasSemana, resumo.perfisUsados, dados.plano);
  const divisorExtras = Math.max(extrasSemana.dias, 1);
  const mediaKcal = resumo.mediaKcal + Math.round(extrasSemana.total.kcal / divisorExtras);
  const mediaP = resumo.mediaP + Math.round(extrasSemana.total.p / divisorExtras);
  const mediaC = resumo.mediaC + Math.round(extrasSemana.total.c / divisorExtras);

  // Meta média da janela: a média do que cada dia registrado prescrevia,
  // usando o perfil que valeu naquele dia (troca de cardápio incluída).
  const perfisContados = Object.values(resumo.perfisUsados).filter(p => dados.plano.dias[p]);
  const metaMedia = perfisContados.length > 0
    ? perfisContados.reduce((acc, p) => {
        const m = metaDoDia(dados.plano.dias[p].meta);
        acc.kcal += m.kcal; acc.p += m.p; acc.c += m.c;
        return acc;
      }, zero())
    : zero();
  if (perfisContados.length > 0) {
    metaMedia.kcal /= perfisContados.length;
    metaMedia.p /= perfisContados.length;
    metaMedia.c /= perfisContados.length;
  }

  const puladas = resumo.refeicoesMaisPuladas.filter(r => r.vezes > 0).slice(0, 5);

  el.telaSemana.innerHTML = `
    <section class="semana-cartao">
      <h2>Aderência nos últimos ${JANELA_SEMANA} dias</h2>
      <p class="semana-aderencia">${n0(resumo.aderencia)}%<span>das refeições do plano, completas</span></p>
      <p class="semana-nota">Refeições <b>opcionais não contam</b>${resumo.opcionaisIgnoradas.length > 0
        ? ` (${esc(resumo.opcionaisIgnoradas.join(', '))})` : ''}: o plano diz para não forçar
        essa refeição, então pular não é falha de aderência.</p>
    </section>
    <section class="semana-cartao">
      <h2>Médias do dia vs. meta</h2>
      <div class="semana-grid">
        ${semanaMetrica('kcal', mediaKcal, metaMedia.kcal, '')}
        ${semanaMetrica('proteína', mediaP, metaMedia.p, ' g')}
        ${semanaMetrica('carbo', mediaC, metaMedia.c, ' g')}
      </div>
      <p class="semana-nota">A meta de carbo é <b>derivada</b>: o plano só prescreve kcal e
        proteína, e o carbo sai do que sobra das kcal depois da proteína e de uma
        gordura assumida em 25%. Não é número do nutricionista, é conta do app.</p>
      <p class="semana-nota">Extras e combustível de treino <b>não trazem gordura nos dados</b>,
        então ficam fora dessa premissa de 25%: num dia de muito extra ou muito pedal, a meta
        de carbo está um pouco mais frouxa do que a conta sugere.</p>
    </section>
    <section class="semana-cartao">
      <h2>Refeições mais puladas</h2>
      ${puladas.length > 0
        ? `<div class="semana-lista">${puladas.map(r => `
            <div class="semana-linha">
              <span>${esc(r.nome)}</span>
              <span class="vezes num">${r.vezes}×</span>
            </div>`).join('')}</div>`
        : '<p class="semana-vazio">Nenhuma refeição ficou de fora nesta janela.</p>'}
    </section>
    <section class="semana-cartao">
      <h2>Exportar</h2>
      <p class="semana-nota">Baixa tudo o que foi registrado neste aparelho — marcações,
        extras, combustível e trocas de perfil — para o nutricionista calibrar o plano do
        mês seguinte pelo consumo real.</p>
      <button type="button" class="semana-exportar" data-acao="exportar-json">Exportar JSON</button>
    </section>
  `;
}

function exportarJSON() {
  const exportado = arm.exportar();
  const texto = JSON.stringify(exportado, null, 2);
  const blob = new Blob([texto], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plano-alimentar-${HOJE}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function semanaMetrica(rotulo, valor, meta, unidade) {
  return `
    <div class="semana-metrica">
      <span class="rotulo">${esc(rotulo)}</span>
      <span class="valor num">${n0(valor)}${unidade}</span>
      <span class="meta num">meta ${n0(meta)}${unidade}</span>
    </div>`;
}

// Controle 1: navegar entre datas. Só toques, nenhum campo de data.
function renderDatas() {
  const outraData = dataAtiva !== HOJE;
  const podeVoltar = dataAtiva > limiteTras;
  const podeAvancar = outraData;
  el.datas.innerHTML = `
    <div class="datas-linha">
      <button type="button" data-navegar="-1" ${podeVoltar ? '' : 'disabled'}
        aria-label="Dia anterior">‹</button>
      <span class="datas-centro">
        <span class="datas-dia">${esc(NOME_DIA[diaDaSemana(dataAtiva)])}</span>
        <span class="datas-num num">${esc(exibirData(dataAtiva))}</span>
        <span class="datas-selo" data-outra="${outraData ? 1 : 0}">${esc(rotuloRelativo(dataAtiva))}</span>
      </span>
      <button type="button" data-navegar="1" ${podeAvancar ? '' : 'disabled'}
        aria-label="Dia seguinte">›</button>
    </div>
    ${outraData ? `
      <div class="datas-aviso" role="status">
        <span>Você está <b>vendo e registrando ${esc(rotuloRelativo(dataAtiva))}</b>,
          ${esc(exibirData(dataAtiva))}. O que marcar entra nesta data.</span>
        <button type="button" data-acao="voltar-hoje">Voltar para hoje</button>
      </div>` : ''}
  `;
}

function renderCabecalho({ diaPlano, meta }) {
  const trocado = perfil !== diaDaSemana(dataAtiva);
  el.cabecalho.innerHTML = `
    <div class="sessao">
      <span class="emoji" aria-hidden="true">${esc(diaPlano.sessao || '')}</span>
      <h1>${esc(diaPlano.rotulo)}</h1>
    </div>
    <p class="alvos">Alvo do dia: <b class="num">${n0(meta.kcal)}</b> kcal ·
      <b class="num">${n0(meta.p)}</b> g de proteína ·
      <b class="num">${n0(meta.c)}</b> g de carbo <span title="derivado">(derivado)</span></p>
    ${trocado
      ? `<p class="aviso-perfil">Usando o cardápio de ${esc(NOME_DIA[perfil].toLowerCase())} neste dia
           <button type="button" data-acao="soltar-perfil">desfazer</button></p>`
      : ''}
  `;
}

// Controle 2: "usar este dia como hoje" — troca o cardápio, não a data.
function renderDias() {
  const doCalendario = diaDaSemana(dataAtiva);
  el.dias.innerHTML = `
    <p class="dias-titulo">Cardápio usado ${esc(rotuloRelativo(dataAtiva))}
      <span>toque se o treino trocou de dia</span></p>
    <div class="dias-tira">
      ${CHAVES_DIA.slice(1).concat('dom').map(d => `
        <button type="button" data-dia="${d}" data-calendario="${d === doCalendario ? 1 : 0}"
          aria-pressed="${d === perfil}">${esc(CURTO_DIA[d])}</button>
      `).join('')}
    </div>`;
}

function renderBarras({ total, meta }) {
  el.barras.innerHTML = [
    barra('kcal', total.kcal, meta.kcal, ''),
    barra('proteína', total.p, meta.p, ' g'),
    barra('carbo', total.c, meta.c, ' g', 'derivado'),
  ].join('');
}

function barra(rotulo, consumido, meta, unidade, nota) {
  const status = statusMacro(consumido, meta);
  const largura = meta > 0 ? Math.min(consumido / meta, TETO_TRILHO) / TETO_TRILHO * 100 : 0;
  return `
    <div class="barra">
      <span class="rotulo">${esc(rotulo)}${nota ? ` · ${esc(nota)}` : ''}
        <span class="selo-status" data-status="${status}">${esc(SELO_STATUS[status])}</span></span>
      <span class="valor num">${n0(consumido)}<span class="meta"> / ${n0(meta)}${unidade}</span></span>
      <div class="trilho" role="img"
        aria-label="${esc(rotulo)}: ${n0(consumido)} de ${n0(meta)}${unidade}, ${status}">
        <div class="excedente"></div>
        <div class="cheio" data-status="${status}" style="width:${largura.toFixed(1)}%"></div>
        <div class="marca"></div>
      </div>
    </div>`;
}

function renderRefeicoes(e) {
  const partes = [];
  let combustivelPosicionado = false;
  for (const refeicao of e.diaPlano.refeicoes) {
    if (refeicao.tipo === 'combustivel') {
      partes.push(secaoCombustivel(e, refeicao));
      combustivelPosicionado = true;
    } else {
      partes.push(cartaoRefeicao(e, refeicao));
    }
  }
  if (!combustivelPosicionado) partes.push(secaoCombustivel(e, null));
  partes.push(secaoExtras(e));
  el.refeicoes.innerHTML = partes.join('');
}

function cartaoRefeicao(e, refeicao) {
  const { sub, estado } = e.porRefeicao[refeicao.id];
  const aberta = abertas.has(refeicao.id);
  const naoRegistrada = estado === 'vazia';
  const ordenadas = naoRegistrada
    ? ordenarOpcoes(refeicao.opcoes, e.restantePorRefeicao, dados.alimentos).map(o => o.opcao)
    : refeicao.opcoes;

  const subtitulo = naoRegistrada
    ? 'nada marcado'
    : `${n0(sub.kcal)} kcal · ${n0(sub.p)} g P${estado === 'completa' ? ' · completa' : ' · parcial'}`;

  const corpo = aberta ? `
    <div class="corpo">
      ${naoRegistrada ? `<p class="resumo">${esc(resumoRestante(e.total, e.meta, Math.max(e.restantes, 1)))}</p>` : ''}
      ${refeicao.id.startsWith('pre_treino')
        ? '<p class="nota">Se usar Energy Kick, ele substitui esta refeição — não some os dois.</p>'
        : ''}
      ${ordenadas.map((opcao, i) => blocoOpcao(e, refeicao, opcao, naoRegistrada && i === 0)).join('')}
    </div>` : '';

  return `
    <section class="refeicao" data-estado="${estado}">
      <button type="button" class="cabeca" data-refeicao="${esc(refeicao.id)}" aria-expanded="${aberta}">
        <span class="hora num">${esc(refeicao.hora)}</span>
        <span class="nome">${esc(refeicao.nome)}${etiquetas(refeicao)}</span>
        <span class="sub" data-estado="${estado}"><span class="ponto" data-estado="${estado}"></span>${esc(subtitulo)}</span>
        <span class="seta" aria-hidden="true">›</span>
      </button>
      ${corpo}
    </section>`;
}

// As etiquetas saem do dado, nunca de regra escrita na interface.
function etiquetas(refeicao) {
  return [
    refeicao && refeicao.obrigatorio ? '<span class="tag" data-tipo="obrigatorio">⚠️ obrigatório</span>' : '',
    refeicao && refeicao.opcional ? '<span class="tag">opcional</span>' : '',
  ].join('');
}

function blocoOpcao(e, refeicao, opcao, melhor) {
  const itens = opcao.itens.map(item => {
    if (!item.alimento || !dados.alimentos[item.alimento]) {
      return `<p class="bruto">• ${esc(item.raw || item.alimento || '')}</p>`;
    }
    const chave = chaveDe(refeicao, opcao, item);
    const marcado = e.marcados.has(chave);
    const nome = item.rotulo || dados.alimentos[item.alimento].nome;
    return `
      <button type="button" class="ing" data-chave="${esc(chave)}" aria-pressed="${marcado}">
        <span class="caixa" aria-hidden="true">✓</span>
        <span class="texto">${esc(nome)}</span>
        <span class="g num">${esc(gramas(item.g))}</span>
      </button>`;
  }).join('');

  const planejado = opcao.kcal_plano != null
    ? `<span>${n0(opcao.kcal_plano)} kcal · ${n0(opcao.p_plano)} g P</span>` : '';

  return `
    <div class="opcao">
      <h4><span class="letra">${esc(opcao.letra)}</span>${planejado}
        ${melhor ? '<span class="melhor">melhor agora</span>' : ''}</h4>
      <div class="itens">${itens}</div>
    </div>`;
}

function secaoCombustivel(e, refeicaoPlano) {
  // Destaque e etiqueta vêm do plano: o dia que tem linha de combustível é
  // o dia do pedal longo, e "obrigatório" é campo do dado.
  const destaque = refeicaoPlano != null;
  const aberta = abertas.has(ID_COMBUSTIVEL);
  const usados = new Map(e.dia.combustivel.map(c => [c.id, c.qtd]));
  const consumido = zero();
  for (const [id, qtd] of usados) somarPorcao(consumido, dados.combustivel[id], qtd);
  const algum = [...usados.values()].some(q => q > 0);

  // Os três itens não são empilháveis: `hora_pedal` já contém Energy Kick e
  // Saltz (§ conflitosCombustivel em nutricao.js). O "+" do lado conflitante
  // fica desativado e o motivo aparece escrito na linha — dobrar o carbo em
  // silêncio é o defeito que o app existe para não repetir.
  const { bloqueados, sobrepostos, temSobreposicao } = e.conflitosCombustivel;

  const doses = Object.entries(dados.combustivel).map(([id, item]) => {
    const qtd = usados.get(id) || 0;
    const ocupante = bloqueados.get(id);
    // O motivo nomeia os dois lados: quem está bloqueado e o que já ocupa a
    // conta. Se o bloqueado é o composto, lista os itens dele já marcados.
    const contidosAtivos = (item.inclui || [])
      .filter(outro => (usados.get(outro) || 0) > 0)
      .map(outro => dados.combustivel[outro].nome);
    const motivo = !ocupante ? ''
      : contidosAtivos.length > 0
        ? `${listar(contidosAtivos)} já ${contidosAtivos.length > 1 ? 'estão' : 'está'} contado${contidosAtivos.length > 1 ? 's' : ''} aqui — não some os dois.`
        : `Já está dentro de “${dados.combustivel[ocupante].nome}” — não some os dois.`;
    return linhaContador({
      id, nome: item.nome,
      sublabel: `${item.sublabel} · ${n0(item.kcal)} kcal · ${n0(item.c)} g C`,
      qtd, atributoMais: 'data-dose', atributoMenos: 'data-remover-dose', cor: 'teal',
      textoQtd: `${qtd}× ${rotuloRelativo(dataAtiva)}`,
      bloqueado: Boolean(ocupante), motivo,
      alerta: sobrepostos.has(id),
    });
  }).join('');

  const brutos = refeicaoPlano
    ? refeicaoPlano.opcoes.map(o => `<p class="bruto">${esc(o.letra)}: ${esc(o.itens.map(i => i.raw || '').join(' + '))}</p>`).join('')
    : '';

  const aviso = temSobreposicao
    ? `<p class="aviso-dupla" role="status"><b>Isto está contando duas vezes.</b>
         Energy Kick e Saltz <b>já estão dentro da hora de pedal</b> — não some os dois.
         Use o − para desfazer um dos lados.</p>`
    : '';

  return `
    <section class="combustivel" data-destaque="${destaque ? 1 : 0}">
      <button type="button" class="cabeca" data-refeicao="${ID_COMBUSTIVEL}" aria-expanded="${aberta}">
        <span class="hora num">${esc(refeicaoPlano ? refeicaoPlano.hora : 'se pedalar')}</span>
        <span class="nome">Combustível de treino${etiquetas(refeicaoPlano)}</span>
        <span class="sub" data-estado="${algum ? 'parcial' : 'vazia'}"><span class="ponto" data-estado="${algum ? 'completa' : 'vazia'}"></span>${algum ? `${n0(consumido.kcal)} kcal · ${n0(consumido.c)} g C` : 'nada marcado'}</span>
        <span class="seta" aria-hidden="true">›</span>
      </button>
      ${aberta ? `<div class="corpo">
        <p class="comb-sub">Saltz: 1 dose/h · ~1000 mg sódio/h. Um toque no + conta mais uma; no − desfaz.</p>
        <p class="nota">Energy Kick e Saltz <b>já estão dentro da hora de pedal</b> — não some os dois.
          Conte a hora de pedal <b>ou</b> os sachês, nunca os dois.</p>
        ${aviso}
        <div class="doses">${doses}</div>
        ${brutos ? `<p class="nota">No plano: </p>${brutos}` : ''}
      </div>` : ''}
    </section>`;
}

// Linha com contador: + para somar, − para desfazer. O − só aparece quando
// há algo para desfazer, e tem 48 px de lado como todo alvo de toque.
// `textoQtd` existe porque o mesmo visual aparece em dois lugares com
// significados diferentes: a quantidade DESTA data e o total acumulado de
// todos os dias (§ folha "+ Extra"). O rótulo diz qual é.
// `bloqueado`/`motivo` servem ao combustível: o + que dobraria a conta fica
// desativado, com o motivo escrito ao lado — não só no código.
function linhaContador({
  id, nome, sublabel, qtd, atributoMais, atributoMenos, cor,
  textoQtd, bloqueado = false, motivo = '', alerta = false,
}) {
  const menos = qtd > 0
    ? `<button type="button" class="contador-menos" ${atributoMenos}="${esc(id)}"
         aria-label="Remover uma unidade de ${esc(nome)}">−</button>`
    : '';
  const rotuloQtd = textoQtd != null ? textoQtd : `${qtd}×`;
  const linhaMotivo = motivo
    ? `<p class="dose-motivo" data-alerta="${alerta ? 1 : 0}">${esc(motivo)}</p>`
    : '';
  return `
    <div class="dose" data-cor="${cor}" data-bloqueado="${bloqueado ? 1 : 0}" data-alerta="${alerta ? 1 : 0}">
      <button type="button" class="dose-mais" ${atributoMais}="${esc(id)}"
        ${bloqueado ? 'disabled aria-disabled="true"' : ''}
        aria-label="${bloqueado ? `${esc(nome)} indisponível: ${esc(motivo)}` : `Adicionar ${esc(nome)}`}">
        <span>
          <span class="nome-dose">${esc(nome)}</span><br>
          <span class="sublabel">${esc(sublabel)}</span>
        </span>
        <span class="qtd num" data-ativo="${qtd > 0 ? 1 : 0}">${esc(rotuloQtd)}</span>
        <span class="mais" aria-hidden="true">+</span>
      </button>
      ${menos}
    </div>
    ${linhaMotivo}`;
}

function secaoExtras({ dia }) {
  const linhas = dia.extras
    .filter(x => dados.extras[x.id])
    .map(x => {
      const item = dados.extras[x.id];
      return linhaContador({
        id: x.id, nome: item.nome,
        sublabel: `${n0(item.kcal * x.qtd)} kcal · ${n0(item.p * x.qtd)} g P`,
        qtd: x.qtd, atributoMais: 'data-extra', atributoMenos: 'data-remover-extra', cor: 'tinta',
        textoQtd: `${x.qtd}× ${rotuloRelativo(dataAtiva)}`,
      });
    }).join('');
  return `
    <section class="extras">
      <h3>Extras ${esc(rotuloRelativo(dataAtiva))}</h3>
      ${linhas
        ? `<div class="doses">${linhas}</div>`
        : '<p class="vazio">Nada fora do plano nesta data. Use “+ Extra” se comer algo a mais.</p>'}
    </section>`;
}

// O "N×" desta folha NÃO é o mesmo da seção "Extras" do dia: aqui é o total
// acumulado de todos os dias, usado para ordenar por frequência. Lá é a
// quantidade DAQUELA data. Mesmo visual, significados diferentes — então
// cada um diz por escrito qual é ("total 3×" contra "2× hoje"), senão o
// atleta lê "já registrei hoje" e deixa de registrar.
function renderListaExtras() {
  const uso = {};
  const exportado = arm.exportar();
  for (const d of Object.values(exportado.dias)) {
    for (const x of d.extras || []) uso[x.id] = (uso[x.id] || 0) + x.qtd;
  }
  el.listaExtras.innerHTML = Object.entries(dados.extras)
    .sort((a, b) => (uso[b[0]] || 0) - (uso[a[0]] || 0))
    .map(([id, item]) => `
      <button type="button" class="dose-mais solo" data-extra="${esc(id)}">
        <span>
          <span class="nome-dose">${esc(item.nome)}</span><br>
          <span class="sublabel">${esc(item.sublabel)} · ${n0(item.kcal)} kcal · ${n0(item.p)} g P</span>
        </span>
        <span class="qtd num total" data-ativo="${uso[id] ? 1 : 0}">total ${uso[id] || 0}×</span>
        <span class="mais" aria-hidden="true">+</span>
      </button>`).join('');
}

// ---------- toque ----------

function aoTocar(evento) {
  const alvo = evento.target.closest(
    '[data-chave],[data-refeicao],[data-dia],[data-dose],[data-remover-dose],' +
    '[data-extra],[data-remover-extra],[data-navegar],[data-acao],[data-tela]');
  if (!alvo) return;
  if (alvo.disabled) return;
  const d = alvo.dataset;

  if (d.tela) {
    tela = d.tela;
    return renderizar();
  }
  if (d.chave) {
    const marcado = alvo.getAttribute('aria-pressed') === 'true';
    if (marcado) arm.desmarcar(dataAtiva, d.chave);
    else arm.marcar(dataAtiva, d.chave);
    return renderizar();
  }
  if (d.refeicao) {
    if (abertas.has(d.refeicao)) abertas.delete(d.refeicao); else abertas.add(d.refeicao);
    return renderizar();
  }
  if (d.navegar) {
    const destino = somarDias(dataAtiva, Number(d.navegar));
    if (destino < limiteTras || destino > HOJE) return;
    return irPara(destino);
  }
  if (d.dia) {
    perfil = d.dia;
    arm.definirPerfil(dataAtiva, perfil);
    abrirPadrao();
    return renderizar();
  }
  if (d.removerDose) { arm.removerCombustivel(dataAtiva, d.removerDose); return renderizar(); }
  if (d.dose) {
    // Mesma regra do render, aplicada de novo no toque: o `disabled` é
    // aparência, a regra é que manda. Somar aqui dobraria o carbo da hora
    // de pedal — é o defeito que não pode voltar por um caminho lateral.
    const conflitos = conflitosCombustivel(arm.lerDia(dataAtiva), dados.combustivel);
    if (conflitos.bloqueados.has(d.dose)) return;
    arm.addCombustivel(dataAtiva, d.dose);
    return renderizar();
  }
  if (d.removerExtra) { arm.removerExtra(dataAtiva, d.removerExtra); return renderizar(); }
  if (d.extra) { arm.addExtra(dataAtiva, d.extra); return renderizar(); }
  if (d.acao === 'voltar-hoje') return irPara(HOJE);
  if (d.acao === 'soltar-perfil') {
    perfil = diaDaSemana(dataAtiva);
    arm.definirPerfil(dataAtiva, null);
    abrirPadrao();
    return renderizar();
  }
  if (d.acao === 'abrir-extras') { el.folha.dataset.aberta = '1'; return; }
  if (d.acao === 'fechar-extras') { el.folha.dataset.aberta = '0'; return; }
  if (d.acao === 'fechar-falha') { el.falha.hidden = true; return; }
  if (d.acao === 'exportar-json') { exportarJSON(); return; }
}

iniciar().catch(erro => {
  el.refeicoes.innerHTML = `<section class="extras"><h3>Não foi possível abrir o dia</h3>
    <p class="vazio">${esc(erro.message)}. Sirva a pasta com um servidor local: <b>python3 -m http.server 8000</b>.</p></section>`;
});

// PWA: registra o service worker que guarda o app em cache para abrir
// sem rede (5h da manhã antes do treino, 22h na ceia). Se o registro
// falhar (ex.: navegador sem suporte), o app continua funcionando online.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
