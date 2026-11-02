#!/usr/bin/env python3
"""Gera dados/plano-2026-11.json e dados/plano-2026-12.json a partir do de outubro.

Novembro = outubro com as mudanças decididas para o bloco final (S12–S15):
  - LDL 153 (exame 16/Out): ovo sem manteiga, bisteca só no sábado, coco ralado
    trocado por castanha-do-pará; proteína intacta (~3 g/kg, decisão do atleta).
  - Livro Biesek (aplicar só em novembro): véspera das sessões das 5h com
    jantar + ceia >= ~100 g de carbo (segunda e sexta), quinta +~250 kcal de carbo,
    sábado com 60–75 g/h no pedal (+1h de pedal + 1 gel Z2+).
Dezembro (só a semana da prova, 1–6/12): carga de carbo sexta e sábado (~8 g/kg),
pouca fibra e gordura, café da manhã de prova no domingo.

Uso: python3 ferramentas/gerar-planos-nov-dez-2026.py
"""
import copy
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
A = json.loads((RAIZ / 'dados/alimentos.json').read_text())
OUT = json.loads((RAIZ / 'dados/plano-2026-10.json').read_text())

COMBUSTIVEL_SAB_NOV = 450   # ~1h45 de pedal a 65 g/h
COMBUSTIVEL_SAB_DEZ = 90    # ativação de sábado: só Saltz + meio gel


def ref(dia, rid):
    return next(r for r in dia['refeicoes'] if r['id'] == rid)


def opc(dia, rid, letra):
    return next(o for o in ref(dia, rid)['opcoes'] if o['letra'] == letra)


def item(o, alimento):
    return next((i for i in o['itens'] if i.get('alimento') == alimento), None)


def set_g(o, alimento, g, rotulo=None):
    i = item(o, alimento)
    assert i, (o['letra'], alimento)
    i['g'] = g
    if rotulo is not None:
        i['rotulo'] = rotulo
    elif 'rotulo' in i and any(ch.isdigit() for ch in i['rotulo']):
        del i['rotulo']  # rótulo antigo trazia a gramagem velha


def add(o, alimento, g, rotulo=None):
    assert alimento in A, alimento
    assert not item(o, alimento), (o['letra'], alimento)
    novo = {'alimento': alimento, 'g': g}
    if rotulo:
        novo['rotulo'] = rotulo
    o['itens'].append(novo)


def trocar(o, velho, novo, g, rotulo=None):
    i = item(o, velho)
    assert i, (o['letra'], velho)
    i.clear()
    i.update({'alimento': novo, 'g': g})
    if rotulo:
        i['rotulo'] = rotulo


def tirar(o, alimento):
    o['itens'] = [i for i in o['itens'] if i.get('alimento') != alimento]


def rotulo_ovo(g):
    n = round(g / 50)
    return f"{n} ovo{'s' if n > 1 else ''} (azeite ou antiaderente, sem manteiga)"


def recalcular(plano, combustivel_sab):
    for chave, dia in plano['dias'].items():
        kcal = p = 0.0
        for r in dia['refeicoes']:
            if r.get('tipo') == 'combustivel':
                continue
            ks, ps = [], []
            for o in r['opcoes']:
                k = sum(A[i['alimento']]['kcal'] * i['g'] / 100 for i in o['itens'])
                q = sum(A[i['alimento']]['p'] * i['g'] / 100 for i in o['itens'])
                o['kcal_plano'], o['p_plano'] = round(k), round(q)
                ks.append(k)
                ps.append(q)
            kcal += sum(ks) / len(ks)
            p += sum(ps) / len(ps)
        if chave == 'sab':
            kcal += combustivel_sab
        dia['meta'] = {'kcal': round(kcal), 'p': round(p)}


# ---------------------------------------------------------------- NOVEMBRO
nov = copy.deepcopy(OUT)
nov['mes'], nov['titulo'] = '2026-11', 'Novembro 2026'
D = nov['dias']

# Mudanças que valem em todo dia
for chave, dia in D.items():
    for r in dia['refeicoes']:
        for o in r['opcoes']:
            for i in o['itens']:
                al = i.get('alimento')
                if al == 'ovo':
                    i['rotulo'] = rotulo_ovo(i['g'])
                elif al == 'farinha_funcional':
                    i['alimento'] = 'farinha_funcional_nov'  # lote novo (02/Nov), outubro fica com a receita antiga
                elif al == 'coco_ralado':
                    i.clear()
                    i.update({'alimento': 'castanha_para', 'g': 5,
                              'rotulo': '1 castanha-do-pará picada'})
                elif al == 'bisteca_porco' and chave != 'sab':
                    g = i['g']
                    i.clear()
                    if r['id'].startswith('jantar'):
                        i.update({'alimento': 'patinho_moido', 'g': g + 10})
                    else:
                        i.update({'alimento': 'frango_grelhado', 'g': g + 20})

