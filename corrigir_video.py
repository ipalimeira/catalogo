#!/usr/bin/env python3
"""
Corrige um campo de UM vídeo específico em data/videos.json.

Esse script nunca é chamado pela automação — só por você, à mão,
quando perceber que algum campo saiu errado ou incompleto (categoria
errada, preletor não reconhecido, texto-base faltando, etc.).

Exemplos:
    python3 corrigir_video.py --id Rj9lo3cRJ54 --campo categoria --valor "Sermão"
    python3 corrigir_video.py --id Rj9lo3cRJ54 --campo preletor --valor "Anderson Abreu (Pastor)"
    python3 corrigir_video.py --id Rj9lo3cRJ54 --campo playlist_name --valor "Deuteronômio 2026"
    python3 corrigir_video.py --id Rj9lo3cRJ54 --campo playlist_id --valor "PLxxxxxxxx"

    # pra ver os campos atuais de um vídeo antes de corrigir:
    python3 corrigir_video.py --id Rj9lo3cRJ54 --mostrar
"""

import argparse
import json
import sys
from pathlib import Path

CAMPOS_PERMITIDOS = {
    "texto_base", "categoria", "preletor", "titulo", "duracao",
    "livro", "testamento", "data", "ano",
    "playlist_id", "playlist_name", "playlist_url",
}


def carregar(path):
    if not path.exists():
        sys.exit(f"Não encontrei {path}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def salvar(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def build_playlists(videos):
    agg = {}
    for v in videos:
        pid = v.get("playlist_id")
        if not pid:
            continue
        entry = agg.setdefault(pid, {
            "playlist_id": pid, "playlist_name": v.get("playlist_name") or pid,
            "playlist_url": v.get("playlist_url"), "count": 0,
            "primeira_data": None, "ultima_data": None,
        })
        entry["count"] += 1
        d = v.get("data")
        if d:
            if not entry["primeira_data"] or d < entry["primeira_data"]:
                entry["primeira_data"] = d
            if not entry["ultima_data"] or d > entry["ultima_data"]:
                entry["ultima_data"] = d
    return sorted(agg.values(), key=lambda p: p["count"], reverse=True)


def main():
    parser = argparse.ArgumentParser(description="Corrige um campo de um vídeo específico do catálogo.")
    parser.add_argument("--pasta", default=".", help="Pasta onde está data/videos.json")
    parser.add_argument("--id", required=True, help="video_id do YouTube (11 caracteres, da URL)")
    parser.add_argument("--campo", help=f"Campo a corrigir. Um de: {', '.join(sorted(CAMPOS_PERMITIDOS))}")
    parser.add_argument("--valor", help="Novo valor pro campo")
    parser.add_argument("--mostrar", action="store_true", help="Só mostra os dados atuais do vídeo, sem alterar nada")
    args = parser.parse_args()

    data_dir = Path(args.pasta) / "data"
    videos_path = data_dir / "videos.json"
    videos = carregar(videos_path)

    video = next((v for v in videos if v["video_id"] == args.id), None)
    if not video:
        sys.exit(f"Não achei nenhum vídeo com video_id={args.id} em {videos_path}")

    if args.mostrar:
        print(json.dumps(video, ensure_ascii=False, indent=2))
        return

    if not args.campo or args.valor is None:
        sys.exit("Use --campo e --valor pra corrigir, ou --mostrar pra só visualizar.")

    if args.campo not in CAMPOS_PERMITIDOS:
        sys.exit(f"Campo '{args.campo}' não é editável por aqui. Use um de: {', '.join(sorted(CAMPOS_PERMITIDOS))}")

    valor_antigo = video.get(args.campo)
    novo_valor = int(args.valor) if args.campo == "ano" else args.valor
    video[args.campo] = novo_valor

    if args.campo == "playlist_id" and novo_valor:
        video["playlist_url"] = f"https://www.youtube.com/playlist?list={novo_valor}"

    salvar(videos_path, videos)
    salvar(data_dir / "playlists.json", build_playlists(videos))

    print(f"OK: {args.campo} de '{video.get('titulo')}' alterado de {valor_antigo!r} para {novo_valor!r}.")


if __name__ == "__main__":
    main()
