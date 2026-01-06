// chain-binary.js
// Minimal binary helpers for decoding on-chain accounts/events.

import { PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";

export function bytesEq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export class Reader {
  constructor(u8) {
    this.u8 = u8;
    this.dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    this.i = 0;
  }
  skip(n) {
    this.i += n;
  }
  u8v() {
    const v = this.dv.getUint8(this.i);
    this.i += 1;
    return v;
  }
  u32() {
    const v = this.dv.getUint32(this.i, true);
    this.i += 4;
    return v;
  }
  bool() {
    return this.u8v() !== 0;
  }
  pubkey() {
    const bytes = this.u8.subarray(this.i, this.i + 32);
    this.i += 32;
    return new PublicKey(bytes);
  }
  u64() {
    const lo = BigInt(this.dv.getUint32(this.i, true));
    const hi = BigInt(this.dv.getUint32(this.i + 4, true));
    this.i += 8;
    return (hi << 32n) + lo;
  }
  i64() {
    const lo = BigInt(this.dv.getUint32(this.i, true));
    const hi = BigInt(this.dv.getInt32(this.i + 4, true));
    this.i += 8;
    return (hi << 32n) + lo;
  }
  u128() {
    const lo = this.u64();
    const hi = this.u64();
    return (hi << 64n) + lo;
  }
}
