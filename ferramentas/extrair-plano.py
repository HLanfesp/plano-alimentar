#!/usr/bin/env python3
"""Extrator do plano alimentar: converte o HTML do nutricionista em JSON
estruturado (dados/plano-2026-09.json), conforme §5.2 da spec.

Uso:
    python3 ferramentas/extrair-plano.py <html-de-entrada> <json-de-saida>

Zero dependências externas — só biblioteca padrão (re, html, json, unicodedata).

Comportamento deliberado: ao encontrar um ingrediente que não resolve contra
dados/alimentos.json (direto ou via o dicionário de sinônimos abaixo), o script
IMPRIME a lista completa dos desconhecidos e SAI COM CÓDIGO 1. Nunca adivinha
valor nutricional e nunca inventa gramagem.
"""

import sys
import os
import re
import json
import html
import unicodedata

# ---------------------------------------------------------------------------
# Dicionário de sinônimos: nome normalizado (sem acento, minúsculo, hífen e
# múltiplos espaços colapsados) -> chave de dados/alimentos.json.
#
# As chaves de alimentos.json e unidades.json mandam sobre qualquer suposição
# — este dicionário só faz a ponte entre o texto livre do HTML e essas chaves.
# ---------------------------------------------------------------------------
SINONIMOS = {
    # proteínas / ovos
    "ovo": "ovo",
    "ovos": "ovo",
    "frango grelhado": "frango_grelhado",
    "carne bovina magra": "carne_bovina_magra",
    "patinho moido": "patinho_moido",
    "tilapia": "tilapia",
    "salmao": "salmao",
    "atum em agua": "atum_agua",
    "atum em agua drenado": "atum_agua",

    # laticínios / suplementos
    "whey": "whey",
    "whey isolado": "whey_isolado",
    "leite desnatado": "leite_desnatado",
    "leite achocolatado": "leite_achocolatado",
    "queijo minas": "queijo_minas",
    "queijo coalho": "queijo_coalho",
    "queijo cottage": "queijo_cottage",
    "iogurte grego": "iogurte_grego",
    "iogurte natural": "iogurte_natural",

    # carboidratos / pães / grãos
    "pao integral": "pao_integral",
    "fatia de pao integral": "pao_integral",
    "fatias de pao integral": "pao_integral",
    "pao frances": "pao_frances",
    "torrada integral": "torrada_integral",
    "torradas integrais": "torrada_integral",
    "arroz branco": "arroz_branco",
    "arroz integral": "arroz_integral",
    "feijao": "feijao",
    "lentilha": "lentilha",
    "grao de bico": "grao_de_bico",
    "macarrao integral": "macarrao_integral",
    "aveia": "aveia",
    "flocao de milho": "flocao_milho",
    "goma de tapioca": "goma_tapioca",
    "granola": "granola",
    "batata doce": "batata_doce",
    "mandioca": "mandioca",
    "inhame": "inhame",
    "rapadura": "rapadura",

    # frutas
    "banana": "banana",
    "maca": "maca",
    "pera": "pera",
    "morango": "morango",
    "morangos": "morango",
    "fruta": "fruta_estacao",
    "fruta da estacao": "fruta_estacao",

    # gorduras / oleaginosas
    "azeite": "azeite",
    "pasta de amendoim": "pasta_amendoim",
    "castanha de caju": "castanha_caju",
    "amendoa": "amendoa",
    "amendoas": "amendoa",
    "noz": "noz",
    "nozes": "noz",

    # hortaliças / pratos mistos
    "salada verde": "salada_verde",
    "legumes salteados": "legumes_salteados",
    "brocolis": "brocolis",
    "couve refogada": "couve_refogada",
    "vagem e cenoura": "vagem_cenoura",

    # adoçantes / diversos
    "mel": "mel",
    "canela ou mel": "mel",
    "geleia": "geleia",
    "cafe": "cafe",
    "suco de laranja": "suco_laranja",
}

# Itens de combustível de treino: nunca existem em alimentos.json, e só
# aparecem dentro de refeições tipo "combustivel" (que os testes pulam).
# Listados aqui só para documentação — o extrator não tenta resolvê-los.
ITENS_COMBUSTIVEL_CONHECIDOS = {
    "saltz z2",
    "gel z2 h",
    "dux energy kick aos poucos",
    "gel de carboidrato",
}

