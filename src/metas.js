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
