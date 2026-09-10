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

// A ordenação compara cada opção com a fatia do que ainda falta por
// refeição não registrada — não com o déficit inteiro do dia, que faria a
// maior opção ganhar sempre de manhã. Déficit já zerado vira fatia zero:
// nada falta, e a comparação passa a premiar a opção mais leve.
export function fatiaPorRefeicao(consumido, meta, refeicoesRestantes) {
  const divisor = Math.max(refeicoesRestantes, 1);
  return {
    kcal: Math.max(0, meta.kcal - consumido.kcal) / divisor,
    p: Math.max(0, meta.p - consumido.p) / divisor,
  };
}
