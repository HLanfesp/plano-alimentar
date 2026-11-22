"""Cardápios por data da S15 (23–29/11/2026, 1ª semana do polimento).

Seg–Qui da S15 batem com o cardápio de novembro por dia da semana, então
só três datas ganham cardápio próprio em `porData` de plano-2026-11.json:

- 27/11 (sex): véspera do ensaio geral. Igual à sexta, mas o jantar sai
  pobre em fibra (sem salada/legumes, batata-doce trocada por arroz), para
  ensaiar a véspera da prova.
- 28/11 (sáb): ensaio geral (lago 1.200 → bike 45' → corrida 20'). Café da
  manhã de prova no lugar do pré-treino e protocolo de prova no combustível.
  Treino mais curto que o brick dos outros sábados → meta menor.
- 29/11 (dom): corrida leve de 40'. Lanche da manhã continua opcional e
  sai da meta (o domingo-padrão é de corrida longa).

Proteína mantida ~220–240 g (decisão dele). Rodar:
    python3 ferramentas/gerar-s15-novembro-2026.py
"""
import copy
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARQ = RAIZ / "dados" / "plano-2026-11.json"
alimentos = json.loads((RAIZ / "dados" / "alimentos.json").read_text())
plano = json.loads(ARQ.read_text())
dias = plano["dias"]


def it(alimento, g, rotulo=None):
    d = {"alimento": alimento, "g": g}
    if rotulo:
        d["rotulo"] = rotulo
    return d


def opcao(letra, itens):
    kcal = sum(alimentos[i["alimento"]]["kcal"] * i["g"] / 100 for i in itens)
    p = sum(alimentos[i["alimento"]]["p"] * i["g"] / 100 for i in itens)
    return {"letra": letra, "kcal_plano": round(kcal), "p_plano": round(p), "itens": itens}


def recalcular(refeicao):
    for o in refeicao["opcoes"]:
        if o.get("kcal_plano") is None:
            continue
        o.update({k: v for k, v in opcao(o["letra"], o["itens"]).items() if k in ("kcal_plano", "p_plano")})


def meta(dia, extra_kcal=0):
    kcal = p = 0
    for r in dia["refeicoes"]:
        if r.get("tipo") == "combustivel" or r.get("opcional"):
            continue
        ops = r["opcoes"]
        kcal += sum(o["kcal_plano"] for o in ops) / len(ops)
        p += sum(o["p_plano"] for o in ops) / len(ops)
    return {"kcal": int(round(kcal + extra_kcal, -1)), "p": int(round(p))}


def sem_fibra(itens):
    fora = {"salada_verde", "legumes_salteados"}
    return [i for i in itens if i["alimento"] not in fora]


# ---------- 27/11: véspera do ensaio ----------
sex = copy.deepcopy(dias["sex"])
sex["rotulo"] = "Sexta — 🏋️ Pull + 🏊 Natação · véspera do ENSAIO (jantar pobre em fibra)"
for r in sex["refeicoes"]:
    if r["id"] != "jantar_pos_natacao":
        continue
    r["nome"] = "Jantar pós-natação (pobre em fibra, como na véspera da prova)"
    novas = []
    for o in r["opcoes"]:
        itens = sem_fibra(o["itens"])
        itens = [it("arroz_branco", 250) if i["alimento"] == "batata_doce" else i for i in itens]
        itens = [i for i in itens if i["alimento"] != "azeite"] if o["letra"] == "C" else itens
        for i in itens:
            if i["alimento"] == "arroz_branco" and o["letra"] == "A":
                i["g"] = 260
        novas.append(opcao(o["letra"], itens))
    r["opcoes"] = novas
# A meta-padrão da sexta inclui o lanche opcional; só o jantar mudou, então
# a meta acompanha a diferença do jantar.
def media_jantar(dia):
    r = next(x for x in dia["refeicoes"] if x["id"] == "jantar_pos_natacao")
    return (sum(o["kcal_plano"] for o in r["opcoes"]) / 3, sum(o["p_plano"] for o in r["opcoes"]) / 3)
dk, dp = (a - b for a, b in zip(media_jantar(sex), media_jantar(dias["sex"])))
sex["meta"] = {"kcal": int(round(dias["sex"]["meta"]["kcal"] + dk, -1)), "p": int(round(dias["sex"]["meta"]["p"] + dp))}

