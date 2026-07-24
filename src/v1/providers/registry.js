import { externalCommandProvider } from './external-command.js'
import { rgProvider } from './rg.js'

const PROVIDERS = new Map([
  ['rg', rgProvider],
  ['external-command', externalCommandProvider]
])

export function getProvider(id) {
  const provider = PROVIDERS.get(id)
  if (!provider) throw new Error(`没有可执行 Provider：${id}。第三方 Manifest 在 v1 只能用于检测。`)
  validateProvider(provider)
  return provider
}

export function listProviders() {
  return [...PROVIDERS.values()].map((provider) => provider.metadata())
}

function validateProvider(provider) {
  for (const method of ['metadata', 'detect', 'healthCheck', 'plan', 'apply', 'rollback']) {
    if (typeof provider[method] !== 'function') throw new Error(`Provider 缺少 ${method}()`)
  }
}
