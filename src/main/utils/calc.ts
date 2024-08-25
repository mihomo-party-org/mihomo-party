export function calcTraffic(byte: number): string {
  if (byte < 1024) return `${byte} B`
  byte /= 1024
  if (byte < 1024) return `${Math.round(byte)} KB`
  byte /= 1024
  if (byte < 1024) return `${Math.round(byte)} MB`
  byte /= 1024
  if (byte < 1024) return `${Math.round(byte)} GB`
  byte /= 1024
  if (byte < 1024) return `${Math.round(byte)} TB`
  byte /= 1024
  if (byte < 1024) return `${Math.round(byte)} PB`
  byte /= 1024
  if (byte < 1024) return `${Math.round(byte)} EB`
  byte /= 1024
  if (byte < 1024) return `${Math.round(byte)} ZB`
  byte /= 1024
  return `${Math.round(byte)} YB`
}
