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
