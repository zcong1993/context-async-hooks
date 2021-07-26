import semver from 'semver'

import { AsyncHooksContextManager as Ahcm } from './AsyncHooksContextManager'
import { AsyncLocalStorageContextManager as Alscm } from './AsyncLocalStorageContextManager'
import { ContextManager } from './types'

export const AsyncHooksContextManager = Ahcm
export const AsyncLocalStorageContextManager = Alscm

// https://github.com/open-telemetry/opentelemetry-js/pull/1525
export const createAsyncContextManager = <Context>(
  rootContext?: Context
): ContextManager<Context> => {
  return semver.gte(process.version, '14.8.0')
    ? new AsyncLocalStorageContextManager<Context>(rootContext)
    : new AsyncHooksContextManager<Context>(rootContext)
}
