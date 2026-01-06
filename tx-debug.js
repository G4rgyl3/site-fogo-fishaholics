// tx-debug.js
// (Optional) Debug helper extracted from the inline module that was fetching a single tx.

import { Connection } from "https://esm.sh/@solana/web3.js@1.98.0";

export async function fetchTxLogs(
  sig,
  {
    rpc = "https://mainnet.fogo.io",
    commitment = "finalized",
    maxSupportedTransactionVersion = 1,
  } = {}
) {
  const conn = new Connection(rpc, commitment);
  const tx = await conn.getTransaction(sig, {
    commitment,
    maxSupportedTransactionVersion,
  });
  return {
    tx,
    err: tx?.meta?.err ?? null,
    logs: tx?.meta?.logMessages ?? null,
  };
}

// Convenience for the console:
//   import { fetchTxLogs } from './tx-debug.js';
//   const { err, logs, tx } = await fetchTxLogs('<SIG>');
//   console.log({ err, logs, tx });
