import Store from 'electron-store'
import { SafeStore } from '../../preload/types/ipc-types'

const StoreClass = (Store as unknown as { default: new () => unknown }).default || Store

let _store: SafeStore | null = null

export const store = new Proxy({} as SafeStore, {
  get(_target, prop: string | symbol) {
    if (!_store) {
      _store = new (StoreClass as new () => SafeStore)()
    }

    const targetStore = _store as unknown as Record<string | symbol, unknown>
    const value = targetStore[prop]

    if (typeof value === 'function') {
      return value.bind(_store)
    }

    return value
  }
})
