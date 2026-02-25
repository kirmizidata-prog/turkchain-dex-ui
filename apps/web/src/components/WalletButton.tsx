"use client";

import { useWallet } from "@/lib/useWallet";

export default function WalletButton() {
  const { address, chainId, status, connect, ensureTurkchain } = useWallet();

  return (
    <div className="flex items-center gap-2">
      {!address ? (
        <button className="rounded-xl border px-3 py-2 text-sm" onClick={connect} type="button">
          Connect
        </button>
      ) : (
        <div className="text-xs opacity-80">
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
      )}

      {chainId !== 1919 ? (
        <button className="rounded-xl bg-black px-3 py-2 text-sm text-white" onClick={ensureTurkchain} type="button">
          Switch 1919
        </button>
      ) : null}

      {status ? <div className="text-xs opacity-60">{status}</div> : null}
    </div>
  );
}
