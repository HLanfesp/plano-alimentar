// Única camada que toca o DOM. Toda conta vive nos módulos importados:
// nutricao (macros de itens), metas (meta do dia e status assimétrico),
// sugestao (ordenar opções e resumo do que falta) e armazenamento
// (persistência no localStorage). Aqui só há leitura de dados, montagem
// de HTML e tratamento de toque.
import { calcularItens } from './nutricao.js';
import { metaDoDia, statusMacro } from './metas.js';
import { ordenarOpcoes, resumoRestante } from './sugestao.js';
import { criarArmazenamento } from './armazenamento.js';

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

const arm = criarArmazenamento(window.localStorage);
const agora = new Date();
const HOJE = dataISO(agora);
const DIA_CALENDARIO = CHAVES_DIA[agora.getDay()];

let dados = null;
let perfil = DIA_CALENDARIO;
let abertas = new Set();

const el = {
  cabecalho: document.getElementById('cabecalho'),
  dias: document.getElementById('dias'),
  barras: document.getElementById('barras'),
  refeicoes: document.getElementById('refeicoes'),
  folha: document.getElementById('folha'),
  listaExtras: document.getElementById('lista-extras'),
};

// ---------- utilidades de formato ----------

function dataISO(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = v => Math.round(v).toLocaleString('pt-BR');
const gramas = v => (Number.isInteger(v) ? v : Math.round(v)) + ' g';

function somar(acc, macros) {
  acc.kcal += macros.kcal; acc.p += macros.p; acc.c += macros.c; acc.g += macros.g || 0;
  return acc;
}

function somarPorcao(acc, porcao, qtd) {
  if (!porcao) return acc;
  acc.kcal += (porcao.kcal || 0) * qtd;
  acc.p += (porcao.p || 0) * qtd;
  acc.c += (porcao.c || 0) * qtd;
  acc.g += (porcao.g || 0) * qtd;
  return acc;
}

const zero = () => ({ kcal: 0, p: 0, c: 0, g: 0 });
const comestiveis = diaPlano => diaPlano.refeicoes.filter(r => r.tipo !== 'combustivel');
const chaveDe = (refeicao, opcao, item) => `${refeicao.id}:${opcao.letra}:${item.alimento}`;

function minutosDaHora(hora) {
  const m = /^(\d{1,2})h(\d{2})$/.exec(String(hora).trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// ---------- carregamento ----------

async function lerJSON(caminho) {
  const resposta = await fetch(caminho);
  if (!resposta.ok) throw new Error(`falha ao carregar ${caminho}`);
  return resposta.json();
}

async function iniciar() {
  const [plano, alimentos, extras, combustivel] = await Promise.all([
    lerJSON('dados/plano-2026-09.json'),
    lerJSON('dados/alimentos.json'),
    lerJSON('dados/extras.json'),
    lerJSON('dados/combustivel.json'),
  ]);
  dados = { plano, alimentos, extras, combustivel };

  const gravado = arm.lerDia(HOJE).perfil;
  perfil = gravado && plano.dias[gravado] ? gravado : DIA_CALENDARIO;

  abertas = new Set([proximaRefeicao()]);
  if (perfil === 'sab') abertas.add(ID_COMBUSTIVEL);

  document.addEventListener('click', aoTocar);
  renderizar();
}

function proximaRefeicao() {
  const lista = comestiveis(dados.plano.dias[perfil]);
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
  const dia = arm.lerDia(HOJE);
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
    porRefeicao[refeicao.id] = { sub, marcados: contadas.size, estado: estadoDa(refeicao, marcados, contadas.size) };
    somar(total, sub);
  }

  for (const e of dia.extras) somarPorcao(total, dados.extras[e.id], e.qtd);
  for (const c of dia.combustivel) somarPorcao(total, dados.combustivel[c.id], c.qtd);

  const restantes = comestiveis(diaPlano).filter(r => porRefeicao[r.id].marcados === 0).length;
  const fatia = Math.max(restantes, 1);
  // A ordenação compara cada opção com a fatia do que falta por refeição
  // ainda não registrada — não com o déficit inteiro do dia, que faria a
  // maior opção ganhar sempre.
  const restantePorRefeicao = {
    kcal: Math.max(0, meta.kcal - total.kcal) / fatia,
    p: Math.max(0, meta.p - total.p) / fatia,
  };

  return { dia, diaPlano, meta, marcados, total, porRefeicao, restantes, restantePorRefeicao };
}

function estadoDa(refeicao, marcados, quantos) {
  if (quantos === 0) return 'vazia';
  const completa = refeicao.opcoes.some(opcao => {
    const itens = opcao.itens.filter(i => i.alimento);
    return itens.length > 0 && itens.every(i => marcados.has(chaveDe(refeicao, opcao, i)));
  });
  return completa ? 'completa' : 'parcial';
}

// ---------- render ----------

function renderizar() {
  const e = calcular();
  renderCabecalho(e);
  renderDias();
  renderBarras(e);
  renderRefeicoes(e);
  renderListaExtras();
}

function renderCabecalho({ diaPlano, meta, dia }) {
  const trocado = perfil !== DIA_CALENDARIO;
  el.cabecalho.innerHTML = `
    <p class="data">${esc(NOME_DIA[DIA_CALENDARIO])} · ${esc(agora.toLocaleDateString('pt-BR'))}</p>
    <div class="sessao">
      <span class="emoji" aria-hidden="true">${esc(diaPlano.sessao || '')}</span>
      <h1>${esc(diaPlano.rotulo)}</h1>
    </div>
    <p class="alvos">Alvo do dia: <b class="num">${n0(meta.kcal)}</b> kcal ·
      <b class="num">${n0(meta.p)}</b> g de proteína ·
      <b class="num">${n0(meta.c)}</b> g de carbo <span title="derivado">(derivado)</span></p>
    ${trocado || dia.perfil
      ? `<p class="aviso-perfil">Registrando contra o cardápio de ${esc(NOME_DIA[perfil].toLowerCase())}</p>`
      : ''}
  `;
}

function renderDias() {
  el.dias.innerHTML = CHAVES_DIA.slice(1).concat('dom').map(d => `
    <button type="button" data-dia="${d}" data-hoje="${d === DIA_CALENDARIO ? 1 : 0}"
      aria-pressed="${d === perfil}">${esc(CURTO_DIA[d])}</button>
  `).join('');
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
      <span class="rotulo">${esc(rotulo)}${nota ? ` · ${esc(nota)}` : ''}</span>
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

  const etiquetas = [
    refeicao.obrigatorio ? '<span class="tag" data-tipo="obrigatorio">⚠️ obrigatório</span>' : '',
    refeicao.opcional ? '<span class="tag">opcional</span>' : '',
  ].join('');

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
        <span class="nome">${esc(refeicao.nome)}${etiquetas}</span>
        <span class="sub" data-estado="${estado}"><span class="ponto" data-estado="${estado}"></span>${esc(subtitulo)}</span>
        <span class="seta" aria-hidden="true">›</span>
      </button>
      ${corpo}
    </section>`;
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
  const sabado = perfil === 'sab';
  const aberta = abertas.has(ID_COMBUSTIVEL);
  const usados = new Map(e.dia.combustivel.map(c => [c.id, c.qtd]));
  const consumido = zero();
  for (const [id, qtd] of usados) somarPorcao(consumido, dados.combustivel[id], qtd);
  const algum = [...usados.values()].some(q => q > 0);

  const doses = Object.entries(dados.combustivel).map(([id, item]) => {
    const qtd = usados.get(id) || 0;
    return `
      <button type="button" class="dose" data-dose="${esc(id)}">
        <span>
          <span class="nome-dose">${esc(item.nome)}</span><br>
          <span class="sublabel">${esc(item.sublabel)} · ${n0(item.kcal)} kcal · ${n0(item.c)} g C</span>
        </span>
        <span class="qtd num" data-ativo="${qtd > 0 ? 1 : 0}">${qtd}×</span>
        <span class="mais" aria-hidden="true">+</span>
      </button>`;
  }).join('');

  const brutos = refeicaoPlano
    ? refeicaoPlano.opcoes.map(o => `<p class="bruto">${esc(o.letra)}: ${esc(o.itens.map(i => i.raw || '').join(' + '))}</p>`).join('')
    : '';

  return `
    <section class="combustivel" data-destaque="${sabado ? 1 : 0}">
      <button type="button" class="cabeca" data-refeicao="${ID_COMBUSTIVEL}" aria-expanded="${aberta}">
        <span class="hora num">${esc(refeicaoPlano ? refeicaoPlano.hora : 'se pedalar')}</span>
        <span class="nome">Combustível de treino${sabado ? '<span class="tag" data-tipo="obrigatorio">⚠️ obrigatório</span>' : ''}</span>
        <span class="sub" data-estado="${algum ? 'parcial' : 'vazia'}"><span class="ponto" data-estado="${algum ? 'completa' : 'vazia'}"></span>${algum ? `${n0(consumido.kcal)} kcal · ${n0(consumido.c)} g C` : 'nada marcado'}</span>
        <span class="seta" aria-hidden="true">›</span>
      </button>
      ${aberta ? `<div class="corpo">
        <p class="comb-sub">Saltz: 1 dose/h · ~1000 mg sódio/h. Cada toque conta mais uma.</p>
        <div class="doses">${doses}</div>
        ${brutos ? `<p class="nota">No plano: </p>${brutos}` : ''}
      </div>` : ''}
    </section>`;
}

function secaoExtras({ dia }) {
  const linhas = dia.extras
    .filter(x => dados.extras[x.id])
    .map(x => {
      const item = dados.extras[x.id];
      return `<li><span>${esc(item.nome)} ${x.qtd > 1 ? `<b>${x.qtd}×</b>` : ''}</span>
        <span class="num">${n0(item.kcal * x.qtd)} kcal</span></li>`;
    }).join('');
  return `
    <section class="extras">
      <h3>Extras do dia</h3>
      ${linhas ? `<ul>${linhas}</ul>` : '<p class="vazio">Nada fora do plano hoje. Use “+ Extra” se comer algo a mais.</p>'}
    </section>`;
}

function renderListaExtras() {
  const uso = {};
  const exportado = arm.exportar();
  for (const d of Object.values(exportado.dias)) {
    for (const x of d.extras || []) uso[x.id] = (uso[x.id] || 0) + x.qtd;
  }
  el.listaExtras.innerHTML = Object.entries(dados.extras)
    .sort((a, b) => (uso[b[0]] || 0) - (uso[a[0]] || 0))
    .map(([id, item]) => `
      <button type="button" class="dose" data-extra="${esc(id)}">
        <span>
          <span class="nome-dose">${esc(item.nome)}</span><br>
          <span class="sublabel">${esc(item.sublabel)} · ${n0(item.kcal)} kcal · ${n0(item.p)} g P</span>
        </span>
        <span class="qtd num" data-ativo="${uso[id] ? 1 : 0}">${uso[id] || 0}×</span>
        <span class="mais" aria-hidden="true">+</span>
      </button>`).join('');
}

// ---------- toque ----------

function aoTocar(evento) {
  const alvo = evento.target.closest('[data-chave],[data-refeicao],[data-dia],[data-dose],[data-extra],[data-acao]');
  if (!alvo) return;

  if (alvo.dataset.chave) {
    const marcado = alvo.getAttribute('aria-pressed') === 'true';
    if (marcado) arm.desmarcar(HOJE, alvo.dataset.chave);
    else arm.marcar(HOJE, alvo.dataset.chave);
    return renderizar();
  }
  if (alvo.dataset.refeicao) {
    const id = alvo.dataset.refeicao;
    if (abertas.has(id)) abertas.delete(id); else abertas.add(id);
    return renderizar();
  }
  if (alvo.dataset.dia) {
    perfil = alvo.dataset.dia;
    arm.definirPerfil(HOJE, perfil);
    abertas = new Set([proximaRefeicao()]);
    if (perfil === 'sab') abertas.add(ID_COMBUSTIVEL);
    return renderizar();
  }
  if (alvo.dataset.dose) { arm.addCombustivel(HOJE, alvo.dataset.dose); return renderizar(); }
  if (alvo.dataset.extra) { arm.addExtra(HOJE, alvo.dataset.extra); return renderizar(); }
  if (alvo.dataset.acao === 'abrir-extras') { el.folha.dataset.aberta = '1'; return; }
  if (alvo.dataset.acao === 'fechar-extras') { el.folha.dataset.aberta = '0'; return; }
}

iniciar().catch(erro => {
  el.refeicoes.innerHTML = `<section class="extras"><h3>Não foi possível abrir o dia</h3>
    <p class="vazio">${esc(erro.message)}. Sirva a pasta com um servidor local: <b>python3 -m http.server 8000</b>.</p></section>`;
});
