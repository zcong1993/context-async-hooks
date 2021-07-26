import EventEmitter from 'events'
import semver from 'semver'
import {
  AsyncHooksContextManager,
  AsyncLocalStorageContextManager,
  createAsyncContextManager,
} from '../src'
import { ContextManager } from '../src/types'

it('createAsyncContextManager should work', () => {
  const cm = createAsyncContextManager()
  if (semver.lt(process.version, '14.8.0')) {
    expect(cm).toBeInstanceOf(AsyncHooksContextManager)
  } else {
    expect(cm).toBeInstanceOf(AsyncLocalStorageContextManager)
  }
})

describe.each([AsyncLocalStorageContextManager, AsyncHooksContextManager])(
  '%p',
  (CM) => {
    if (
      CM.name === 'AsyncLocalStorageContextManager' &&
      semver.lt(process.version, '14.8.0')
    ) {
      return
    }

    const key1 = 'test'

    let contextManager: ContextManager<any>
    let otherContextManager: ContextManager<any>

    beforeEach(() => {
      contextManager = new CM()
      contextManager.enable()
    })

    afterEach(() => {
      contextManager.disable()
      otherContextManager?.disable()
    })

    describe('.enable()', () => {
      it('should work', () => {
        expect(() => {
          contextManager = new CM()
          expect(contextManager.enable()).toEqual(contextManager)
        }).not.toThrow()
      })
    })

    describe('.disable()', () => {
      it('should work', () => {
        expect(() => {
          expect(contextManager.disable()).toEqual(contextManager)
          contextManager.enable()
        }).not.toThrow()
      })
    })

    describe('.with()', () => {
      it('should run the callback (null as target)', (done) => {
        contextManager.with(null, done)
      })

      it('should run the callback (object as target)', (done) => {
        const test = { [key1]: 'test' }
        contextManager.with(test, () => {
          expect(contextManager.active()).toStrictEqual(test)
          return done()
        })
      })

      it('should run the callback (when disabled)', (done) => {
        contextManager.disable()
        contextManager.with(null, () => {
          contextManager.enable()
          return done()
        })
      })

      it('should rethrow errors', () => {
        expect(() => {
          contextManager.with(null, () => {
            throw new Error('This should be rethrown')
          })
        }).toThrow()
      })

      it('should forward this, arguments and return value', () => {
        function fnWithThis(this: string, a: string, b: number): string {
          expect(this).toStrictEqual('that')
          expect(arguments.length).toStrictEqual(2)
          expect(a).toStrictEqual('one')
          expect(b).toStrictEqual(2)
          return 'done'
        }

        const res = contextManager.with(null, fnWithThis, 'that', 'one', 2)
        expect(res).toStrictEqual('done')

        expect(contextManager.with(null, () => 3.14)).toStrictEqual(3.14)
      })

      it('should finally restore an old context', (done) => {
        const ctx1 = { [key1]: 'ctx1' }
        const ctx2 = { [key1]: 'ctx2' }
        contextManager.with(ctx1, () => {
          expect(contextManager.active()).toStrictEqual(ctx1)
          contextManager.with(ctx2, () => {
            expect(contextManager.active()).toStrictEqual(ctx2)
          })
          expect(contextManager.active()).toStrictEqual(ctx1)
          return done()
        })
      })

      it('should finally restore an old context', (done) => {
        const ctx1 = { [key1]: 'ctx1' }
        contextManager.with(ctx1, () => {
          expect(contextManager.active()).toStrictEqual(ctx1)
          setTimeout(() => {
            expect(contextManager.active()).toStrictEqual(ctx1)
            return done()
          })
        })
      })

      it('async function called from nested "with" sync function should return nested context', (done) => {
        const scope1 = '1' as any
        const scope2 = '2' as any

        const asyncFuncCalledDownstreamFromSync = async () => {
          await (async () => {})()
          expect(contextManager.active()).toStrictEqual(scope2)
          return done()
        }

        contextManager.with(scope1, () => {
          expect(contextManager.active()).toStrictEqual(scope1)
          contextManager.with(scope2, () => asyncFuncCalledDownstreamFromSync())
          expect(contextManager.active()).toStrictEqual(scope1)
        })
        expect(contextManager.active()).toBeUndefined()
      })

      it('should not loose the context', (done) => {
        const scope1 = '1' as any

        contextManager.with(scope1, async () => {
          expect(contextManager.active()).toStrictEqual(scope1)
          await new Promise((resolve) => setTimeout(resolve, 100))
          expect(contextManager.active()).toStrictEqual(scope1)
          return done()
        })
        expect(contextManager.active()).toBeUndefined()
      })

      it('should correctly restore context using async/await', async () => {
        const scope1 = '1' as any
        const scope2 = '2' as any
        const scope3 = '3' as any
        const scope4 = '4' as any

        await contextManager.with(scope1, async () => {
          expect(contextManager.active()).toStrictEqual(scope1)
          await contextManager.with(scope2, async () => {
            expect(contextManager.active()).toStrictEqual(scope2)
            await contextManager.with(scope3, async () => {
              expect(contextManager.active()).toStrictEqual(scope3)
              await contextManager.with(scope4, async () => {
                expect(contextManager.active()).toStrictEqual(scope4)
              })
              expect(contextManager.active()).toStrictEqual(scope3)
            })
            expect(contextManager.active()).toStrictEqual(scope2)
          })
          expect(contextManager.active()).toStrictEqual(scope1)
        })
      })

      it('should works with multiple concurrent operations', (done) => {
        const scope1 = '1' as any
        const scope2 = '2' as any
        const scope3 = '3' as any
        const scope4 = '4' as any
        let scope4Called = false

        contextManager.with(scope1, async () => {
          expect(contextManager.active()).toStrictEqual(scope1)
          setTimeout(async () => {
            await contextManager.with(scope3, async () => {
              expect(contextManager.active()).toStrictEqual(scope3)
            })
            expect(contextManager.active()).toStrictEqual(scope1)
            expect(scope4Called).toBeTruthy()
            return done()
          }, 100)
          expect(contextManager.active()).toStrictEqual(scope1)
        })

        expect(contextManager.active()).toBeUndefined()

        contextManager.with(scope2, async () => {
          expect(contextManager.active()).toStrictEqual(scope2)
          setTimeout(() => {
            contextManager.with(scope4, async () => {
              expect(contextManager.active()).toStrictEqual(scope4)
              scope4Called = true
            })
            expect(contextManager.active()).toStrictEqual(scope2)
          }, 20)
          expect(contextManager.active()).toStrictEqual(scope2)
        })
        expect(contextManager.active()).toBeUndefined()
      })

      it('should work with timers using the same timeout', (done) => {
        let cnt = 3
        function countDown() {
          cnt--
          if (cnt === 0) done()
          if (cnt < 0) throw new Error('too many calls to countDown()')
        }

        const time1 = 2
        const time2 = time1 + 1
        const rootCtx = contextManager.active()
        const innerCtx = { [Symbol('test')]: 23 }
        contextManager.with(innerCtx, () => {
          setTimeout(() => {
            expect(contextManager.active()).toStrictEqual(innerCtx)
            countDown()
          }, time1)
        })
        setTimeout(() => {
          expect(contextManager.active()).toStrictEqual(rootCtx)
          countDown()
        }, time1)
        setTimeout(() => {
          expect(contextManager.active()).toStrictEqual(rootCtx)
          countDown()
        }, time2)
      })

      it('should not influence other instances', () => {
        otherContextManager = new CM()
        otherContextManager.enable()

        const context = { [key1]: 2 }
        const otherContext = { [key1]: 3 }
        contextManager.with(context, () => {
          expect(contextManager.active()).toStrictEqual(context)
          expect(otherContextManager.active()).toBeUndefined()
          otherContextManager.with(otherContext, () => {
            expect(contextManager.active()).toStrictEqual(context)
            expect(otherContextManager.active()).toStrictEqual(otherContext)
          })
        })
      })
    })

    describe('.bind(function)', () => {
      it('should return the same target (when enabled)', () => {
        const test = { a: 1 }
        expect(contextManager.bind(undefined, test)).toStrictEqual(test)
      })

      it('should return the same target (when disabled)', () => {
        contextManager.disable()
        const test = { a: 1 }
        expect(contextManager.bind(undefined, test)).toStrictEqual(test)
        contextManager.enable()
      })

      it('should return current context (when enabled)', (done) => {
        const context = { [key1]: 1 }
        const fn = contextManager.bind(context, () => {
          expect(contextManager.active()).toStrictEqual(context)
          return done()
        })
        fn()
      })

      it('should return current context (when disabled)', (done) => {
        contextManager.disable()
        const context = { [key1]: 1 }
        const fn = contextManager.bind(context, () => {
          expect(contextManager.active()).toStrictEqual(context)
          return done()
        })
        fn()
      })

      it('should fail to return current context with async op', (done) => {
        const context = { [key1]: 1 }
        const fn = contextManager.bind(context, () => {
          expect(contextManager.active()).toStrictEqual(context)
          setTimeout(() => {
            expect(contextManager.active()).toStrictEqual(context)
            return done()
          }, 100)
        })
        fn()
      })

      it('should not influence other instances', () => {
        otherContextManager = new CM()
        otherContextManager.enable()

        const context = { [key1]: 2 }
        const otherContext = { [key1]: 3 }
        const fn = otherContextManager.bind(
          otherContext,
          contextManager.bind(context, () => {
            expect(contextManager.active()).toStrictEqual(context)
            expect(otherContextManager.active()).toStrictEqual(otherContext)
          })
        )
        fn()
      })
    })

    describe('.bind(event-emitter)', () => {
      it('should return the same target (when enabled)', () => {
        const ee = new EventEmitter()
        expect(contextManager.bind(undefined, ee)).toStrictEqual(ee)
      })

      it('should return the same target (when disabled)', () => {
        const ee = new EventEmitter()
        contextManager.disable()
        expect(contextManager.bind(undefined, ee)).toStrictEqual(ee)
      })

      it('should return current context and removeListener (when enabled)', (done) => {
        const ee = new EventEmitter()
        const context = { [key1]: 2 }
        const patchedEE = contextManager.bind(context, ee)
        const handler = () => {
          expect(contextManager.active()).toStrictEqual(context)
          patchedEE.removeListener('test', handler)
          expect(patchedEE.listeners('test').length).toEqual(0)
          return done()
        }
        patchedEE.on('test', handler)
        expect(patchedEE.listeners('test').length).toEqual(1)
        patchedEE.emit('test')
      })

      it('should return current context and removeAllListener (when enabled)', (done) => {
        const ee = new EventEmitter()
        const context = { [key1]: 2 }
        const patchedEE = contextManager.bind(context, ee)
        const handler = () => {
          expect(contextManager.active()).toStrictEqual(context)
          patchedEE.removeAllListeners('test')
          expect(patchedEE.listeners('test').length).toEqual(0)
          return done()
        }
        patchedEE.on('test', handler)
        expect(patchedEE.listeners('test').length).toEqual(1)
        patchedEE.emit('test')
      })

      it('should return current context and removeAllListeners (when enabled)', (done) => {
        const ee = new EventEmitter()
        const context = { [key1]: 2 }
        const patchedEE = contextManager.bind(context, ee)
        const handler = () => {
          expect(contextManager.active()).toStrictEqual(context)
          patchedEE.removeAllListeners()
          expect(patchedEE.listeners('test').length).toEqual(0)
          expect(patchedEE.listeners('test1').length).toEqual(0)
          return done()
        }
        patchedEE.on('test', handler)
        patchedEE.on('test1', handler)
        expect(patchedEE.listeners('test').length).toEqual(1)
        expect(patchedEE.listeners('test1').length).toEqual(1)
        patchedEE.emit('test')
      })

      /**
       * Even if asynchooks is disabled, the context propagation will
       * still works but it might be lost after any async op.
       */
      it('should return context (when disabled)', (done) => {
        contextManager.disable()
        const ee = new EventEmitter()
        const context = { [key1]: 2 }
        const patchedEE = contextManager.bind(context, ee)
        const handler = () => {
          expect(contextManager.active()).toStrictEqual(context)
          patchedEE.removeListener('test', handler)
          expect(patchedEE.listeners('test').length).toEqual(0)
          return done()
        }
        patchedEE.on('test', handler)
        expect(patchedEE.listeners('test').length).toEqual(1)
        patchedEE.emit('test')
      })

      it('should not return current context with async op', (done) => {
        const ee = new EventEmitter()
        const context = { [key1]: 2 }
        const patchedEE = contextManager.bind(context, ee)
        const handler = () => {
          expect(contextManager.active()).toStrictEqual(context)
          setImmediate(() => {
            expect(contextManager.active()).toStrictEqual(context)
            patchedEE.removeAllListeners('test')
            expect(patchedEE.listeners('test').length).toEqual(0)
            return done()
          })
        }
        patchedEE.on('test', handler)
        expect(patchedEE.listeners('test').length).toEqual(1)
        patchedEE.emit('test')
      })

      it('should not influence other instances', () => {
        const ee = new EventEmitter()
        otherContextManager = new CM()
        otherContextManager.enable()

        const context = { [key1]: 2 }
        const otherContext = { [key1]: 3 }
        const patchedEE = otherContextManager.bind(
          otherContext,
          contextManager.bind(context, ee)
        )
        const handler = () => {
          expect(contextManager.active()).toStrictEqual(context)
          expect(contextManager.active()).toStrictEqual(context)
        }

        patchedEE.on('test', handler)
        patchedEE.emit('test')
      })
    })

    describe('with rootContext', () => {
      it('should works', (done) => {
        const scope1 = '1'
        const rootScope = '0'
        contextManager = new CM(rootScope)
        contextManager.enable()

        contextManager.with(scope1, async () => {
          expect(contextManager.active()).toStrictEqual(scope1)
          await new Promise((resolve) => setTimeout(resolve, 100))
          expect(contextManager.active()).toStrictEqual(scope1)
          return done()
        })
        expect(contextManager.active()).toStrictEqual(rootScope)
      })
    })
  }
)