DIAS_ORDEM = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]


def normalizar(s: str) -> str:
    """minúsculo, sem acento, hífen->espaço, espaços colapsados."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = s.replace("-", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def limpar_html(s: str) -> str:
    s = html.unescape(s)
    s = re.sub(r"<[^>]+>", "", s)
    return s.strip()


def extrair_ultimo_parenteses_com_digito(texto: str):
    """Retorna (texto_sem_esse_parenteses, conteudo_do_parenteses) para o
    ÚLTIMO grupo entre parênteses que contém algum dígito. Outros grupos
    entre parênteses (comentários sem número, como "(drenado)" ou
    "(véspera do brick)") são removidos do texto mas descartados.

    Armadilha do brief: "Atum em água (drenado) (85 g)" tem dois parênteses
    — vale o último que contenha número.
    """
    grupos = list(re.finditer(r"\(([^()]*)\)", texto))
    spec = None
    spec_span = None
    for m in reversed(grupos):
        if re.search(r"\d", m.group(1)):
            spec = m.group(1)
            spec_span = m.span()
            break
    # remove todos os parênteses do texto (o de gramagem e quaisquer outros
    # comentários descritivos sem número)
    texto_limpo = re.sub(r"\s*\([^()]*\)", "", texto).strip()
    return texto_limpo, spec


def resolver_item(item_texto: str, alimentos: dict, unidades: dict, desconhecidos: set):
    """Resolve um item de ingrediente (já sem tags HTML) para
    {"alimento": chave, "g": gramas, "rotulo": opcional}.

    Em caso de falha de resolução, registra o texto original em
    `desconhecidos` e retorna None (o chamador decide o que fazer).
    """
    texto_sem_paren, spec = extrair_ultimo_parenteses_com_digito(item_texto)

    quantidade = 1
    nome_base = texto_sem_paren
    m_qtd = re.match(r"^(\d+)\s+(.*)$", texto_sem_paren)
    if m_qtd:
        quantidade = int(m_qtd.group(1))
        nome_base = m_qtd.group(2)

    nome_norm = normalizar(nome_base)
    alimento_key = SINONIMOS.get(nome_norm)
    if alimento_key is None:
        # tenta casar direto com a chave ou com o campo "nome" de algum
        # alimento, como rede de segurança (mas nunca inventa nada novo)
        for chave, dados in alimentos.items():
            if normalizar(chave) == nome_norm or normalizar(dados.get("nome", "")) == nome_norm:
                alimento_key = chave
                break

    if alimento_key is None:
        desconhecidos.add(item_texto)
        return None

    rotulo = None
    gramas = None

    if spec is not None:
        spec_norm = spec.strip().lower()
        m_colher = re.match(r"^(\d+(?:[.,]\d+)?)\s*c\.?\s*ch[aá]", spec_norm)
        m_grama = re.match(r"^(\d+(?:[.,]\d+)?)\s*g\b", spec_norm)
        m_ml = re.match(r"^(\d+(?:[.,]\d+)?)\s*ml\b", spec_norm)
        if m_colher:
            qtd_colher = float(m_colher.group(1).replace(",", "."))
            chave_unidade = f"{alimento_key}_colher_cha"
            if chave_unidade not in unidades:
                desconhecidos.add(item_texto)
                return None
            gramas = qtd_colher * unidades[chave_unidade]
            rotulo = limpar_html(item_texto)
        elif m_grama:
            gramas = float(m_grama.group(1).replace(",", "."))
        elif m_ml:
            # Assume densidade ~1 g/ml para líquidos do plano (leite, azeite,
            # leite achocolatado, suco) — decisão documentada no relatório.
            gramas = float(m_ml.group(1).replace(",", "."))
        else:
            desconhecidos.add(item_texto)
            return None
    else:
        # sem parênteses com número: resolve pela unidade natural
        if alimento_key not in unidades:
            desconhecidos.add(item_texto)
            return None
        gramas = quantidade * unidades[alimento_key]
        rotulo = limpar_html(item_texto)

    if gramas is None or gramas <= 0:
        desconhecidos.add(item_texto)
        return None

    item = {"alimento": alimento_key, "g": gramas}
    if rotulo:
        item["rotulo"] = rotulo
    return item


def slugify_id(nome_base: str) -> str:
    s = normalizar(nome_base)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s


def extrair_dia(bloco: str, indice: int, erros_meta: set):
    dia_codigo = DIAS_ORDEM[indice]

    m_dn = re.search(r'<div class="dn">(.*?)</div>', bloco, re.S)
    dn_texto = limpar_html(m_dn.group(1)) if m_dn else ""

    # "Segunda — 🏋️ Push — Força Máxima" -> nome do dia, emoji de sessão, rótulo
    sessao = ""
    rotulo_dia = dn_texto
    partes = dn_texto.split(" — ", 1)
    if len(partes) == 2:
        resto = partes[1]
        sub = resto.split(" ", 1)
        sessao = sub[0]
        rotulo_dia = sub[1].strip() if len(sub) > 1 else ""

    m_dkv = re.search(r'<div class="dkv"[^>]*>~?(\d+)</div>', bloco)
    m_dkl = re.search(r'<div class="dkl">[^<]*?~?(\d+)\s*g\s*P</div>', bloco)

    meta_kcal = None
    meta_p = None

    if m_dkv:
        meta_kcal = int(m_dkv.group(1))
    else:
        erros_meta.add(f"Dia {dia_codigo}: meta de kcal não pôde ser extraída")

    if m_dkl:
        meta_p = int(m_dkl.group(1))
    else:
        erros_meta.add(f"Dia {dia_codigo}: meta de proteína não pôde ser extraída")

    return dia_codigo, sessao, rotulo_dia, meta_kcal, meta_p


def extrair_refeicoes(bloco_db: str, alimentos: dict, unidades: dict, desconhecidos: set):
    """bloco_db é o conteúdo de <div class="db">...</div> (sem as tags externas)."""
    partes = bloco_db.split('<div class="meal">')
    refeicoes = []
    for parte in partes[1:]:  # partes[0] é vazio (antes do primeiro meal)
        m_mt = re.search(r'<div class="mt">(.*?)</div>', parte, re.S)
        mt_texto = limpar_html(m_mt.group(1)) if m_mt else ""

        segmentos = [s.strip() for s in mt_texto.split(" · ")]
        nome_base = segmentos[0] if segmentos else mt_texto
        resto_segmentos = segmentos[1:]

        opcional = "opcional" in mt_texto.lower()
        # O plano usa "\u26a0\ufe0f" como marca de obrigatoriedade, e nem sempre
        # acompanhado da palavra: a linha "Durante o pedal \u00b7 a partir de 60 min
        # \u26a0\ufe0f" do s\u00e1bado traz o s\u00edmbolo sozinho. O s\u00edmbolo sozinho conta.
        obrigatorio = "obrigat" in mt_texto.lower() or "\u26a0" in mt_texto

        hora = None
        for seg in resto_segmentos:
            seg_limpo = seg.replace("⚠️", "").replace("obrigatório", "").replace("obrigatorio", "").strip()
            if seg_limpo and seg_limpo.lower() not in ("opcional",):
                hora = seg_limpo
                break

        opts = re.findall(
            r'<div class="opt"><div class="ol">([ABC])</div><div class="od">(.*?)</div>\s*'
            r'<div class="om"><span class="k">(.*?)</span><span class="p">(.*?)</span></div></div>',
            parte, re.S,
        )

        opcoes_raw = []
        for letra, od, k_txt, p_txt in opts:
            od_limpo = limpar_html(od)
            k_limpo = limpar_html(k_txt)
            p_limpo = limpar_html(p_txt)
            opcoes_raw.append((letra, od_limpo, k_limpo, p_limpo))

        # decide se a refeição é "combustivel" (sem kcal) pela primeira opção
        tipo = None
        if opcoes_raw:
            m_kcal0 = re.match(r"^(\d+)\s*kcal$", opcoes_raw[0][2])
            if not m_kcal0:
                tipo = "combustivel"

        opcoes = []
        for letra, od_limpo, k_limpo, p_limpo in opcoes_raw:
            itens_texto = [t.strip() for t in od_limpo.split(" + ")]

            if tipo == "combustivel":
                opcoes.append({
                    "letra": letra,
                    "kcal_plano": None,
                    "p_plano": None,
                    "itens": [{"raw": t} for t in itens_texto],
                })
                continue

            m_kcal = re.match(r"^(\d+)\s*kcal$", k_limpo)
            m_p = re.match(r"^(\d+)\s*g\s*P$", p_limpo)
            kcal_plano = int(m_kcal.group(1)) if m_kcal else None
            p_plano = int(m_p.group(1)) if m_p else None

            itens = []
            for item_texto in itens_texto:
                resolvido = resolver_item(item_texto, alimentos, unidades, desconhecidos)
                if resolvido is not None:
                    itens.append(resolvido)
                # se None, já foi registrado em `desconhecidos`; seguimos
                # coletando todos os desconhecidos antes de abortar.

            opcoes.append({
                "letra": letra,
                "kcal_plano": kcal_plano,
                "p_plano": p_plano,
                "itens": itens,
            })

        refeicao = {
            "id": slugify_id(nome_base),
            "nome": nome_base,
            "hora": hora,
            "opcional": opcional,
            "obrigatorio": obrigatorio,
            "opcoes": opcoes,
        }
        if tipo == "combustivel":
            refeicao["tipo"] = "combustivel"

        refeicoes.append(refeicao)

    return refeicoes


def main():
    if len(sys.argv) != 3:
        print("Uso: python3 ferramentas/extrair-plano.py <html-de-entrada> <json-de-saida>", file=sys.stderr)
        sys.exit(2)

    caminho_html, caminho_saida = sys.argv[1], sys.argv[2]

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(base_dir, "dados", "alimentos.json"), encoding="utf-8") as f:
        alimentos = json.load(f)
    with open(os.path.join(base_dir, "dados", "unidades.json"), encoding="utf-8") as f:
        unidades = json.load(f)

    with open(caminho_html, encoding="utf-8") as f:
        conteudo = f.read()

    # Restringe à seção do cardápio (entre o h2 do Cardápio e a próxima
    # <section>), para não capturar acidentalmente a tabela de combustível
    # de treino mais abaixo (que também reusa a classe "dn" em outro contexto).
    m_secao = re.search(r"Cardápio.*?</section>", conteudo, re.S)
    secao_cardapio = m_secao.group(0) if m_secao else conteudo

    blocos_dia = re.split(r'<div class="day" id="d\d+">', secao_cardapio)[1:]
    if len(blocos_dia) != 7:
        print(f"ERRO: esperava 7 blocos de dia, encontrei {len(blocos_dia)}", file=sys.stderr)
        sys.exit(1)

    desconhecidos = set()
    erros_meta = set()
    dias = {}

    for indice, bloco in enumerate(blocos_dia):
        dia_codigo, sessao, rotulo_dia, meta_kcal, meta_p = extrair_dia(bloco, indice, erros_meta)

        idx_db = bloco.find('<div class="db">')
        bloco_db = bloco[idx_db + len('<div class="db">'):] if idx_db != -1 else bloco

        refeicoes = extrair_refeicoes(bloco_db, alimentos, unidades, desconhecidos)

        dias[dia_codigo] = {
            "rotulo": rotulo_dia,
            "sessao": sessao,
            "meta": {"kcal": meta_kcal, "p": meta_p},
            "refeicoes": refeicoes,
        }

    if erros_meta:
        print("Metas de kcal ou proteína não puderam ser extraídas:", file=sys.stderr)
        for erro in sorted(erros_meta):
            print(f"  - {erro}", file=sys.stderr)
        sys.exit(1)

    if desconhecidos:
        print("Ingredientes sem entrada na base (alimentos.json/unidades.json):", file=sys.stderr)
        for d in sorted(desconhecidos):
            print(f"  - {d!r}", file=sys.stderr)
        sys.exit(1)

    plano = {
        "mes": "2026-09",
        "titulo": "Setembro 2026",
        "dias": dias,
    }

    os.makedirs(os.path.dirname(os.path.abspath(caminho_saida)) or ".", exist_ok=True)
    with open(caminho_saida, "w", encoding="utf-8") as f:
        json.dump(plano, f, ensure_ascii=False, indent=2)
        f.write("\n")

    total_refeicoes = sum(len(d["refeicoes"]) for d in dias.values())
    total_opcoes = sum(len(r["opcoes"]) for d in dias.values() for r in d["refeicoes"])
    print(f"OK: {len(dias)} dias, {total_refeicoes} refeições, {total_opcoes} opções -> {caminho_saida}")


if __name__ == "__main__":
    main()
