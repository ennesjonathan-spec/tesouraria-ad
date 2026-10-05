import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useOffline } from '@/state/OfflineContext'
import { useAuth } from '@/state/AuthContext'
import { useSettings } from '@/state/SettingsContext'

const abas = [
  { para: '/', rotulo: 'Início', icone: IconeInicio, fim: true },
  { para: '/novo', rotulo: 'Novo', icone: IconeNovo },
  { para: '/historico', rotulo: 'Histórico', icone: IconeHistorico },
  { para: '/membros', rotulo: 'Membros', icone: IconeMembros },
  { para: '/relatorios', rotulo: 'Relatórios', icone: IconeRelatorios },
]

export function Layout() {
  const { online, rascunhos, sincronizando } = useOffline()
  const { perfil } = useAuth()
  const { config } = useSettings()
  const local = useLocation()

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-navy-800 bg-navy-900 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gold-400/60 bg-white/5">
            {config.logo_url ? (
              <img src={config.logo_url} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-sm font-bold text-gold-400">AD</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">Tesouraria</p>
            <p className="truncate text-xs text-white/70">{config.congregacao}</p>
          </div>
          <NavLink
            to="/configuracoes"
            className="rounded-lg px-2.5 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
            aria-label="Configurações e conta"
          >
            {perfil?.nome?.split(' ')[0] ?? 'Conta'}
          </NavLink>
        </div>

        {(!online || rascunhos.length > 0) && (
          <div
            className={`px-4 py-2 text-center text-xs font-semibold ${
              online ? 'bg-amber-400 text-amber-950' : 'bg-slate-700 text-white'
            }`}
            role="status"
          >
            {!online
              ? `Sem internet — os lançamentos ficam guardados no aparelho${
                  rascunhos.length ? ` (${rascunhos.length} aguardando)` : ''
                }`
              : sincronizando
                ? 'Enviando os lançamentos guardados…'
                : `${rascunhos.length} ${
                    rascunhos.length === 1 ? 'lançamento ainda não enviado' : 'lançamentos ainda não enviados'
                  }`}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4" key={local.pathname}>
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegação principal"
      >
        <div className="mx-auto flex max-w-3xl">
          {abas.map((a) => {
            const Icone = a.icone
            return (
              <NavLink
                key={a.para}
                to={a.para}
                end={a.fim}
                className={({ isActive }) =>
                  `flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-semibold transition ${
                    isActive ? 'text-navy-900' : 'text-slate-400'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icone ativo={isActive} />
                    <span>{a.rotulo}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

interface IconeProps {
  ativo: boolean
}
const base = (ativo: boolean) =>
  `h-6 w-6 ${ativo ? 'stroke-navy-900' : 'stroke-slate-400'} fill-none`

function IconeInicio({ ativo }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.8} className={base(ativo)} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  )
}
function IconeNovo({ ativo }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.8} className={base(ativo)} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  )
}
function IconeHistorico({ ativo }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.8} className={base(ativo)} aria-hidden>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      <path d="M14 3v5h5M8.5 13h7M8.5 17h4" strokeLinecap="round" />
    </svg>
  )
}
function IconeMembros({ ativo }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.8} className={base(ativo)} aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.5a5.5 5.5 0 0 1 3 5.5" strokeLinecap="round" />
    </svg>
  )
}
function IconeRelatorios({ ativo }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.8} className={base(ativo)} aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" />
    </svg>
  )
}
