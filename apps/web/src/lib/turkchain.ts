import { defineChain } from "viem";

export const turkchain = defineChain({
  id: 1919,
  name: "Turkchain",
  nativeCurrency: { name: "TURK", symbol: "TURK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.turkchain1919.com"] }
  },
  blockExplorers: {
    default: { name: "TurkScan", url: "https://turkscan.com" }
  }
});

export const contracts = {
  wtc: "0xa1aCbf1244fBb5cabB0b2ef2c2bB40Dbf89a4794",
  factory: "0xCb8A04a9Cd9a0Cbdf7E4f9f23caA4d206e98aef7",
  router: "0x8E2544927043cc65B04dE1Db7Be31e85400e2C1f",
  multicall2: "0x03a37156c217F4a7eB5Dcd1B668436d45B29aF24",
  pair_wtc_usdt: "0x5a2D8eB7bF5343d2B0836D9C22D4426Cc9f21b38"
} as const;

export const tokens = {
  usdt: { address: "0x0347c1a533Bf744d06Cea9Fa308FCe7d9336a29a", symbol: "USDT", decimals: 6 },
  wtc: { address: "0xa1aCbf1244fBb5cabB0b2ef2c2bB40Dbf89a4794", symbol: "WTC", decimals: 18 }
} as const;
