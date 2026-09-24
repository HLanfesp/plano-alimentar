const PREFIXO = 'pa:';
const VAZIO = () => ({ marcados: [], extras: [], combustivel: [], perfil: null });

// Uma data de backup só é aceita se for uma data real no formato AAAA-MM-DD.
function dataValida(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d;
}

const ehObjeto = x => x !== null && typeof x === 'object' && !Array.isArray(x);

// `aoFalhar` existe porque o alvo é o Safari do iPhone, que lança em
// `setItem` na navegação privada (e pode lançar até em `getItem` quando o
// site está bloqueado). Falhar em silêncio seria o pior defeito possível:
// o atleta acha que marcou e não marcou. Toda operação avisa quem chamou,
// e todo método que grava devolve `true`/`false`.
export function criarArmazenamento(storage, aoFalhar = () => {}) {
  const avisar = (erro, operacao) => {
    try { aoFalhar(erro, operacao); } catch { /* o aviso nunca derruba o app */ }
  };

  const ler = data => {
    let bruto;
    try {
      bruto = storage.getItem(PREFIXO + data);
    } catch (erro) {
      avisar(erro, 'ler');
      return VAZIO();
    }
    if (!bruto) return VAZIO();
    try {
      return { ...VAZIO(), ...JSON.parse(bruto) };
    } catch {
      return VAZIO();
    }
  };

  const gravar = (data, dia) => {
    try {
      storage.setItem(PREFIXO + data, JSON.stringify(dia));
      return true;
    } catch (erro) {
      avisar(erro, 'gravar');
      return false;
    }
  };

  const somar = (lista, id) => {
    const achado = lista.find(x => x.id === id);
    if (achado) achado.qtd += 1;
    else lista.push({ id, qtd: 1 });
  };

  // Decrementa e apaga a linha ao chegar em zero: quantidade zero não é
  // informação, é ruído na exportação e na tela Semana.
  const subtrair = (lista, id) => {
    const i = lista.findIndex(x => x.id === id);
    if (i === -1) return lista;
    lista[i].qtd -= 1;
    if (lista[i].qtd <= 0) lista.splice(i, 1);
    return lista;
  };

  return {
    lerDia: ler,
    marcar(data, chave) {
      const dia = ler(data);
      if (!dia.marcados.includes(chave)) dia.marcados.push(chave);
      return gravar(data, dia);
    },
    desmarcar(data, chave) {
      const dia = ler(data);
      dia.marcados = dia.marcados.filter(c => c !== chave);
      return gravar(data, dia);
    },
    addExtra(data, id) {
      const dia = ler(data);
      somar(dia.extras, id);
      return gravar(data, dia);
    },
    removerExtra(data, id) {
      const dia = ler(data);
      subtrair(dia.extras, id);
      return gravar(data, dia);
    },
    addCombustivel(data, id) {
      const dia = ler(data);
      somar(dia.combustivel, id);
      return gravar(data, dia);
    },
    removerCombustivel(data, id) {
      const dia = ler(data);
      subtrair(dia.combustivel, id);
      return gravar(data, dia);
    },
    definirPerfil(data, perfil) {
      const dia = ler(data);
      dia.perfil = perfil;
      return gravar(data, dia);
    },
    exportar() {
      const dias = {};
      let chaves = [];
      try {
        for (let i = 0; i < storage.length; i++) chaves.push(storage.key(i));
      } catch (erro) {
        avisar(erro, 'ler');
        chaves = [];
      }
      for (const k of chaves) {
        if (k && k.startsWith(PREFIXO)) dias[k.slice(PREFIXO.length)] = ler(k.slice(PREFIXO.length));
      }
      return { versao: 1, geradoEm: new Date().toISOString(), dias };
    },

    // Restaura um backup exportado. REGRA DE OURO: nunca sobrescreve um dia
    // que já existe no aparelho — só acrescenta os que faltam. Um backup antigo
    // jamais apaga registro mais novo, e importar duas vezes não duplica nada.
    // Devolve a contagem para a tela dizer exatamente o que aconteceu.
    importar(backup) {
      if (!ehObjeto(backup) || !ehObjeto(backup.dias)) {
        return { ok: false, erro: 'Este arquivo não é um backup do Plano Alimentar.' };
      }
      const r = { ok: true, restaurados: 0, mantidos: 0, invalidos: 0, falhas: 0 };
      for (const [data, registro] of Object.entries(backup.dias)) {
        if (!dataValida(data) || !ehObjeto(registro)) { r.invalidos += 1; continue; }
        let existe;
        try {
          existe = storage.getItem(PREFIXO + data) !== null;
        } catch (erro) {
          avisar(erro, 'ler');
          r.falhas += 1;
          continue;
        }
        if (existe) { r.mantidos += 1; continue; }
        const dia = { ...VAZIO(), ...registro };
        if (gravar(data, dia)) r.restaurados += 1;
        else r.falhas += 1;
      }
      return r;
    },
  };
}
