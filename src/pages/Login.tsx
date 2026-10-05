import { useState, type FormEvent } from 'react'
import { useAuth } from '@/state/AuthContext'
import { configurado } from '@/lib/env'
import { mensagemErro } from '@/lib/errors'
import { Aviso, Campo } from '@/components/ui'

export function Login() {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await entrar(email, senha)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-navy-900 px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-gold-400 text-2xl font-bold text-gold-400">
            AD
          </div>
          <h1 className="text-xl font-bold text-white">Tesouraria</h1>
          <p className="mt-1 text-sm text-white/70">Congregação Balneário Central</p>
        </div>

        {!configurado ? (
          <div className="mb-4">
            <Aviso tom="alerta" titulo="Aplicativo ainda não configurado">
              Faltam as chaves do Supabase. Copie <code>.env.example</code> para <code>.env</code>,
              preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> e publique
              novamente. O passo a passo está em <code>docs/INSTALACAO.md</code>.
            </Aviso>
          </div>
        ) : null}

        <form onSubmit={enviar} className="space-y-4 rounded-2xl bg-white p-5 shadow-xl">
          <Campo
            rotulo="E-mail"
            type="email"
            inputMode="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
          />
          <Campo
            rotulo="Senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
          />
          {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
          <button type="submit" className="btn-primario w-full" disabled={enviando || !configurado}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="text-center text-xs leading-relaxed text-slate-500">
            O acesso é criado pelo tesoureiro. Se você ainda não tem usuário, peça a liberação.
          </p>
        </form>
      </div>
    </div>
  )
}
