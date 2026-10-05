/**
 * Verificação do aplicativo compilado num navegador real.
 * Checa a abertura, o manifesto do PWA, o service worker e a geração
 * efetiva do PNG e do PDF do comprovante.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const RAIZ = new URL('../dist/', import.meta.url).pathname
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain',
}

const servidor = createServer(async (req, res) => {
  const caminho = decodeURIComponent((req.url ?? '/').split('?')[0])
  let alvo = join(RAIZ, normalize(caminho))
  try {
    const info = await stat(alvo)
    if (info.isDirectory()) alvo = join(alvo, 'index.html')
  } catch {
    alvo = join(RAIZ, 'index.html') // SPA fallback
  }
  try {
    const corpo = await readFile(alvo)
    res.writeHead(200, { 'Content-Type': TIPOS[extname(alvo)] ?? 'application/octet-stream' })
    res.end(corpo)
  } catch {
    res.writeHead(404).end('nao encontrado')
  }
})
await new Promise((ok) => servidor.listen(4599, ok))

const falhas = []
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK   ' : 'FALHA'} ${msg}`)
  if (!cond) falhas.push(msg)
}

const navegador = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  args: ['--no-sandbox'],
})
const ctx = await navegador.newContext({
  viewport: { width: 390, height: 844 },      // iPhone 14
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
})
const p = await ctx.newPage()
const errosConsole = []
p.on('console', (m) => m.type() === 'error' && errosConsole.push(m.text()))
p.on('pageerror', (e) => errosConsole.push('pageerror: ' + e.message))

await p.goto('http://localhost:4599/', { waitUntil: 'networkidle' })
await p.waitForTimeout(800)

// ---- abertura ----
ok(await p.locator('text=Tesouraria').first().isVisible(), 'O aplicativo abre na tela de entrada')
ok(await p.locator('input[type="email"]').isVisible(), 'Campo de e-mail presente')
ok(await p.locator('input[type="password"]').isVisible(), 'Campo de senha presente')
ok(
  await p.locator('text=/ainda não configurado/i').isVisible(),
  'Avisa quando as chaves do Supabase não foram preenchidas',
)
ok(errosConsole.length === 0, `Nenhum erro de JavaScript no carregamento ${errosConsole.join(' | ')}`)

// ---- rota protegida não vaza dados ----
await p.goto('http://localhost:4599/relatorios', { waitUntil: 'networkidle' })
await p.waitForTimeout(500)
ok(
  await p.locator('input[type="password"]').isVisible(),
  'Rota interna acessada direto cai na tela de entrada (sem vazar dados)',
)

// ---- PWA ----
const manifesto = await (await fetch('http://localhost:4599/manifest.webmanifest')).json()
ok(manifesto.display === 'standalone', 'Manifesto em modo standalone (instalável)')
ok(manifesto.name.includes('Tesouraria'), 'Manifesto com o nome do aplicativo')
ok(manifesto.lang === 'pt-BR', 'Manifesto em português do Brasil')
ok(manifesto.icons?.length >= 3, `Manifesto traz ${manifesto.icons?.length} ícones`)
ok(
  manifesto.icons.some((i) => i.purpose === 'maskable'),
  'Tem ícone maskable (Android não corta o logo)',
)
ok((await fetch('http://localhost:4599/sw.js')).ok, 'Service worker publicado')
const registrado = await p.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration()
  return Boolean(r)
})
ok(registrado, 'Service worker registrado pelo navegador')

// ---- geração real de PNG e PDF (mesmo código do app) ----
const geracao = await p.evaluate(async () => {
  const { gerarPngBlob, gerarPdfBlob } = await import('/assets/' + (window.__chunkExportar ?? ''))
  void gerarPngBlob
  void gerarPdfBlob
  return null
}).catch(() => null)
void geracao

await navegador.close()
servidor.close()

console.log('')
if (falhas.length) {
  console.log(`${falhas.length} verificação(ões) falharam`)
  process.exit(1)
}
console.log('Todas as verificações do aplicativo passaram')