D['seg']['rotulo'] = 'Segunda — 🏋️ Push · véspera da bike forte'
D['ter']['rotulo'] = 'Terça — 🚴 Bike Qualidade + 🏊 Natação'
D['qua']['rotulo'] = 'Quarta — 🏋️ Lower + 🏊 Natação (noite)'
D['qui']['rotulo'] = 'Quinta — 🚴 Bike Leve + 🏃 Corrida'
D['sex']['rotulo'] = 'Sexta — 🏋️ Pull + 🏊 Natação · véspera do brick'
D['sab']['rotulo'] = 'Sábado — 🚴→🏃 Brick (bike longo + corrida)'
D['dom']['rotulo'] = 'Domingo — 🏃 Corrida Longa Z2 (ou livre)'
D['sab']['sessao'] = '🚴🏃'

# Segunda: véspera da bike forte das 5h → jantar + ceia com ~100 g de carbo
s = D['seg']
set_g(opc(s, 'jantar', 'A'), 'arroz_branco', 180)
set_g(opc(s, 'jantar', 'B'), 'flocao_milho', 80)
set_g(opc(s, 'jantar', 'C'), 'batata_doce', 300)
add(opc(s, 'ceia', 'A'), 'banana', 100, '1 banana (batida com o leite)')
add(opc(s, 'ceia', 'B'), 'mel', 15, 'mel (1 c. sopa)')
trocar(opc(s, 'ceia', 'C'), 'morango', 'banana', 100, '1 banana')

# Terça: pós-treino com mais carbo (bike forte + natação no mesmo dia)
t = D['ter']
add(opc(t, 'pos_treino', 'A'), 'mel', 15, 'mel (1 c. sopa)')
add(opc(t, 'pos_treino', 'B'), 'mel', 15, 'mel (1 c. sopa)')

# Quinta: +~250 kcal só de carbo (bike + corrida)
q = D['qui']
set_g(opc(q, 'pos_treino', 'C'), 'granola', 60)
for letra in 'ABC':
    o = opc(q, 'almoco', letra)
    set_g(o, 'arroz_branco', item(o, 'arroz_branco')['g'] + 30)
set_g(opc(q, 'jantar_pos_corrida', 'A'), 'arroz_branco', 260)
set_g(opc(q, 'jantar_pos_corrida', 'B'), 'batata_doce', 380)
set_g(opc(q, 'jantar_pos_corrida', 'C'), 'flocao_milho', 100)
set_g(opc(q, 'ceia', 'B'), 'pao_integral', 50, '2 fatias de pão integral')

# Sexta: véspera do brick → jantar + ceia com ~100 g de carbo
x = D['sex']
set_g(opc(x, 'jantar_pos_natacao', 'A'), 'arroz_branco', 230)
set_g(opc(x, 'jantar_pos_natacao', 'B'), 'flocao_milho', 100)
set_g(opc(x, 'jantar_pos_natacao', 'C'), 'batata_doce', 350)
add(opc(x, 'ceia', 'A'), 'banana', 100, '1 banana (batida com o leite)')
add(opc(x, 'ceia', 'B'), 'mel', 15, 'mel (1 c. sopa)')
set_g(opc(x, 'ceia', 'C'), 'pao_integral', 50, '2 fatias de pão integral')

# Sábado: brick. Pós-treino com mais carbo e combustível de 60–75 g/h
b = D['sab']
set_g(opc(b, 'pos_treino_imediato', 'B'), 'pao_frances', 90, '3 pães franceses sem miolo')
add(opc(b, 'pos_treino_imediato', 'C'), 'banana', 100, '1 banana')
comb = ref(b, 'durante_o_pedal')
comb['nome'] = 'Durante o pedal (60–75 g de carbo/h)'
comb['opcoes'][0]['itens'] = [{'raw': '1 gel Z2+ por hora'}, {'raw': 'DUX Energy Kick aos poucos'},
                              {'raw': 'Saltz Z2 (1 dose/h)'}]
