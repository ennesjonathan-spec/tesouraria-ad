import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { digitsToCents, formatMoneyPlain, type Cents } from '@/lib/money'

// ------------------------------------------------------------------ campos
interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string
  dica?: string
  erro?: string | null
}

export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { rotulo, dica, erro, id, className = '', ...resto },
  ref,
) {
  const gerado = useId()
  const idFinal = id ?? gerado
  return (
    <div>
      <label htmlFor={idFinal} className="rotulo">
        {rotulo}
      </label>
      <input
        ref={ref}
        id={idFinal}
        className={`campo ${erro ? 'border-red-400 focus:ring-red-200' : ''} ${className}`}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${idFinal}-erro` : dica ? `${idFinal}-dica` : undefined}
        {...resto}
      />
      {erro ? (
        <p id={`${idFinal}-erro`} className="mt-1.5 text-sm font-medium text-red-600">
          {erro}
        </p>
      ) : dica ? (
        <p id={`${idFinal}-dica`} className="mt-1.5 text-sm text-slate-500">
          {dica}
        </p>
      ) : null}
    </div>
  )
})

interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string
  dica?: string
  children: ReactNode
}

export function Selecao({ rotulo, dica, id, children, ...resto }: SelecaoProps) {
  const gerado = useId()
  const idFinal = id ?? gerado
  return (
    <div>
      <label htmlFor={idFinal} className="rotulo">
        {rotulo}
      </label>
      <select id={idFinal} className="campo appearance-none bg-white pr-10" {...resto}>
        {children}
      </select>
      {dica ? <p className="mt-1.5 text-sm text-slate-500">{dica}</p> : null}
    </div>
  )
}

interface AreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  rotulo: string
  dica?: string
}

export function AreaTexto({ rotulo, dica, id, ...resto }: AreaProps) {
  const gerado = useId()
  const idFinal = id ?? gerado
  return (
    <div>
      <label htmlFor={idFinal} className="rotulo">
        {rotulo}
      </label>
      <textarea id={idFinal} rows={3} className="campo resize-y" {...resto} />
      {dica ? <p className="mt-1.5 text-sm text-slate-500">{dica}</p> : null}
    </div>
  )
}

/**
 * Campo de dinheiro com teclado numérico.
 * Os dígitos entram pela direita, como numa maquininha: digitar 2-5-0-0-0
 * mostra 250,00. Não existe o estado "meio digitado" que confunde na hora do
 * culto, e o valor sai daqui já em centavos inteiros.
 */
export function CampoDinheiro({
  rotulo,
  valor,
  aoMudar,
  autoFocus,
  erro,
  dica,
}: {
  rotulo: string
  valor: Cents
  aoMudar: (c: Cents) => void
  autoFocus?: boolean
  erro?: string | null
  dica?: string
}) {
  const id = useId()
  const [digitos, setDigitos] = useState(valor > 0 ? String(valor) : '')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Mudança vinda de fora (ex.: limpar o formulário).
    const atualEmCentavos = digitsToCents(digitos)
    if (atualEmCentavos !== valor) setDigitos(valor > 0 ? String(valor) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  return (
    <div>
      <label htmlFor={id} className="rotulo">
        {rotulo}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-slate-400">
          R$
        </span>
        <input
          ref={ref}
          id={id}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus={autoFocus}
          className={`campo pl-12 text-right text-2xl font-bold tabular-nums ${
            erro ? 'border-red-400' : ''
          }`}
          value={formatMoneyPlain(digitsToCents(digitos))}
          onChange={(e) => {
            const somenteDigitos = e.target.value.replace(/\D/g, '')
            setDigitos(somenteDigitos)
            aoMudar(digitsToCents(somenteDigitos))
          }}
          onFocus={(e) => e.currentTarget.setSelectionRange(99, 99)}
          aria-invalid={erro ? true : undefined}
        />
      </div>
      {erro ? (
        <p className="mt-1.5 text-sm font-medium text-red-600">{erro}</p>
      ) : dica ? (
        <p className="mt-1.5 text-sm text-slate-500">{dica}</p>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------- utilitários
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-navy-700" />
      <span className="text-sm font-medium">{texto}</span>
    </div>
  )
}

export function EstadoVazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string
  descricao: string
  acao?: ReactNode
}) {
  return (
    <div className="cartao px-6 py-10 text-center">
      <p className="text-base font-semibold text-slate-800">{titulo}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{descricao}</p>
      {acao ? <div className="mt-5 flex justify-center">{acao}</div> : null}
    </div>
  )
}

export function Aviso({
  tom = 'info',
  titulo,
  children,
}: {
  tom?: 'info' | 'alerta' | 'erro' | 'ok'
  titulo?: string
  children: ReactNode
}) {
  const estilos = {
    info: 'border-navy-200 bg-navy-50 text-navy-900',
    alerta: 'border-amber-300 bg-amber-50 text-amber-900',
    erro: 'border-red-300 bg-red-50 text-red-800',
    ok: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  }[tom]
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${estilos}`} role={tom === 'erro' ? 'alert' : undefined}>
      {titulo ? <p className="mb-1 font-semibold">{titulo}</p> : null}
      {children}
    </div>
  )
}

/** Caixa de confirmação — usada antes de qualquer cancelamento. */
export function Confirmacao({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar = 'Confirmar',
  perigo,
  aoConfirmar,
  aoFechar,
  children,
  desabilitarConfirmar,
}: {
  aberto: boolean
  titulo: string
  descricao?: string
  rotuloConfirmar?: string
  perigo?: boolean
  aoConfirmar: () => void
  aoFechar: () => void
  children?: ReactNode
  desabilitarConfirmar?: boolean
}) {
  useEffect(() => {
    if (!aberto) return
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [aberto, aoFechar])

  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
        {descricao ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{descricao}</p> : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secundario" onClick={aoFechar}>
            Voltar
          </button>
          <button
            type="button"
            className={perigo ? 'btn-perigo' : 'btn-primario'}
            onClick={aoConfirmar}
            disabled={desabilitarConfirmar}
          >
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Etiqueta({
  tom,
  children,
}: {
  tom: 'ok' | 'alerta' | 'erro' | 'neutro' | 'destaque'
  children: ReactNode
}) {
  const estilos = {
    ok: 'bg-emerald-100 text-emerald-800',
    alerta: 'bg-amber-100 text-amber-800',
    erro: 'bg-red-100 text-red-700',
    neutro: 'bg-slate-100 text-slate-600',
    destaque: 'bg-navy-100 text-navy-800',
  }[tom]
  return <span className={`etiqueta ${estilos}`}>{children}</span>
}
