import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/state/AuthContext'
import { SettingsProvider } from '@/state/SettingsContext'
import { OfflineProvider } from '@/state/OfflineContext'
import { Layout } from '@/components/Layout'
import { Login } from '@/pages/Login'
import { Inicio } from '@/pages/Inicio'
import { NovoComprovante } from '@/pages/NovoComprovante'
import { Historico } from '@/pages/Historico'
import { Membros } from '@/pages/Membros'
import { Relatorios } from '@/pages/Relatorios'
import { Configuracoes } from '@/pages/Configuracoes'
import { Aviso, Carregando } from '@/components/ui'

function Protegido() {
  const { sessao, carregando, erroPerfil, perfil, sair } = useAuth()

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Carregando texto="Abrindo a tesouraria…" />
      </div>
    )
  }
  if (!sessao) return <Login />

  // Usuário autenticado, porém sem perfil liberado ou já desativado.
  if (erroPerfil || (perfil && !perfil.ativo)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
        <div className="w-full max-w-sm space-y-4">
          <Aviso tom="alerta" titulo="Acesso ainda não liberado">
            {erroPerfil ?? 'Seu acesso foi desativado.'}
          </Aviso>
          <button type="button" className="btn-secundario w-full" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </div>
    )
  }

  return (
    <SettingsProvider>
      <OfflineProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Inicio />} />
            <Route path="novo" element={<NovoComprovante />} />
            <Route path="historico" element={<Historico />} />
            <Route path="membros" element={<Membros />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </OfflineProvider>
    </SettingsProvider>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Protegido />
      </AuthProvider>
    </BrowserRouter>
  )
}
