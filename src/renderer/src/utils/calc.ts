export function calcTraffic(bit: number): string {
  if (bit < 1024) return `${bit} B`
  if (bit < 1024 * 1024) return `${(bit / 1024).toFixed(2)} KB`
  if (bit < 1024 * 1024 * 1024) return `${(bit / 1024 / 1024).toFixed(2)} MB`
  return `${(bit / 1024 / 1024 / 1024).toFixed(2)} GB`
}
