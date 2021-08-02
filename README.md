# context-async-hooks

[![NPM version](https://img.shields.io/npm/v/@zcong/context-async-hooks.svg?style=flat)](https://npmjs.com/package/@zcong/context-async-hooks)
[![NPM downloads](https://img.shields.io/npm/dm/@zcong/context-async-hooks.svg?style=flat)](https://npmjs.com/package/@zcong/context-async-hooks)
[![codecov](https://codecov.io/gh/zcong1993/context-async-hooks/branch/master/graph/badge.svg)](https://codecov.io/gh/zcong1993/context-async-hooks)

> OpenTelemetry AsyncHooks-based Context Manager for all

## Install

```bash
$ yarn add @zcong/context-async-hooks
# or npm
$ npm i @zcong/context-async-hooks --save
```

## Usage

```ts
const ctx1 = { [key1]: 'ctx1' }
const ctx2 = { [key1]: 'ctx2' }
contextManager.with(ctx1, () => {
  expect(contextManager.active()).toStrictEqual(ctx1)
  contextManager.with(ctx2, () => {
    expect(contextManager.active()).toStrictEqual(ctx2)
  })
  expect(contextManager.active()).toStrictEqual(ctx1)
})
```

### bind function

```ts
const context = { [key1]: 1 }
const fn = contextManager.bind(context, () => {
  expect(contextManager.active()).toStrictEqual(context)
})
fn()
```

### bind EventEmitter

```ts
const ee = new EventEmitter()
const context = { [key1]: 2 }
const patchedEE = contextManager.bind(context, ee)
const handler = () => {
  expect(contextManager.active()).toStrictEqual(context)
  patchedEE.removeListener('test', handler)
}
patchedEE.on('test', handler)
patchedEE.emit('test')
```

### use ImmutableContext

```ts
const ctx1 = new ImmutableContext<TestCtx>({ test: 'ctx1' })
contextManager.with(ctx1, () => {
  expect(contextManager.active()).toStrictEqual(ctx1)
  const ctx2 = ctx1.setValue('num', 18)
  contextManager.with(ctx2, () => {
    expect(contextManager.active()).toStrictEqual(ctx2)
    expect(contextManager.active().getValue('test')).toEqual('ctx1')
    expect(contextManager.active().getValue('num')).toEqual(18)

    const ctx3 = ctx2.deleteValue('num')
    contextManager.with(ctx3, () => {
      expect(contextManager.active()).toStrictEqual(ctx3)
      expect(contextManager.active().getValue('test')).toEqual('ctx1')
      expect(contextManager.active().getValue('num')).toBeUndefined()
      expect(contextManager.active().unwrap()).toStrictEqual(ctx1.unwrap())
    })
  })
  // actually restore old context
  expect(contextManager.active()).toStrictEqual(ctx1)
  expect(contextManager.active().getValue('test')).toEqual('ctx1')
  expect(contextManager.active().getValue('num')).toBeUndefined()
})
```

## License

MIT &copy; zcong1993
