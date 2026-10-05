import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './index.css'

/** Atualização do app: entra na próxima abertura, sem interromper um lançamento. */
registerSW({ immediate: true })

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Elemento raiz não encontrado.')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
