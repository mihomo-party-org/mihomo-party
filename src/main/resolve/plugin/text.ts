// 机场可写的自由文本（§4.2）：错误 JSON 的 message、.cpx 的 provider.description。
// 清洗：trim、去除除换行（U+000A）外的控制字符（U+0000–U+001F、U+007F）、按码点截断；空串视为无。
// 渲染层只作为 React 文本节点显示（whitespace-pre-line），不做 Markdown、不识别链接。
export function sanitizeProviderText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim()
  if (cleaned === '') return undefined
  const points = Array.from(cleaned)
  return points.length > max ? points.slice(0, max).join('') : cleaned
}

export const MAX_PROVIDER_MESSAGE = 200
export const MAX_PROVIDER_DESCRIPTION = 500
