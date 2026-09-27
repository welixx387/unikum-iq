// Собирает dist/ в один самодостаточный HTML-файл artifact/index.html —
// для публикации превью (всё встроено, кроме шрифтов Google Fonts).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const css = [...html.matchAll(/href="\.\/(assets\/[^"]+\.css)"/g)].map((m) => readFileSync(join(dist, m[1]), 'utf8')).join('\n')
const js = [...html.matchAll(/src="\.\/(assets\/[^"]+\.js)"/g)].map((m) => readFileSync(join(dist, m[1]), 'utf8')).join('\n')
const fonts = html.match(/<link\s+href="https:\/\/fonts\.googleapis\.com[^>]+>/)?.[0] ?? ''

const page = `<title>Уникум IQ</title>
<meta name="description" content="IQ-тест из 25–50 заданий, которые генерируются заново для каждого участника.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>${css}</style>
<script>(function(){try{var t=localStorage.getItem('iq-unikum:theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()</script>
<div id="root"></div>
<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>
`
mkdirSync(new URL('../artifact/', import.meta.url), { recursive: true })
writeFileSync(new URL('../artifact/index.html', import.meta.url), page)
console.log(`artifact/index.html: ${(page.length / 1024).toFixed(0)} КБ`)
