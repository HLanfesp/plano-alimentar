#!/usr/bin/env python3
"""Gera icone-192.png e icone-512.png para o manifest do PWA.

Sem dependencias externas: so zlib e struct da biblioteca padrao.
Desenho: fundo verde solido (#22c55e) com um "P" branco em blocos,
simples e legivel a 60x60 px (tamanho real na tela de inicio do iPhone).

Uso:
    python3 ferramentas/gerar-icones.py
"""
import struct
import zlib
from pathlib import Path

VERDE = (0x22, 0xC5, 0x5E)
BRANCO = (0xFF, 0xFF, 0xFF)

# Fonte de bloco 5x7 para a letra "P" (1 = pintado).
LETRA_P = [
    "11110",
    "10001",
    "10001",
    "11110",
    "10000",
    "10000",
    "10000",
]


def construir_pixels(tamanho):
    """Retorna uma matriz tamanho x tamanho de tuplas RGB."""
    pixels = [[VERDE for _ in range(tamanho)] for _ in range(tamanho)]

    linhas = len(LETRA_P)
    colunas = len(LETRA_P[0])

    # A letra ocupa ~58% da altura do icone, centralizada.
    altura_letra = int(tamanho * 0.58)
    escala = max(1, altura_letra // linhas)
    largura_letra = colunas * escala
    altura_letra = linhas * escala

    offset_x = (tamanho - largura_letra) // 2
    offset_y = (tamanho - altura_letra) // 2

    for linha_i, linha in enumerate(LETRA_P):
        for col_i, bit in enumerate(linha):
            if bit != "1":
                continue
            for dy in range(escala):
                for dx in range(escala):
                    x = offset_x + col_i * escala + dx
                    y = offset_y + linha_i * escala + dy
                    if 0 <= x < tamanho and 0 <= y < tamanho:
                        pixels[y][x] = BRANCO

    return pixels


def _chunk(tipo, dados):
    corpo = tipo + dados
    crc = zlib.crc32(corpo) & 0xFFFFFFFF
    return struct.pack(">I", len(dados)) + corpo + struct.pack(">I", crc)


def salvar_png(caminho, pixels):
    tamanho = len(pixels)
    assinatura = b"\x89PNG\r\n\x1a\n"

    ihdr = struct.pack(">IIBBBBB", tamanho, tamanho, 8, 2, 0, 0, 0)  # RGB 8 bits

    bruto = bytearray()
    for linha in pixels:
        bruto.append(0)  # filtro "nenhum"
        for (r, g, b) in linha:
            bruto.extend((r, g, b))

    idat = zlib.compress(bytes(bruto), 9)

    png = (
        assinatura
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", idat)
        + _chunk(b"IEND", b"")
    )
    Path(caminho).write_bytes(png)


def main():
    raiz = Path(__file__).resolve().parent.parent
    for tamanho, nome in ((192, "icone-192.png"), (512, "icone-512.png")):
        pixels = construir_pixels(tamanho)
        salvar_png(raiz / nome, pixels)
        print(f"gerado {nome} ({tamanho}x{tamanho})")


if __name__ == "__main__":
    main()
