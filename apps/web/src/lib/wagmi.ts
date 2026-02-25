import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { turkchain } from "./turkchain";

export const wagmiConfig = createConfig({
  chains: [turkchain],
  connectors: [injected()],
  transports: {
    [turkchain.id]: http("https://rpc.turkchain1919.com")
  }
});
