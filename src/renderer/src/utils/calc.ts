export function calcTraffic(bit: number): string {
  if (bit < 1024) return `${bit} B`
  bit /= 1024
  if (bit < 1024) return `${bit.toFixed(2)} KB`
  bit /= 1024
  if (bit < 1024) return `${bit.toFixed(2)} MB`
  bit /= 1024
  if (bit < 1024) return `${bit.toFixed(2)} GB`
  bit /= 1024
  if (bit < 1024) return `${bit.toFixed(2)} TB`
  bit /= 1024
  if (bit < 1024) return `${bit.toFixed(2)} PB`
  bit /= 1024
  if (bit < 1024) return `${bit.toFixed(2)} EB`
  bit /= 1024
  if (bit < 1024) return `${bit.toFixed(2)} ZB`
  bit /= 1024
  return `${bit.toFixed(2)} YB`
}
