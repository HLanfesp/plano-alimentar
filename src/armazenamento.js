const PREFIXO = 'pa:';
const VAZIO = () => ({ marcados: [], extras: [], combustivel: [], perfil: null });

export function criarArmazenamento(storage) {
  const ler = data => {
    const bruto = storage.getItem(PREFIXO + data);
    if (!bruto) return VAZIO();
    try {
      return { ...VAZIO(), ...JSON.parse(bruto) };
    } catch {
      return VAZIO();
    }
  };
  const gravar = (data, dia) => storage.setItem(PREFIXO + data, JSON.stringify(dia));

  const somar = (lista, id) => {
    const achado = lista.find(x => x.id === id);
    if (achado) achado.qtd += 1;
    else lista.push({ id, qtd: 1 });
  };

  return {
    lerDia: ler,
    marcar(data, chave) {
      const dia = ler(data);
      if (!dia.marcados.includes(chave)) dia.marcados.push(chave);
      gravar(data, dia);
    },
    desmarcar(data, chave) {
      const dia = ler(data);
      dia.marcados = dia.marcados.filter(c => c !== chave);
      gravar(data, dia);
    },
    addExtra(data, id) {
      const dia = ler(data);
      somar(dia.extras, id);
      gravar(data, dia);
    },
    addCombustivel(data, id) {
      const dia = ler(data);
      somar(dia.combustivel, id);
      gravar(data, dia);
    },
    definirPerfil(data, perfil) {
      const dia = ler(data);
      dia.perfil = perfil;
      gravar(data, dia);
    },
    exportar() {
      const dias = {};
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith(PREFIXO)) dias[k.slice(PREFIXO.length)] = ler(k.slice(PREFIXO.length));
      }
      return { versao: 1, geradoEm: new Date().toISOString(), dias };
    },
  };
}
