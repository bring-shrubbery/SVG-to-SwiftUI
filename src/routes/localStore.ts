import { writable } from 'svelte/store'
import type { Writable } from 'svelte/store'

export function localStore(key: string, value: string): Writable<string> {
  const data = typeof localStorage != 'undefined' ? localStorage.getItem(key) : null
  const store = writable(value)
  if (data !== null) {
    store.set(data)
  }
  store.subscribe(val => {
    if (typeof localStorage == 'undefined') {
      return
    }
    localStorage.setItem(key, val)
  })

  return store
}