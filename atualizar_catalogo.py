#!/usr/bin/env python3
"""
Busca vídeos novos no canal do YouTube e adiciona ao catálogo,
sem nunca sobrescrever vídeos que já existem em data/videos.json.

Uso:
    export YOUTUBE_API_KEY="sua_chave_aqui"
    python3 atualizar_catalogo.py --pasta .

O que faz:
  1. Resolve o canal @ipalimeira -> pega a playlist de uploads.
  2. Lista todos os vídeos dessa playlist (a API não deixa filtrar por
     data direto nessa chamada, então filtramos depois, localmente).
  3. Ignora qualquer vídeo cujo ID já esteja em data/videos.json.
  4. Para os vídeos realmente novos, busca título/descrição/duração e
     aplica heurísticas (categoria, texto-base, tema, preletor, data
     ajustada pro domingo) -- descritas abaixo.
  5. Vídeos com dado extraído em baixa confiança entram também em
     data/revisao_pendente.json, pra você conferir antes de confiar
     100% no catálogo publicado.
  6. Nunca modifica um vídeo já existente. Recalcula só data/playlists.json
     (que é 100% derivado, não tem curadoria manual).
"""

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

API_BASE = "https://www.googleapis.com/youtube/v3"
CHANNEL_HANDLE = "ipalimeira"

BOOK_ORDER = [
    "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué",
    "Juízes", "Rute", "1 Samuel", "2 Samuel", "1 Reis", "2 Reis",
    "1 Crônicas", "2 Crônicas", "Esdras", "Neemias", "Ester", "Jó",
    "Salmos", "Provérbios", "Eclesiastes", "Cantares", "Isaías",
    "Jeremias", "Lamentações", "Ezequiel", "Daniel", "Oséias", "Joel",
    "Amós", "Obadias", "Jonas", "Miquéias", "Naum", "Habacuque",
    "Sofonias", "Ageu", "Zacarias", "Malaquias",
    "Mateus", "Marcos", "Lucas", "João", "Atos", "Romanos",
    "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios", "Filipenses",
    "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses",
    "1 Timóteo", "2 Timóteo", "Tito", "Filémon", "Hebreus", "Tiago",
    "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Judas",
    "Apocalipse",
]
OT_COUNT = 39
BOOK_INDEX = {b: i for i, b in enumerate(BOOK_ORDER)}
TITULOS_ECLESIASTICOS = ["Rev.", "Pr.", "Pb.", "Sem.", "Dr.", "Rev", "Pr", "Pb", "Sem", "Dr"]
STOPWORDS_NOME = {"de", "da", "do", "dos", "das", "e"}


# ---------------------------------------------------------------- API HTTP

def api_get(path, params):
    url = f"{API_BASE}/{path}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode("utf-8"))


def resolve_canal(api_key):
    data = api_get("channels", {
        "part": "contentDetails",
        "forHandle": CHANNEL_HANDLE,
        "key": api_key,
    })
    items = data.get("items", [])
    if not items:
        sys.exit(f"Não consegui resolver o canal @{CHANNEL_HANDLE}. Confira a API key e a cota.")
    return items[0]["id"], items[0]["contentDetails"]["relatedPlaylists"]["uploads"]


def list_channel_playlists(channel_id, api_key):
    playlists, page_token = [], None
    while True:
        params = {"part": "snippet", "channelId": channel_id, "maxResults": 50, "key": api_key}
        if page_token:
            params["pageToken"] = page_token
        data = api_get("playlists", params)
        for it in data.get("items", []):
            playlists.append({"playlist_id": it["id"], "playlist_name": it["snippet"]["title"]})
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return playlists


def encontrar_playlist_do_video(video_id, playlists, api_key):
    """Pergunta diretamente à API, playlist por playlist, se o vídeo está lá dentro.
    Retorna (playlist_id, playlist_name) da primeira que contiver o vídeo, ou (None, None)."""
    for pl in playlists:
        data = api_get("playlistItems", {
            "part": "id",
            "playlistId": pl["playlist_id"],
            "videoId": video_id,
            "maxResults": 1,
            "key": api_key,
        })
        if data.get("items"):
            return pl["playlist_id"], pl["playlist_name"]
    return None, None


def list_all_playlist_video_ids(playlist_id, api_key):
    ids, page_token = [], None
    while True:
        params = {"part": "contentDetails", "playlistId": playlist_id, "maxResults": 50, "key": api_key}
        if page_token:
            params["pageToken"] = page_token
        data = api_get("playlistItems", params)
        ids += [it["contentDetails"]["videoId"] for it in data.get("items", [])]
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return ids


