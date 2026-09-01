"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * A value someone has to paste into another system. Shown in full and always
 * selectable — the copy button is the convenience, not the only way out, since
 * the Clipboard API is unavailable on non-secure origins.
 */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Denied or unsupported — the value stays there to select by hand.
    }
  }

  return (
    <div className="flex items-center gap-3 border bg-muted/40 py-2 pr-2 pl-3">
      <code className="min-w-0 flex-1 font-mono text-xs break-all">
        {value}
      </code>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="shrink-0"
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
