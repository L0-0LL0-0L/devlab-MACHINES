import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, X, Wallet, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCluster, shortAddr, type Cluster } from "@/lib/cluster";

export const NAV = [
  { to: "/research", label: "Research" },
  { to: "/launchpad", label: "Launchpad" },
  { to: "/markets", label: "Markets" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/creator", label: "Creator" },
  { to: "/community", label: "Community" },
  { to: "/docs", label: "Docs" },
] as const;

function ClusterSelect() {
  const { cluster, setCluster } = useCluster();
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Solana cluster</span>
      <select
        value={cluster}
        onChange={(e) => {
          setCluster(e.target.value as Cluster);
          toast(`Switched to ${e.target.value}. Wallet and cluster data were reset.`);
        }}
        className="h-8 rounded-sm border border-input bg-background px-2 font-mono text-xs text-foreground"
      >
        <option value="mainnet-beta">mainnet</option>
        <option value="devnet">devnet</option>
      </select>
    </label>
  );
}

function WalletButton() {
  const { wallet, connectWallet, disconnectWallet } = useCluster();
  if (wallet)
    return (
      <Button variant="outline" size="sm" onClick={disconnectWallet} title="Disconnect wallet">
        <Wallet /> <span className="font-mono">{shortAddr(wallet)}</span>
      </Button>
    );
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        const r = await connectWallet();
        if (!r.ok) toast.error(r.message);
      }}
    >
      <Wallet /> Connect wallet
    </Button>
  );
}

function AccountButton() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  if (user)
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          await signOut();
          toast("Signed out");
          navigate({ to: "/", replace: true });
        }}
      >
        <LogOut /> Sign out
      </Button>
    );
  return (
    <Button size="sm" asChild>
      <Link to="/auth">Sign in</Link>
    </Button>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5">
        <Link to="/" aria-label="biocode home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <ClusterSelect />
          <WalletButton />
          <AccountButton />
        </div>
        <button
          className="ml-auto rounded-sm p-2 lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border px-5 py-4 lg:hidden">
          <nav aria-label="Mobile" className="flex flex-col">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="py-2 text-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ClusterSelect />
            <WalletButton />
            <AccountButton />
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Open infrastructure for funding, running and publishing decentralized science.
          </p>
        </div>
        <div>
          <p className="eyebrow mb-3">platform</p>
          <ul className="space-y-2 text-sm">
            {NAV.slice(0, 4).map((n) => (
              <li key={n.to}><Link to={n.to} className="text-muted-foreground hover:text-foreground">{n.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3">more</p>
          <ul className="space-y-2 text-sm">
            <li><Link to="/community" className="text-muted-foreground hover:text-foreground">Community</Link></li>
            <li><Link to="/docs" className="text-muted-foreground hover:text-foreground">Docs</Link></li>
            <li><Link to="/auth" className="text-muted-foreground hover:text-foreground">Account</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-5 py-5 font-mono text-xs text-muted-foreground">
          © {new Date().getFullYear()} biocode · v0.1 foundation · mainnet by default
        </p>
      </div>
    </footer>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <section className="grid-bg border-b border-border">
      <div className="mx-auto max-w-7xl px-5 py-16 md:py-20">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-4xl md:text-6xl">{title}</h1>
        {children && <div className="mt-5 max-w-2xl text-muted-foreground">{children}</div>}
      </div>
    </section>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-start gap-3 border-dashed p-8">
      <p className="eyebrow">empty</p>
      <h3 className="text-xl">{title}</h3>
      {children && <div className="max-w-xl text-sm text-muted-foreground">{children}</div>}
      {action}
    </div>
  );
}

export function SignInPrompt({ what }: { what: string }) {
  return (
    <EmptyState
      title={`Sign in to ${what}`}
      action={<Button asChild size="sm"><Link to="/auth">Sign in with wallet</Link></Button>}
    >
      Browsing is public. Saving work requires an account so only you can access it.
    </EmptyState>
  );
}

export function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground" aria-hidden /> {children}
    </span>
  );
}
