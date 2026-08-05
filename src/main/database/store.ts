import Store from 'electron-store'
import { SafeStore } from '../../preload/types/ipc-types'

const StoreClass = (Store as unknown as { default: new () => unknown }).default || Store
export const store = new (StoreClass as new () => unknown)() as unknown as SafeStore
