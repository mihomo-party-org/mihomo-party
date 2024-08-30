// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item)
}

export function deepMerge<T extends object>(target: T, other: Partial<T>): T {
  for (const key in other) {
    if (isObject(other[key])) {
      if (key.endsWith('!')) {
        const k = key.slice(0, -1)
        target[k] = other[key]
      } else {
        if (!target[key]) Object.assign(target, { [key]: {} })
        deepMerge(target[key] as object, other[key] as object)
      }
    } else if (Array.isArray(other[key])) {
      if (key.startsWith('+')) {
        const k = key.slice(1)
        if (!target[k]) Object.assign(target, { [k]: [] })
        target[k] = [...other[key], ...(target[k] as never[])]
      } else if (key.endsWith('+')) {
        const k = key.slice(0, -1)
        if (!target[k]) Object.assign(target, { [k]: [] })
        target[k] = [...(target[k] as never[]), ...other[key]]
      } else {
        Object.assign(target, { [key]: other[key] })
      }
    } else {
      Object.assign(target, { [key]: other[key] })
    }
  }
  return target as T
}
