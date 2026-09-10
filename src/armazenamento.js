const PREFIXO = 'pa:';
const VAZIO = () => ({ marcados: [], extras: [], combustivel: [], perfil: null });

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
  };
}
