// process-fish-watcher.js
// Chain-only logic for detecting ProcessFish instructions and extracting the
// SPL token mint delta for the player.

import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";

function toKeyStr(k) {
  return typeof k === "string"
    ? k
    : k?.pubkey?.toBase58?.() || k?.toBase58?.() || String(k);
}

export function createProcessFishWatcher({
  connection,
  programId,
  commitment = "confirmed",
  maxSupportedTransactionVersion = 0,
} = {}) {
  if (!connection) throw new Error("connection required");
  if (!programId) throw new Error("programId required");

  const conn = connection instanceof Connection ? connection : new Connection(connection, commitment);
  const pid = programId instanceof PublicKey ? programId : new PublicKey(programId);

  let unsub = null;

  async function start({ onEvent } = {}) {
    if (unsub) return;

    const subId = conn.onLogs(
      pid,
      async ({ signature, logs, err }) => {
        // Only ProcessFish logs
        if (!logs?.some((l) => l.includes("Instruction: ProcessFish"))) return;

        // Omit errored transactions
        if (err) return;

        try {
          const ptx = await conn.getParsedTransaction(signature, {
            commitment,
            maxSupportedTransactionVersion,
          });

          // Double-guard: skip if fetch reports an error
          if (ptx?.meta?.err) return;

          const msgKeys = ptx?.transaction?.message?.accountKeys || [];
          const keyStrs = msgKeys.map(toKeyStr);

          // Collect all parsed instructions (outer + inner)
          const parsed = [];
          for (const ix of ptx?.transaction?.message?.instructions || []) parsed.push(ix);
          for (const inner of ptx?.meta?.innerInstructions || []) {
            for (const ix of inner.instructions || []) parsed.push(ix);
          }

          // Find SPL Token mintTo; pick the largest mint amount if multiple
          let best = null;
          for (const ix of parsed) {
            const p = ix?.parsed;
            const type = p?.type;
            const info = p?.info;
            if (type !== "mintTo" || !info) continue;
            const raw = BigInt(info.amount || "0");
            if (!best || raw > best.raw) best = { raw, info };
          }

          if (!best) {
            onEvent?.({ signature, kind: "process_fish", decoded: false });
            return;
          }

          const dest = best.info.account;
          const acctIndex = keyStrs.indexOf(dest);
          const post = ptx?.meta?.postTokenBalances || [];
          const pre = ptx?.meta?.preTokenBalances || [];
          const postEntry = post.find((b) => b.accountIndex === acctIndex);
          const preEntry = pre.find((b) => b.accountIndex === acctIndex);

          const decimals =
            postEntry?.uiTokenAmount?.decimals ??
            preEntry?.uiTokenAmount?.decimals ??
            0;

          const postAmt = BigInt(postEntry?.uiTokenAmount?.amount || "0");
          const preAmt = BigInt(preEntry?.uiTokenAmount?.amount || "0");
          const netRaw = postAmt - preAmt;

          const owner = postEntry?.owner || preEntry?.owner || null;

          // In process_fish, the player receives 90% of the processed amount.
          // gross = net / 0.9 = net * 10 / 9
          const grossRaw = (netRaw * 10n + 9n - 1n) / 9n; // ceil
          const feeRaw = grossRaw - netRaw;

          onEvent?.({
            signature,
            kind: "process_fish",
            decoded: true,
            owner,
            decimals,
            netRaw,
            grossRaw,
            feeRaw,
          });
        } catch {
          // Transactions can be pruned; still surface the detection.
          onEvent?.({ signature, kind: "process_fish", decoded: false });
        }
      },
      commitment
    );

    unsub = async () => {
      try {
        await conn.removeOnLogsListener(subId);
      } catch {}
      unsub = null;
    };
  }

  async function stop() {
    if (!unsub) return;
    await unsub();
  }

  return { start, stop, get isLive() { return !!unsub; } };
}
