import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInCard } from "@/components/ui/sign-in-card";
import { apsProvider } from "@/lib/aps-oauth-preset";

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
 * lands: cantera's sign-in card over placed's single Connect route. The href
 * template carries no provider placeholder because there is one provider and
 * one route; Vercel Connect runs the consent flow from there.
 */
export function ConnectCard({ returnTo }: { returnTo: string }) {
  return (
    <SignInCard
      className="mx-auto max-w-md"
      providers={[apsProvider]}
      hrefTemplate={`/api/auth/connect?returnTo=${encodeURIComponent(returnTo)}`}
      title={<span className="font-heading text-lg">Connect your Autodesk account</span>}
      description={
        <>
          Placed reads your Construction Cloud photo metadata — read-only (
          <code className="font-mono text-xs">data:read</code>), scoped to what
          your account can already see, and never stored.
        </>
      }
      footer={
        <Link href="/demo" className="underline underline-offset-4 hover:text-foreground">
          No account? Try the demo
        </Link>
      }
    />
  );
}