# ---------- 28/11: ensaio geral ----------
sab = copy.deepcopy(dias["sab"])
sab["rotulo"] = "Sábado — 🏊→🚴→🏃 ENSAIO GERAL (protocolo de prova)"
sab["sessao"] = "🏊🚴🏃"
cafe_prova = {
    "id": "cafe_prova",
    "nome": "Café da manhã de prova (pouca fibra e gordura)",
    "hora": "3–4 h antes da largada",
    "opcional": False,
    "obrigatorio": True,
    "opcoes": [
        opcao("A", [it("pao_frances", 90, "3 pães franceses sem miolo"), it("mel", 30, "mel (30 g)"),
                    it("banana", 100, "1 banana"), it("suco_laranja", 200, "suco de laranja (200 ml)"),
                    it("cafe", 50, "1 xícara de café (sem açúcar)")]),
        opcao("B", [it("flocao_milho", 80, "cuscuz (80 g de flocão)"), it("mel", 20, "mel (20 g)"),
                    it("banana", 100, "1 banana"), it("suco_laranja", 200, "suco de laranja (200 ml)"),
                    it("cafe", 50, "1 xícara de café (sem açúcar)")]),
        opcao("C", [it("pao_frances", 60, "2 pães franceses sem miolo"), it("geleia_diet", 20, "geleia diet (1 c. sopa)"),
                    it("mel", 20, "mel (20 g)"), it("banana", 150, "1½ banana"),
                    it("suco_laranja", 300, "suco de laranja (300 ml)"), it("cafe", 50, "1 xícara de café (sem açúcar)")]),
    ],
}
combustivel = {
    "id": "durante_o_pedal",
    "nome": "Protocolo de prova: pré-largada, bike e corrida",
    "hora": "1h30 antes → fim da corrida",
    "opcional": False,
    "obrigatorio": True,
    "tipo": "combustivel",
    "opcoes": [
        {"letra": "A", "kcal_plano": None, "p_plano": None, "itens": [
            {"raw": "1h30 antes: 500 ml de água + 1 Saltz"},
            {"raw": "15 min antes da largada: 1 gel Iced Coffee"},
            {"raw": "Bike: garrafa 1 = Energy Kick · garrafa 2 = água + Saltz (separadas)"},
            {"raw": "Bike: gel aos ~20 min; o grosso da garrafa nos últimos 10–15 min"},
            {"raw": "T2: só goles · Corrida: 2 flasks de água"}]},
        {"letra": "B", "kcal_plano": None, "p_plano": None, "itens": [
            {"raw": "Igual à A, com o 2º gel (sem cafeína) no lugar do Energy Kick"},
            {"raw": "Bike: as duas garrafas com água + Saltz"}]},
    ],
}
refs = []
for r in sab["refeicoes"]:
    if r["id"] == "pre_treino":
        refs.append(cafe_prova)
    elif r.get("tipo") == "combustivel":
        refs.append(combustivel)
    else:
        refs.append(r)
sab["refeicoes"] = refs
# O brick-padrão dá 3.396 (refeições 2.950 + ~450 de combustível de 2 h de
# pedal). O ensaio tem ~45' de bike (combustível ≈ gel 100 + Energy Kick 137
# + 2 Saltz 88 ≈ 325) e um café de prova maior → meta de 3.300. As opções
# somam um pouco acima disso, o que no app fica verde (o risco é déficit).
sab["meta"] = {"kcal": 3300, "p": meta(sab)["p"]}

# ---------- 29/11: corrida leve ----------
dom = copy.deepcopy(dias["dom"])
dom["rotulo"] = "Domingo — 🏃 Corrida leve 40' (polimento)"
dom["meta"] = meta(dom)

plano["porData"] = {"2026-11-27": sex, "2026-11-28": sab, "2026-11-29": dom}
ARQ.write_text(json.dumps(plano, ensure_ascii=False, indent=2) + "\n")

for chave in ("sex", "sab", "dom"):
    print(f"{chave} padrão: {dias[chave]['meta']}  | média das opções: {meta(dias[chave])}")
for iso, d in plano["porData"].items():
    print(iso, d["meta"], d["rotulo"])
