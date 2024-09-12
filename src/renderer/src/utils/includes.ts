export function includesIgnoreCase(mainStr: string = '', subStr: string = ''): boolean {
  return mainStr.toLowerCase().includes(subStr.toLowerCase())
}
