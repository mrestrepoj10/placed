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
