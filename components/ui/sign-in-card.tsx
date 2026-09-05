'use client'

import type * as React from 'react'
import { useState } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ProviderSignInButton, ProviderSignInLink } from '@/components/ui/provider-sign-in-button'
import type { OAuthProvider } from '@/lib/oauth-types'
import { cn } from '@/lib/utils'

interface SignInCardProps extends Omit<React.ComponentProps<typeof Card>, 'title'> {
  providers: OAuthProvider[]
  /** "{provider}" is replaced with the provider id, e.g. "/api/auth/{provider}".
   * Serializable, so the card can render from a server component. */
  hrefTemplate?: string
  onSignIn?: (providerId: string) => void | Promise<void>
  loadingProvider?: string
  title?: React.ReactNode
  /** Pick the heading level that fits the page outline, or "div" to opt out
   * when the surrounding page already provides one. */
  titleAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div'
  description?: React.ReactNode
  footer?: React.ReactNode
}

/** Thenable check, not `instanceof Promise`: a polyfilled or cross-realm
 * promise is still a pending round trip the buttons must reflect. */
function isPromiseLike(value: void | Promise<void>): value is Promise<void> {
  return value != null && typeof (value as Promise<void>).then === 'function'
}

function SignInCard({
  providers,
  hrefTemplate,
  onSignIn,
  loadingProvider,
  title = 'Sign in',
  titleAs: TitleTag = 'h2',
  description,
  footer,
  className,
  ...props
}: SignInCardProps) {
  const [pendingProvider, setPendingProvider] = useState<string>()
  const activeProvider = loadingProvider ?? pendingProvider

  function handleSignIn(providerId: string) {
    const result = onSignIn?.(providerId)
    if (!isPromiseLike(result)) return
    setPendingProvider(providerId)
    result.then(
      () => setPendingProvider(undefined),
      () => setPendingProvider(undefined),
    )
  }

  return (
    <Card data-slot="sign-in-card" className={cn('w-full max-w-sm', className)} {...props}>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          <TitleTag>{title}</TitleTag>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {providers.map((provider) => {
          const href = hrefTemplate?.replaceAll('{provider}', provider.id)
          const loading = activeProvider === provider.id
          // One OAuth flow at a time: a second redirect would race the first.
          const disabled = activeProvider !== undefined && !loading

          return href !== undefined ? (
            <ProviderSignInLink
              key={provider.id}
              provider={provider}
              href={href}
              loading={loading}
              disabled={disabled}
            />
          ) : (
            <ProviderSignInButton
              key={provider.id}
              provider={provider}
              onSignIn={onSignIn ? () => handleSignIn(provider.id) : undefined}
              loading={loading}
              disabled={disabled}
            />
          )
        })}
      </CardContent>
      {footer && (
        <CardFooter className="justify-center text-center text-xs text-muted-foreground">
          {footer}
        </CardFooter>
      )}
    </Card>
  )
}

export { SignInCard, type SignInCardProps }
