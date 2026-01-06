// chain-pdas.js
// PDA helpers (from IDL seeds)

import { PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";
import { PROGRAM_ID } from "./chain-config.js";

export function globalStatePda() {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("global-state")],
    PROGRAM_ID
  )[0];
}

export function playerStatePda(owner) {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("player"), owner.toBuffer()],
    PROGRAM_ID
  )[0];
}
