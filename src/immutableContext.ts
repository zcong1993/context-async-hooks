export class ImmutableContext<T extends Record<any, any>> {
  private current: T

  constructor(parent?: T) {
    if (parent) {
      this.current = { ...parent }
    }
  }

  unwrap() {
    return this.current
  }

  getValue<K extends keyof T>(key: K): T[K] {
    return this.current[key]
  }

  setValue<K extends keyof T>(key: K, value: T[K]): ImmutableContext<T> {
    const oc = new ImmutableContext(this.current)
    oc.current[key] = value
    return oc
  }

  deleteValue<K extends keyof T>(key: K): ImmutableContext<T> {
    const oc = new ImmutableContext(this.current)
    delete oc.current[key]
    return oc
  }
}
