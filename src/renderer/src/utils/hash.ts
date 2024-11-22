import { MD5 } from 'crypto-js'

export class HashType {
  private hashValue: string

  constructor(hash: string) {
    this.hashValue = hash
  }

  static makeHash(data: string): HashType {
    const hash = MD5(data).toString()
    return new HashType(hash)
  }

  equal(hash: HashType): boolean {
    return this.hashValue === hash.hashValue
  }

  toString(): string {
    return this.hashValue
  }

  isValid(): boolean {
    return this.hashValue.length === 32
  }
}

export function getHash(name: string): string {
  const hash = HashType.makeHash(name)
  return hash.toString()
}
