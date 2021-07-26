import semver from 'semver'

import { AsyncHooksContextManager } from './AsyncHooksContextManager'
import { AsyncLocalStorageContextManager } from './AsyncLocalStorageContextManager'
import { ContextManager } from './types'

export const createAsyncContextManager = <Context>(
  rootContext?: Context
): ContextManager<Context> => {
  return semver.gte(process.version, '14.8.0')
    ? new AsyncLocalStorageContextManager<Context>(rootContext)
    : new AsyncHooksContextManager<Context>(rootContext)
}
