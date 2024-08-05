/* eslint-disable @typescript-eslint/no-explicit-any */

import { getPlatform } from './ipc'
const originError = console.error
const originWarn = console.warn
console.error = function (...args: any[]): void {
  if (typeof args[0] === 'string' && args[0].includes('validateDOMNesting')) {
    return
  }
  originError.call(console, args)
}
console.warn = function (...args): void {
  if (typeof args[0] === 'string' && args[0].includes('aria-label')) {
    return
  }
  originWarn.call(console, args)
}

export let platform: NodeJS.Platform

export async function init(): Promise<void> {
  platform = await getPlatform()
}
