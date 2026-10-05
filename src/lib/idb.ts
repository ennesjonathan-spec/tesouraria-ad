/**
 * Armazenamento local (IndexedDB).
 *
 * Serve a dois propósitos durante o culto, quando a internet do templo cai:
 *  1. cache da relação de membros, para a busca continuar funcionando;
 *  2. fila de rascunhos, que só viram comprovante oficial — com número — ao
 *     chegar no servidor. Rascunho não entra em relatório nenhum.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ChurchSettings, Member, RascunhoOffline } from '@/domain/types'

interface TesourariaDB extends DBSchema {
  membros: { key: string; value: Member }
  rascunhos: { key: string; value: RascunhoOffline }
  config: { key: string; value: { chave: string; valor: unknown; em: number } }
}

const NOME_BANCO = 'tesouraria-ad-124'
const VERSAO = 1

let promessa: Promise<IDBPDatabase<TesourariaDB>> | null = null

function banco(): Promise<IDBPDatabase<TesourariaDB>> {
  if (!promessa) {
    promessa = openDB<TesourariaDB>(NOME_BANCO, VERSAO, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('membros')) {
          db.createObjectStore('membros', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('rascunhos')) {
          db.createObjectStore('rascunhos', { keyPath: 'client_uuid' })
        }
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'chave' })
        }
      },
    })
  }
  return promessa
}

/** O IndexedDB pode estar bloqueado (aba anônima, por exemplo): nunca derruba o app. */
async function tentar<T>(fn: (db: IDBPDatabase<TesourariaDB>) => Promise<T>, padrao: T): Promise<T> {
  try {
    return await fn(await banco())
  } catch {
    return padrao
  }
}

// ---------- membros ----------
export async function salvarMembrosEmCache(membros: readonly Member[]): Promise<void> {
  await tentar(async (db) => {
    const tx = db.transaction('membros', 'readwrite')
    await tx.store.clear()
    for (const m of membros) await tx.store.put(m)
    await tx.done
  }, undefined)
}

export async function lerMembrosDoCache(): Promise<Member[]> {
  return tentar((db) => db.getAll('membros'), [])
}

export async function guardarMembroNoCache(membro: Member): Promise<void> {
  await tentar((db) => db.put('membros', membro).then(() => undefined), undefined)
}

// ---------- configurações ----------
export async function salvarConfigEmCache(config: ChurchSettings): Promise<void> {
  await tentar(
    (db) => db.put('config', { chave: 'church_settings', valor: config, em: Date.now() }).then(() => undefined),
    undefined,
  )
}

export async function lerConfigDoCache(): Promise<ChurchSettings | null> {
  const r = await tentar((db) => db.get('config', 'church_settings'), undefined)
  return (r?.valor as ChurchSettings | undefined) ?? null
}

// ---------- rascunhos ----------
export async function salvarRascunho(r: RascunhoOffline): Promise<void> {
  await tentar((db) => db.put('rascunhos', r).then(() => undefined), undefined)
}

export async function lerRascunhos(): Promise<RascunhoOffline[]> {
  const todos = await tentar((db) => db.getAll('rascunhos'), [])
  return todos.sort((a, b) => a.criado_em - b.criado_em)
}

export async function apagarRascunho(clientUuid: string): Promise<void> {
  await tentar((db) => db.delete('rascunhos', clientUuid).then(() => undefined), undefined)
}

export async function contarRascunhos(): Promise<number> {
  return tentar((db) => db.count('rascunhos'), 0)
}

export async function limparTudo(): Promise<void> {
  await tentar(async (db) => {
    await db.clear('membros')
    await db.clear('rascunhos')
    await db.clear('config')
  }, undefined)
}
