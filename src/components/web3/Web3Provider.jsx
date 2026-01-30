// BlockWard uses platform-managed wallets only.
// This provider is intentionally a NO-OP.
// Do NOT add MetaMask, Wagmi, RainbowKit, or WalletConnect here.

export default function Web3Provider({ children }) {
  return <>{children}</>;
}
