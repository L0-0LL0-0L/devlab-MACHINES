import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { LogoMark } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — biocode" },
      { name: "description", content: "Sign in or create a biocode account to save research runs, launch drafts and your watchlist." },
      { property: "og:title", content: "Sign in — biocode" },
      { property: "og:description", content: "Access your biocode research and launch workspace." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(8, "At least 8 characters") });

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/portfolio", replace: true });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = schema.safeParse({ email, password });
    if (!p.success) return toast.error(p.error.issues[0].message);
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword(p.data);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ ...p.data, options: { emailRedirectTo: window.location.origin } });
      if (error) toast.error(error.message);
      else setSent(true);
    }
    setBusy(false);
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Google sign-in failed");
  }

  return (
    <div className="grid-bg flex min-h-[80vh] items-center justify-center px-5 py-16">
      <div className="panel w-full max-w-sm p-8">
        <LogoMark size={28} />
        <h1 className="mt-6 text-3xl">{mode === "in" ? "Sign in" : "Create account"}</h1>
        {sent ? (
          <p className="mt-4 text-sm text-muted-foreground">Check {email} for a confirmation link, then sign in.</p>
        ) : (
          <>
            <Button variant="outline" className="mt-6 w-full" onClick={google}>Continue with Google</Button>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-sm">Email<input className="field mt-1" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
              <label className="block text-sm">Password<input className="field mt-1" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
              <Button className="w-full" disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : "Create account"}</Button>
            </form>
          </>
        )}
        <button className="mt-5 text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setSent(false); }}>
          {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
