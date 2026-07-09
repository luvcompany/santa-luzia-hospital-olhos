# Santa Luzia Hospital de Olhos — site (cópia estática)

Cópia estática fiel do site **santaluziahospitaldeolhos.com**, capturada a partir da
versão publicada (originalmente hospedada no Framer) para migração para outro sistema
de hospedagem.

Todo o HTML vem **pré-renderizado** e os assets (imagens, fontes, módulos JavaScript de
hidratação/animação do Framer) foram baixados e têm suas referências apontando para
caminhos **locais** — o site funciona de forma autossuficiente, sem depender do CDN do
Framer.

## Estrutura

```
/                       -> index.html + 17 páginas de nível raiz
/oftalmo/               -> 15 páginas de especialidades oftalmológicas
/otorrino/              -> 11 páginas de exames/cirurgias de otorrino
/framerusercontent.com/ -> imagens, fontes (.woff2) e módulos JS (.mjs) do site
/events.framer.com/     -> script de telemetria do Framer (opcional — ver abaixo)
/_tools/                -> scripts usados para capturar e localizar os assets
```

São **44 páginas** no total (conforme o `sitemap.xml` original).

## Como visualizar localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000/
```

Ou qualquer servidor estático (`npx serve`, etc.). É preciso servir a partir da raiz do
projeto para que os caminhos relativos dos assets resolvam corretamente.

## Como publicar

Qualquer host de site estático serve direto a pasta:

- **Netlify / Vercel / Cloudflare Pages**: publique a raiz do projeto (publish dir = `.`).
- **GitHub Pages**: ative Pages apontando para a branch/raiz.

Depois de publicar no novo host, aponte o domínio `santaluziahospitaldeolhos.com` para
ele e **desconecte o domínio do Framer**.

## Observações

- As tags `canonical` / `og:url` de cada página apontam para
  `https://santaluziahospitaldeolhos.com/...` — isso é o correto para SEO quando o site
  estiver no domínio de produção.
- As **fontes** usam o CDN do Google Fonts (`fonts.gstatic.com`) — dependência externa
  padrão e estável.
- `events.framer.com/script?v=2` é a **telemetria do Framer**. Pode ser removida com
  segurança após a migração (ela não afeta o visual). Para remover, apague a pasta
  `events.framer.com/` e as tags `<script src=".../events.framer.com/...">` dos HTMLs.
- `https://framer.com/edit/init.mjs` é o hook do editor do Framer, inócuo para visitantes.
- A **busca interna** do site depende de dois arquivos `searchIndex-*.js` que o CDN do Framer
  se recusa a servir por download direto (HTTP 403). Todo o resto do site (páginas, imagens,
  layout) funciona normalmente; apenas a caixa de busca pode não retornar resultados.

## Como esta cópia foi gerada

Veja os scripts em [`_tools/`](_tools/):
- `fetch-framer-js.mjs` — baixa recursivamente a árvore de módulos JS do Framer.
- `rewrite-links.mjs` — reescreve referências absolutas do CDN para caminhos locais.
