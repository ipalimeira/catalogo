# Catálogo de vídeos — IPA Limeira

Site estático de busca para os vídeos do canal do YouTube da igreja. Sem
banco de dados, sem servidor: os dados ficam em `data/videos.json` e a
página inteira roda no navegador de quem acessa.

## Estrutura

```
index.html      página única
style.css       estilos
app.js          busca, filtros, grade, "por livro" e modal de vídeo
data/videos.json   564 vídeos (2011–2021), extraídos da planilha original
```

## Como publicar no GitHub Pages

1. Suba estes 4 arquivos/pasta para a raiz do repositório `ipalimeira/catalogo`.
2. No repositório: **Settings → Pages → Build and deployment → Source: Deploy
   from a branch → Branch: main / (root)**.
3. Aguarde 1–2 minutos. O site fica em:
   `https://ipalimeira.github.io/catalogo/`

## Como testar localmente antes de subir

Não abra o `index.html` clicando duas vezes — o navegador bloqueia o
carregamento do `data/videos.json` quando o arquivo é aberto direto do
disco (`file://`). Suba um servidor local simples:

```
cd site
python3 -m http.server 8000
```

E acesse `http://localhost:8000` no navegador.

## O que falta para a próxima etapa (sincronização automática)

Este V0 tem apenas os 564 vídeos já catalogados na planilha (até
abril/2021). Os campos `preletor`, `texto_base`, `livro` e
`temas_teologicos` são curados manualmente; `titulo`, `data`, `duracao`,
`thumbnail_url` etc. podem futuramente vir automaticamente da API do
YouTube. Isso é assunto da próxima etapa (script + GitHub Actions), ainda
não incluído aqui.
