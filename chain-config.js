// chain-config.js
// Shared program + RPC configuration + connection factory.

import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";

export const PROGRAM_ID = new PublicKey("SEAyjT1FUx3JyXJnWt5NtjELDwuU9XsoZeZVPVvweU4");

export const RPC_HTTP = "https://mainnet.fogo.io";
export const RPC_WS = "wss://mainnet.fogo.io";

export function makeConnection() {
  return new Connection(RPC_HTTP, { commitment: "confirmed", wsEndpoint: RPC_WS });
}
