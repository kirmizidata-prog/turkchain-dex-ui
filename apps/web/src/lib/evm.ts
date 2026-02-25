import { createPublicClient, createWalletClient, custom, http, type Address } from "viem";
import { turkchain } from "./turkchain";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const publicClient = createPublicClient({
  chain: turkchain,
  transport: http("https://rpc.turkchain1919.com")
});

export function getWalletClient() {
  if (typeof window === "undefined") return null;
  if (!window.ethereum) return null;

  return createWalletClient({
    chain: turkchain,
    transport: custom(window.ethereum)
  });
}

export const turkchainAddParams = {
  chainId: "0x77f", // 1919
  chainName: "Turkchain",
  nativeCurrency: { name: "TURK", symbol: "TURK", decimals: 18 },
  rpcUrls: ["https://rpc.turkchain1919.com"],
  blockExplorerUrls: ["https://turkscan.com"]
};

export async function requestAccounts(): Promise<Address> {
  if (!window.ethereum) throw new Error("no_wallet");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts?.[0]) throw new Error("no_account");
  return accounts[0] as Address;
}

export async function getChainId(): Promise<number> {
  if (!window.ethereum) throw new Error("no_wallet");
  const hex = await window.ethereum.request({ method: "eth_chainId" });
  return Number.parseInt(hex, 16);
}

export async function addTurkchain() {
  if (!window.ethereum) throw new Error("no_wallet");
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [turkchainAddParams]
  });
}

export async function switchToTurkchain() {
  if (!window.ethereum) throw new Error("no_wallet");
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: turkchainAddParams.chainId }]
  });
}