def fetch_video_details(video_ids, api_key):
    """video_ids em lotes de 50 (limite da API)."""
    out = {}
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i:i + 50]
        data = api_get("videos", {
            "part": "snippet,contentDetails,statistics",
            "id": ",".join(chunk),
            "key": api_key,
        })
        for item in data.get("items", []):
            out[item["id"]] = item
    return out


# ------------------------------------------------------------ heurísticas

def parse_iso8601_duration(s):
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", s or "")
    if not m:
        return None
    h, mi, se = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + se


def seconds_to_hhmmss(total):
    if total is None:
        return None
    h, r = divmod(total, 3600)
    m, s = divmod(r, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def fix_book(raw):
    if not raw:
        return None
    v = re.sub(r"\s+", " ", raw).strip()
    if v in BOOK_INDEX:
        return v
    for book in sorted(BOOK_ORDER, key=len, reverse=True):
        if v.startswith(book):
            return book
    return None


def extrair_texto_base(titulo, descricao):
    # 1) linha explícita "Texto base: ..."
    m = re.search(r"texto[- ]base\s*:\s*(.+)", descricao or "", re.IGNORECASE)
    if m:
        candidato = m.group(1).strip().splitlines()[0].strip()
        return candidato
    # 2) padrão "Livro cap.vers" no início do título
    livros_regex = "|".join(re.escape(b) for b in sorted(BOOK_ORDER, key=len, reverse=True))
    m = re.search(rf"({livros_regex})\s+\d+[.:]\d+(?:-\d+(?:[.:]\d+)?)?", titulo or "")
    if m:
        return m.group(0)
    return None


def extrair_tema(titulo, descricao):
    m = re.search(r"tema\s*:\s*(.+)", descricao or "", re.IGNORECASE)
    if m:
        tema = m.group(1).strip().splitlines()[0].strip()
        return tema.strip('“”"\' ')
    m = re.search(r"[“\"]([^”\"]+)[”\"]", titulo or "")
    if m:
        return m.group(1).strip()
    return None


def normalizar_nome(raw):
    for t in TITULOS_ECLESIASTICOS:
        raw = re.sub(rf"^\s*{re.escape(t)}\.?\s+", "", raw)
    return raw.strip()


def tokens_significativos(nome):
    return {t.lower() for t in re.split(r"\s+", nome) if t.lower() not in STOPWORDS_NOME and t}


def extrair_e_normalizar_preletor(titulo, descricao, preletores_conhecidos):
    raw = None
    m = re.search(r"com\s+o\s+(.+)", descricao or "", re.IGNORECASE)
    if m:
        raw = m.group(1).strip().splitlines()[0].strip()
    if not raw:
        m = re.search(r"-\s*([A-ZÀ-Ú][\wÀ-ÿ.\s]+)$", (titulo or "").strip())
        if m:
            raw = m.group(1).strip()
    if not raw:
        return None, False

    nome_limpo = normalizar_nome(raw)
    alvo = tokens_significativos(nome_limpo)

    for conhecido in preletores_conhecidos:
        nome_conhecido = re.sub(r"\s*\(.*\)\s*$", "", conhecido)
        tokens_conhecido = tokens_significativos(nome_conhecido)
        if alvo and tokens_conhecido and (alvo <= tokens_conhecido or tokens_conhecido <= alvo):
            return conhecido, True  # match com alta confiança, forma canônica

    return nome_limpo, False  # não achou correspondência -> precisa revisão


def classificar_categoria(titulo, duracao_seg):
    t = (titulo or "").lower()
    if re.search(r"\bebd\b|\baula\b", t):
        return "Aula EBD"
    if re.search(r"confer[êe]ncia", t):
        return "Palestra"
    if duracao_seg and duracao_seg > 20 * 60:
        return "Sermão"
    return None  # ambíguo -> fica para revisão manual


def domingo_anterior_ou_igual(dt):
    dias = (dt.weekday() + 1) % 7  # segunda=0 ... domingo=6
    return dt - timedelta(days=dias)


# --------------------------------------------------------------- pipeline

def carregar_json(path, default):
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return default


def salvar_json(path, obj):
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
    parser = argparse.ArgumentParser(description="Busca vídeos novos do canal e atualiza o catálogo (incremental).")
    parser.add_argument("--pasta", default=".", help="Pasta onde está data/videos.json (padrão: pasta atual)")
    args = parser.parse_args()

    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        sys.exit("Defina a variável de ambiente YOUTUBE_API_KEY antes de rodar.")

    data_dir = Path(args.pasta) / "data"
    videos_path = data_dir / "videos.json"
    revisao_path = data_dir / "revisao_pendente.json"

    videos = carregar_json(videos_path, [])
    ids_existentes = {v["video_id"] for v in videos}
    preletores_conhecidos = sorted({v["preletor"] for v in videos if v.get("preletor")})

    print("Resolvendo canal e playlist de uploads...")
    channel_id, playlist_id = resolve_canal(api_key)

    print("Listando as playlists do canal (pra depois checar onde cada vídeo novo está)...")
    playlists_canal = list_channel_playlists(channel_id, api_key)

    print("Listando vídeos da playlist de uploads...")
    todos_ids = list_all_playlist_video_ids(playlist_id, api_key)
    novos_ids = [vid for vid in todos_ids if vid not in ids_existentes]

    if not novos_ids:
        print("Nenhum vídeo novo. Catálogo já está em dia.")
        return

    print(f"{len(novos_ids)} vídeo(s) novo(s) encontrado(s). Buscando detalhes...")
    detalhes = fetch_video_details(novos_ids, api_key)

    revisao_pendente = carregar_json(revisao_path, [])
    novos_processados = []

    for vid, item in detalhes.items():
        snippet = item["snippet"]
        titulo = snippet.get("title", "")
        descricao = snippet.get("description", "")
        publicado_em = snippet.get("publishedAt", "")[:10]
        duracao_seg = parse_iso8601_duration(item.get("contentDetails", {}).get("duration"))

        try:
            dt_pub = datetime.strptime(publicado_em, "%Y-%m-%d")
            data_evento = domingo_anterior_ou_igual(dt_pub).strftime("%Y-%m-%d")
        except ValueError:
            data_evento = publicado_em

        texto_base = extrair_texto_base(titulo, descricao)
        livro = fix_book(texto_base.split()[0] if texto_base else None) if texto_base else None
        # trata livros de 2 palavras (ex: "1 Samuel") corretamente:
        if texto_base:
            livro = fix_book(re.match(r"^(.*?)\s+\d", texto_base).group(1)) if re.match(r"^(.*?)\s+\d", texto_base) else None
        testamento = None
        if livro in BOOK_INDEX:
            testamento = "AT" if BOOK_INDEX[livro] < OT_COUNT else "NT"

        tema = extrair_tema(titulo, descricao)
        preletor, preletor_confiavel = extrair_e_normalizar_preletor(titulo, descricao, preletores_conhecidos)
        categoria = classificar_categoria(titulo, duracao_seg)

        pl_id, pl_nome = encontrar_playlist_do_video(vid, playlists_canal, api_key)

        video = {
            "video_id": vid,
            "url": f"https://youtu.be/{vid}",
            "thumbnail_url": f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
            "embed_url": f"https://www.youtube.com/embed/{vid}",
            "data": data_evento,
            "ano": int(data_evento[:4]),
            "texto_base": texto_base,
            "categoria": categoria,
            "preletor": preletor,
            "titulo": tema or titulo,
            "titulo_youtube": titulo,
            "duracao": seconds_to_hhmmss(duracao_seg),
            "duracao_seg": duracao_seg,
            "livro": livro,
            "testamento": testamento,
            "playlist_id": pl_id,
            "playlist_name": pl_nome,
            "playlist_url": f"https://www.youtube.com/playlist?list={pl_id}" if pl_id else None,
        }
        novos_processados.append(video)

        motivos = []
        if not categoria:
            motivos.append("categoria ambígua (não é EBD/Conferência e tem ≤20min)")
        if not preletor_confiavel:
            motivos.append("preletor não bateu com nenhum já conhecido")
        if not texto_base:
            motivos.append("texto-base não encontrado no título/descrição")
        if not pl_id:
            motivos.append("playlist não encontrada em nenhuma playlist do canal (pode não ter sido adicionada ainda no YouTube Studio)")
        if motivos:
            revisao_pendente.append({"video_id": vid, "titulo": titulo, "motivos": motivos})

    videos_final = videos + novos_processados
    videos_final.sort(key=lambda v: v.get("data") or "", reverse=True)

    salvar_json(videos_path, videos_final)
    salvar_json(data_dir / "playlists.json", build_playlists(videos_final))
    salvar_json(revisao_path, revisao_pendente)

    print(f"OK: {len(novos_processados)} vídeo(s) adicionado(s).")
    if revisao_pendente:
        print(f"Atenção: {len(revisao_pendente)} vídeo(s) no total precisam de revisão manual "
              f"(veja data/revisao_pendente.json).")


if __name__ == "__main__":
    main()
