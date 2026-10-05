/**
 * Gera os ícones do PWA a partir do monograma. Rode se trocar as cores:
 *   node tools/gerar-icones.mjs
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const NAVY = '#0f2a4a'
const GOLD = '#bd9336'

function pagina(tamanho, { maskable = false } = {}) {
  // Em ícone maskable, o sistema pode recortar até 10% de cada borda:
  // por isso o monograma fica menor e o fundo cobre tudo.
  const escala = maskable ? 0.52 : 0.68
  const raio = maskable ? 0 : tamanho * 0.22
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    .i{width:${tamanho}px;height:${tamanho}px;background:${NAVY};border-radius:${raio}px;
       display:flex;align-items:center;justify-content:center;
       font-family:Helvetica,Arial,sans-serif;}
    .m{width:${tamanho * escala}px;height:${tamanho * escala}px;border:${tamanho * 0.035}px solid ${GOLD};
       border-radius:${tamanho * 0.1}px;display:flex;align-items:center;justify-content:center;
       color:${GOLD};font-weight:800;font-size:${tamanho * escala * 0.46}px;letter-spacing:${tamanho * 0.01}px}
  </style></head><body><div class="i"><div class="m">AD</div></div></body></html>`
}

const navegador = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  args: ['--no-sandbox'],
})

const alvos = [
  ['public/icon-192.png', 192, {}],
  ['public/icon-512.png', 512, {}],
  ['public/icon-maskable-512.png', 512, { maskable: true }],
  ['public/apple-touch-icon.png', 180, {}],
]

for (const [caminho, tamanho, opcoes] of alvos) {
  const p = await navegador.newPage({ viewport: { width: tamanho, height: tamanho } })
  await p.setContent(pagina(tamanho, opcoes))
  const png = await p.locator('.i').screenshot({ omitBackground: false })
  writeFileSync(caminho, png)
  await p.close()
  console.log('gerado', caminho)
}

await navegador.close()
