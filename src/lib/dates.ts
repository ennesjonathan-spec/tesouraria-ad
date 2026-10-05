/** Datas sempre no fuso America/Sao_Paulo e no formato DD/MM/AAAA. */
export const FUSO = 'America/Sao_Paulo'

const fmtData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const fmtHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Peças da data atual já no fuso de Goiânia, sem depender do relógio do aparelho. */
function partesAgora(d = new Date()): Record<string, string> {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const out: Record<string, string> = {}
  for (const p of partes) if (p.type !== 'literal') out[p.type] = p.value
  return out
}

/** AAAA-MM-DD de hoje em São Paulo (o formato que o Postgres espera em `date`). */
export function hojeISO(d = new Date()): string {
  const p = partesAgora(d)
  return `${p.year}-${p.month}-${p.day}`
}

/** HH:MM de agora em São Paulo. */
export function agoraHora(d = new Date()): string {
  const p = partesAgora(d)
  return `${p.hour}:${p.minute}`
}

/** Competência MM/AAAA do mês corrente. */
export function competenciaAtual(d = new Date()): string {
  const p = partesAgora(d)
  return `${p.month}/${p.year}`
}

/** AAAA-MM-DD -> DD/MM/AAAA, sem criar Date (evita deslocar o dia por fuso). */
export function formatarDataISO(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

export function formatarHora(hora: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(hora)
  return m ? `${m[1]}:${m[2]}` : hora
}

export function formatarDataHora(d: Date | string): string {
  const data = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(data.getTime())) return '—'
  return `${fmtData.format(data)} às ${fmtHora.format(data)}`
}

export function competenciaValida(c: string): boolean {
  return /^(0[1-9]|1[0-2])\/\d{4}$/.test(c)
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function competenciaPorExtenso(c: string): string {
  if (!competenciaValida(c)) return c
  const [mm, aaaa] = c.split('/') as [string, string]
  return `${MESES[Number(mm) - 1]} de ${aaaa}`
}

/** Lista de competências para os filtros: 18 meses para trás e 2 para frente. */
export function competenciasDisponiveis(d = new Date()): string[] {
  const p = partesAgora(d)
  const base = Number(p.year) * 12 + (Number(p.month) - 1)
  const out: string[] = []
  for (let i = 2; i >= -18; i--) {
    const t = base + i
    const ano = Math.floor(t / 12)
    const mes = (t % 12) + 1
    out.push(`${String(mes).padStart(2, '0')}/${ano}`)
  }
  return out
}