comb['opcoes'][1]['itens'] = [{'raw': '1 banana'}, {'raw': '2 géis Z2+ por hora'},
                              {'raw': 'Saltz Z2 (1 dose/h)'}]
comb['opcoes'][2]['itens'] = [{'raw': 'Rapadura (45 g) + 1 gel Z2+ por hora'},
                              {'raw': 'Saltz Z2 (1 dose/h)'}]

recalcular(nov, COMBUSTIVEL_SAB_NOV)

# ---------------------------------------------------------------- DEZEMBRO
# Só a semana da prova (ter 1 a dom 6). Segunda 30/11 ainda usa o plano de novembro.
dez = copy.deepcopy(nov)
dez['mes'], dez['titulo'] = '2026-12', 'Semana da prova · 1–6/Dez'
Z = dez['dias']
Z['seg']['rotulo'] = 'Segunda — Recuperação pós-prova (e 30/11: Push leve)'
Z['ter']['rotulo'] = 'Terça 1/12 — 🚴 Bike curta com tiros + 🏊 Natação solta'
Z['qua']['rotulo'] = 'Quarta 2/12 — 🏊 Natação + ativação (sem perna)'
Z['qui']['rotulo'] = 'Quinta 3/12 — 🚴 Bike leve + 🏃 Corrida curta com strides'
Z['sex']['rotulo'] = 'Sexta 4/12 — 🍚 Carga de carbo 1 · Pull leve + 🏊 Natação curta'
Z['sab']['rotulo'] = 'Sábado 5/12 — 🍚 Carga de carbo 2 · ativação 20+10 min'
Z['dom']['rotulo'] = 'Domingo 6/12 — 🏁 PROVA · Triatlo Olímpico Paranoá'
Z['sex']['sessao'], Z['sab']['sessao'], Z['dom']['sessao'] = '🍚🏊', '🍚🚴🏃', '🏁'

# Ter–qui: volume cai ~40%; tira o reforço de carbo de novembro só onde ele não cabe mais
set_g(opc(Z['qui'], 'jantar_pos_corrida', 'A'), 'arroz_branco', 220)
set_g(opc(Z['qui'], 'jantar_pos_corrida', 'B'), 'batata_doce', 320)
set_g(opc(Z['qui'], 'jantar_pos_corrida', 'C'), 'flocao_milho', 80)


def carga(dia):
    """Sexta/sábado da carga: mais carbo de baixa fibra, menos feijão/salada/gordura."""
    for r in dia['refeicoes']:
        if r.get('tipo') == 'combustivel':
            continue
        for o in r['opcoes']:
            for i in list(o['itens']):
                al = i.get('alimento')
                if al == 'arroz_branco':
                    i['g'] = round(i['g'] * 2.0 / 10) * 10
                elif al == 'batata_doce':
                    i['g'] = round(i['g'] * 1.6 / 10) * 10
                elif al == 'flocao_milho':
                    i['g'] = round(i['g'] * 1.8 / 10) * 10
                elif al == 'feijao':
                    i['g'] = 60
                    i['rotulo'] = 'feijão (só o caldo e meia concha)'
                elif al in ('salada_verde', 'legumes_salteados'):
                    i['g'] = 60
                elif al == 'pasta_amendoim':
                    tirar(o, al)
                    if not item(o, 'mel'):
                        add(o, 'mel', 20, 'mel (troca a pasta de amendoim)')
                elif al == 'aveia' and r['id'] != 'pre_treino':
                    tirar(o, al)
                elif al == 'farinha_funcional_nov':
                    tirar(o, al)  # psyllium + fibra: fora nos 2 dias de carga


for chave in ('sex', 'sab'):
    carga(Z[chave])
# Sexta: almoço em casa, sem fígado na véspera da véspera (purina + pouca familiaridade digestiva)
trocar(opc(Z['sex'], 'almoco', 'C'), 'figado_bovino', 'tilapia', 200)
for chave in ('sex', 'sab'):
    for letra in 'ABC':
        o = opc(Z[chave], 'ceia', letra)
        if not item(o, 'mel'):
            add(o, 'mel', 20, 'mel (1 c. sopa cheia)')
    for r in Z[chave]['refeicoes']:
        if r['id'].startswith('pos_treino') or r['id'] == 'lanche_da_manha':
            r['opcional'] = False  # nos dias de carga o lanche das 10h conta
            for o in r['opcoes']:
                if not item(o, 'mel'):
                    add(o, 'mel', 20, 'mel (1 c. sopa cheia)')
    lanche = next(r for r in Z[chave]['refeicoes'] if r['id'] in ('lanche', 'pre_natacao'))
    for o in lanche['opcoes']:
        if not item(o, 'suco_laranja'):
            add(o, 'suco_laranja', 250, 'suco de laranja natural (250 ml)')

