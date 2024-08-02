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

export function calcPercent(
  upload: number | undefined,
  download: number | undefined,
  total: number | undefined
): number {
  if (upload === undefined || download === undefined || total === undefined) {
    return 100
  }
  return Math.round(((upload + download) / total) * 100)
}
