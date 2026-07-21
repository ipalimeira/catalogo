# Catálogo de vídeos — IPA Limeira (v2)

## Arquivos
```
index.html, style.css, app.js   → front-end (não mude quando atualizar dados)
gerar_catalogo.py               → gera data/videos.json e data/playlists.json
data/videos.json, data/playlists.json → já gerados a partir da planilha v8 (922 vídeos)
```

## Publicar / atualizar
1. Suba tudo pra raiz do repositório `ipalimeira/catalogo` (substitui os arquivos da v1).
2. Pages já deve continuar ativo em Settings → Pages. Se não: Branch `main` / `(root)`.
3. Sempre que a planilha for atualizada, rode de novo, sem mexer no site:
   ```
   pip install openpyxl --break-system-packages
   python3 gerar_catalogo.py planilha_nova.xlsx --saida .
   ```
   Isso só regrava `data/videos.json` e `data/playlists.json`. Suba só esses dois arquivos.

## Teste local
```
python3 -m http.server 8000
```
(não abra o index.html clicando duas vezes — o fetch do JSON é bloqueado em file://)

## O que ficou de fora por enquanto
- Sincronização automática com a API do YouTube (ainda é você quem exporta a planilha).
- A aba "Tópicos" da planilha (taxonomia teológica) não está ligada aos vídeos ainda — é insumo pra uma futura categorização por tema.
