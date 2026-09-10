// Resumo da semana: não lê nada do DOM, só soma o que o armazenamento
// já guardou dia a dia. `perfil` manda sobre o dia do calendário — se o
// atleta trocou o cardápio daquela data, é contra esse cardápio que o
// registro entra na conta, não contra o dia real da semana.
import { calcularItens, chaveIngrediente, estadoDa } from './nutricao.js';

const CHAVES_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

function diaDaSemana(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return CHAVES_DIA[new Date(ano, mes - 1, dia).getDay()];
}

const comestiveis = diaPlano => diaPlano.refeicoes.filter(r => r.tipo !== 'combustivel');

const zero = () => ({ kcal: 0, p: 0, c: 0 });

function somar(acc, macros) {
  acc.kcal += macros.kcal; acc.p += macros.p; acc.c += macros.c;
  return acc;
}

export function resumoSemana(dias, plano, alimentos) {
  const perfisUsados = {};
  let totalRefeicoes = 0;
  let totalCompletas = 0;
  let diasContados = 0;
  const somaMacros = zero();
  const puladasPorRefeicao = new Map(); // id -> { nome, vezes }

  for (const [data, registro] of Object.entries(dias)) {
    const perfilUsado = registro.perfil && plano.dias[registro.perfil]
      ? registro.perfil
      : diaDaSemana(data);
    perfisUsados[data] = perfilUsado;

    const diaPlano = plano.dias[perfilUsado];
    if (!diaPlano) continue;

    diasContados += 1;
    const marcados = new Set(registro.marcados || []);
    const refeicoes = comestiveis(diaPlano);

    for (const refeicao of refeicoes) {
      totalRefeicoes += 1;
      const estado = estadoDa(refeicao, marcados);
      if (estado === 'completa') totalCompletas += 1;

      if (!puladasPorRefeicao.has(refeicao.id)) {
        puladasPorRefeicao.set(refeicao.id, { nome: refeicao.nome, vezes: 0 });
      }
      if (estado === 'vazia') puladasPorRefeicao.get(refeicao.id).vezes += 1;

      for (const opcao of refeicao.opcoes) {
        for (const item of opcao.itens) {
          if (!item.alimento || !alimentos[item.alimento]) continue;
          const chave = chaveIngrediente(refeicao.id, opcao.letra, item.alimento);
          if (!marcados.has(chave)) continue;
          somar(somaMacros, calcularItens([item], alimentos));
        }
      }
    }
  }

  const aderencia = totalRefeicoes > 0 ? Math.round((totalCompletas / totalRefeicoes) * 100) : 0;
  const divisor = Math.max(diasContados, 1);

  const refeicoesMaisPuladas = [...puladasPorRefeicao.values()]
    .sort((a, b) => b.vezes - a.vezes);

  return {
    aderencia,
    mediaKcal: diasContados > 0 ? Math.round(somaMacros.kcal / divisor) : 0,
    mediaP: diasContados > 0 ? Math.round(somaMacros.p / divisor) : 0,
    mediaC: diasContados > 0 ? Math.round(somaMacros.c / divisor) : 0,
    refeicoesMaisPuladas,
    perfisUsados,
  };
}
