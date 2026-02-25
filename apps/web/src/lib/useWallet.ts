"use client";

import * as React from "react";
import type { Address } from "viem";
import { addTurkchain, getChainId, requestAccounts, switchToTurkchain } from "./evm";

export function useWallet() {
  const [address, setAddress] = React.useState<Address | null>(null);
  const [chainId, setChainId] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<string>("");

  async function refresh() {
    try {
      const cid = await getChainId();
      setChainId(cid);
    } catch {
      setChainId(null);
    }
  }

  async function connect() {
    setStatus("");
    try {
      const a = await requestAccounts();
      setAddress(a);
      await refresh();
    } catch (e: any) {
      setStatus(e?.message || "connect_failed");
    }
  }

  async function ensureTurkchain() {
    setStatus("");
    try {
      const cid = await getChainId();
      if (cid === 1919) {
        setChainId(cid);
        return;
      }
      try {
        await switchToTurkchain();
      } catch {
        await addTurkchain();
        await switchToTurkchain();
      }
      await refresh();
    } catch (e: any) {
      setStatus(e?.message || "switch_failed");
    }
  }

  React.useEffect(() => {
    refresh();

    if (typeof window === "undefined") return;
    const eth = (window as any).ethereum;
    if (!eth?.on) return;

    const onAccounts = (accounts: string[]) => {
      setAddress((accounts?.[0] as Address) || null);
    };
    const onChain = (hex: string) => {
      setChainId(Number.parseInt(hex, 16));
    };

    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);

    return () => {
      try {
        eth.removeListener("accountsChanged", onAccounts);
        eth.removeListener("chainChanged", onChain);
      } catch {}
    };
  }, []);

  return {
    address,
    chainId,
    status,
    connect,
    ensureTurkchain
  };
}
