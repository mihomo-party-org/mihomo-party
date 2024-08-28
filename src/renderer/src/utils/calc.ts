export function calcTraffic(byte: number): string {
  if (byte < 1024) return `${formatNumString(byte)} B`
  byte /= 1024
  if (byte < 1024) return `${formatNumString(byte)} KB`
  byte /= 1024
  if (byte < 1024) return `${formatNumString(byte)} MB`
  byte /= 1024
  if (byte < 1024) return `${formatNumString(byte)} GB`
  byte /= 1024
  if (byte < 1024) return `${formatNumString(byte)} TB`
  byte /= 1024
  if (byte < 1024) return `${formatNumString(byte)} PB`
  byte /= 1024
  if (byte < 1024) return `${formatNumString(byte)} EB`
  byte /= 1024
  if (byte < 1024) return `${formatNumString(byte)} ZB`
  byte /= 1024
  return `${formatNumString(byte)} YB`
}

function formatNumString(num: number): string {
  let str = num.toFixed(2)
  if (str.length <= 5) return str
  if (str.length == 6) {
    str = num.toFixed(1)
    return str
  } else {
    str = Math.round(num).toString()
    return str
  }
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
