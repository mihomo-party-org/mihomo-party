export function calcTraffic(byte: number): string {
  if (byte < 1024) return `${byte} B`
  byte /= 1024
  if (byte < 1024) return `${byte.toFixed(2)} KB`
  byte /= 1024
  if (byte < 1024) return `${byte.toFixed(2)} MB`
  byte /= 1024
  if (byte < 1024) return `${byte.toFixed(2)} GB`
  byte /= 1024
  if (byte < 1024) return `${byte.toFixed(2)} TB`
  byte /= 1024
  if (byte < 1024) return `${byte.toFixed(2)} PB`
  byte /= 1024
  if (byte < 1024) return `${byte.toFixed(2)} EB`
  byte /= 1024
  if (byte < 1024) return `${byte.toFixed(2)} ZB`
  byte /= 1024
  return `${byte.toFixed(2)} YB`
}
