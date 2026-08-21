import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Shown when the deployment itself isn't wired to Vercel Connect (unlinked
 * local checkout, missing connector) — a deployer problem, not a visitor one.
 */
export function SetupCard() {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="font-heading">
          Autodesk connection not configured
        </CardTitle>
        <CardDescription>
          This deployment isn&apos;t linked to a Vercel Connect connector yet.
          Local dev needs <code className="font-mono text-xs">vercel link
          &amp;&amp; vercel env pull</code>; a deployment needs the
          <code className="font-mono text-xs"> autodesk</code> OAuth connector
          — see the README&apos;s “Deploy your own”.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="ghost" size="sm">
          <Link href="/demo">Meanwhile — try the demo</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * The connect prompt, shown anywhere a visitor without an Autodesk grant
 * lands. Plain markup — renders from server or client components.
 */
export function ConnectCard({ returnTo }: { returnTo: string }) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="font-heading">
          Connect your Autodesk account
        </CardTitle>
        <CardDescription>
          Placed reads your Construction Cloud photo metadata — read-only
          (<code className="font-mono text-xs">data:read</code>), scoped to
          what your account can already see, and never stored.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button asChild>
          <a href={`/api/auth/connect?returnTo=${encodeURIComponent(returnTo)}`}>
            Connect Autodesk
            <ArrowRight className="size-4" aria-hidden />
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/demo">No account? Try the demo</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
