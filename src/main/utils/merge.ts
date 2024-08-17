// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item)
}

export function deepMerge<T extends object>(target: T, other: Partial<T>): T {
  for (const key in other) {
    if (isObject(other[key])) {
      if (!target[key]) Object.assign(target, { [key]: {} })
      deepMerge(target[key] as object, other[key] as object)
    } else {
      Object.assign(target, { [key]: other[key] })
    }
  }
  return target as T
}
