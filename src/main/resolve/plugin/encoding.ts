// 二进制字段的编码约定（对接指南 §12）：标准 base64 带 padding，且必须规范——解码后重新编码与输入完全一致。
import { createHash } from 'crypto'

const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/

// 规范 base64：字符集合法、解码后再编码与输入完全一致（拒绝缺 padding、多余字符、非零尾比特）
export function isCanonicalB64(s: unknown): s is string {
  if (typeof s !== 'string' || !B64_RE.test(s)) return false
  return Buffer.from(s, 'base64').toString('base64') === s
}

// 规范 base64 且解码后恰为 n 字节
export function isB64Bytes(s: unknown, n: number): s is string {
  return isCanonicalB64(s) && Buffer.from(s, 'base64').length === n
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