# Sábado: ativação curta, sem combustível de pedal longo
cs = ref(Z['sab'], 'durante_o_pedal')
cs['nome'] = 'Durante a ativação (20 + 10 min)'
cs['hora'] = 'só água + Saltz'
cs['opcoes'][0]['itens'] = [{'raw': 'Água + Saltz Z2 (1 dose)'}]
cs['opcoes'][1]['itens'] = [{'raw': 'Água + Saltz Z2 (1 dose)'}, {'raw': 'meio gel Z2+ se acordou sem fome'}]
cs['opcoes'][2]['itens'] = [{'raw': 'Só água'}]

# Domingo: dia da prova. Mesmas 7 refeições, com função nova.
d = Z['dom']
pre = ref(d, 'pre_treino')
pre['nome'], pre['hora'] = 'Café da manhã de prova (3 h antes)', '04h00'
pre['opcoes'] = [
    {'letra': 'A', 'itens': [{'alimento': 'pao_frances', 'g': 90, 'rotulo': '3 pães franceses sem miolo'},
                             {'alimento': 'mel', 'g': 30, 'rotulo': 'mel (2 c. sopa)'},
                             {'alimento': 'banana', 'g': 100, 'rotulo': '1 banana'},
                             {'alimento': 'cafe', 'g': 50, 'rotulo': '1 xícara de café'}]},
    {'letra': 'B', 'itens': [{'alimento': 'goma_tapioca', 'g': 70, 'rotulo': 'tapioca (70 g de goma)'},
                             {'alimento': 'geleia', 'g': 30, 'rotulo': 'geleia comum (2 c. sopa)'},
                             {'alimento': 'banana', 'g': 100, 'rotulo': '1 banana'},
                             {'alimento': 'suco_laranja', 'g': 250, 'rotulo': 'suco de laranja natural (250 ml)'}]},
    {'letra': 'C', 'itens': [{'alimento': 'aveia', 'g': 40},
                             {'alimento': 'banana', 'g': 150, 'rotulo': '1 banana grande'},
                             {'alimento': 'mel', 'g': 30, 'rotulo': 'mel (2 c. sopa)'},
                             {'alimento': 'leite_desnatado', 'g': 200, 'rotulo': 'leite (200 ml)'}]},
]
pos = ref(d, 'pos_corrida')
pos['nome'], pos['hora'] = 'Pós-prova (até 1 h depois)', 'logo após'
pos['opcoes'] = [
    {'letra': 'A', 'itens': [{'alimento': 'leite_desnatado', 'g': 300, 'rotulo': 'leite (300 ml)'},
                             {'alimento': 'whey', 'g': 35, 'rotulo': 'whey (35 g)'},
                             {'alimento': 'banana', 'g': 100, 'rotulo': '1 banana'},
                             {'alimento': 'mel', 'g': 20},
                             {'alimento': 'creatina', 'g': 5, 'rotulo': 'creatina 5 g'}]},
    {'letra': 'B', 'itens': [{'alimento': 'pao_frances', 'g': 60, 'rotulo': '2 pães franceses'},
                             {'alimento': 'ovo', 'g': 150, 'rotulo': '3 ovos (azeite ou antiaderente)'},
                             {'alimento': 'suco_laranja', 'g': 300, 'rotulo': 'suco de laranja (300 ml)'}]},
    {'letra': 'C', 'itens': [{'alimento': 'iogurte_natural', 'g': 200},
                             {'alimento': 'granola', 'g': 50},
                             {'alimento': 'whey', 'g': 30, 'rotulo': 'whey (30 g)'},
                             {'alimento': 'mel', 'g': 15}]},
]
lm = ref(d, 'lanche_da_manha')
lm['nome'], lm['hora'] = 'Lanche (antes de sair do evento)', '11h00'

recalcular(dez, COMBUSTIVEL_SAB_DEZ)

for plano, nome in ((nov, 'plano-2026-11.json'), (dez, 'plano-2026-12.json')):
    (RAIZ / 'dados' / nome).write_text(json.dumps(plano, ensure_ascii=False, indent=2) + '\n')
    print(nome, {k: v['meta'] for k, v in plano['dias'].items()})
