import { useEffect, useRef, useState } from "react";
import { Check, Copy, ChevronDown } from "lucide-react";

export const MACHINE_CA = "CABa71ogqJDjX6cQDfSJjPrG1Wpq6VNCMWXsjCvTYLab";

export function CaButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(MACHINE_CA);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = MACHINE_CA;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* clipboard unavailable */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="hardware flex items-center gap-2 px-3 py-1.5 font-mono text-xs uppercase transition-colors hover:bg-panel-2"
      >
        <span className="size-2 border border-border bg-screen-green" aria-hidden />
        CA
        <ChevronDown
          size={14}
          aria-hidden
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Contract address"
          className="hardware absolute right-0 z-30 mt-2 w-[320px] max-w-[86vw] p-3 text-left"
        >
          <p className="eyebrow mb-2">contract address / solana</p>
          <p className="select-all break-all font-mono text-[13px] leading-relaxed">{MACHINE_CA}</p>
          <button
            type="button"
            onClick={copy}
            className="mt-3 flex w-full items-center justify-center gap-2 border-2 border-border bg-background px-3 py-2 font-mono text-xs uppercase transition-colors hover:bg-panel-2"
          >
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            {copied ? "copied to clipboard" : "copy address"}
          </button>
        </div>
      )}
    </div>
  );
}
