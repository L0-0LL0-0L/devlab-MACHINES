import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

export type Cluster = "devnet" | "mainnet-beta";
type SolanaProvider = {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  signTransaction?: <T>(tx: T) => Promise<T>;
  signMessage?: (msg: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array } | Uint8Array>;
};

type ClusterState = {
  cluster: Cluster;
  setCluster: (c: Cluster) => void;
  wallet: string | null;
  connectWallet: () => Promise<{ ok: boolean; message?: string }>;
  disconnectWallet: () => Promise<void>;
};

const Ctx = createContext<ClusterState | null>(null);
const KEY = "biocode.cluster";

export function getProvider(): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { solana?: SolanaProvider; phantom?: { solana?: SolanaProvider } };
  return w.phantom?.solana ?? w.solana ?? null;
}

export function ClusterProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [cluster, setClusterState] = useState<Cluster>("mainnet-beta");
  const [wallet, setWallet] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "devnet") setClusterState("devnet");
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      await getProvider()?.disconnect();
    } catch {
      /* provider may already be disconnected */
    }
    setWallet(null);
  }, []);

  const setCluster = useCallback(
    (c: Cluster) => {
      setClusterState((prev) => {
        if (prev === c) return prev;
        window.localStorage.setItem(KEY, c);
        // Reset all cluster-dependent state.
        qc.removeQueries({ predicate: (q) => q.queryKey.includes("cluster") });
        void disconnectWallet();
        return c;
      });
    },
    [qc, disconnectWallet],
  );

  const connectWallet = useCallback(async () => {
    const p = getProvider();
    if (!p) return { ok: false, message: "No Solana wallet found. Install Phantom or a compatible wallet." };
    try {
      const res = await p.connect();
      setWallet(res.publicKey.toString());
      return { ok: true };
    } catch {
      return { ok: false, message: "Wallet connection was cancelled." };
    }
  }, []);

  return (
    <Ctx.Provider value={{ cluster, setCluster, wallet, connectWallet, disconnectWallet }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCluster() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCluster outside ClusterProvider");
  return v;
}

export const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
export const isBase58Address = (a: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
