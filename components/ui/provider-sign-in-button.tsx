'use client'

import { LoaderCircleIcon } from 'lucide-react'
import type * as React from 'react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { OAuthProvider } from '@/lib/oauth-types'
import { cn } from '@/lib/utils'

interface ProviderSignInBaseProps {
  provider: OAuthProvider
  loading?: boolean
  /** Rendered as `aria-disabled`, never the native attribute, so the control
   * keeps focus and stays discoverable to a screen reader. */
  disabled?: boolean
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

type ProviderSignInLinkProps = ProviderSignInBaseProps &
  Omit<React.ComponentProps<'a'>, 'href'> & {
    href: string
  }

type ProviderSignInButtonProps = ProviderSignInBaseProps &
  Omit<React.ComponentProps<'button'>, 'disabled'> & {
    /** A returned promise drives the pending state until it settles. */
    onSignIn?: () => void | Promise<void>
  }

/** Thenable check, not `instanceof Promise`: a polyfilled or cross-realm
 * promise is still a pending round trip the button must reflect. */
function isPromiseLike(value: void | Promise<void>): value is Promise<void> {
  return value != null && typeof (value as Promise<void>).then === 'function'
}

function ProviderSignInIcon({ provider, loading }: { provider: OAuthProvider; loading: boolean }) {
  return (
    <span aria-hidden className="grid size-4 shrink-0 place-items-center">
      {/* The spin lives on a wrapper: transform animations on the <svg> itself
          skip the compositor in some engines. */}
      <span className="col-start-1 row-start-1 grid size-4 animate-spin place-items-center">
        <LoaderCircleIcon
          className={cn(
            'size-4 transition-opacity duration-150 ease-out',
            loading ? 'opacity-100' : 'opacity-0',
          )}
        />
      </span>
      {provider.icon && (
        <span
          className={cn(
            'col-start-1 row-start-1 flex transition-opacity duration-150 ease-out',
            '[&_svg]:size-4 [&_svg]:shrink-0',
            loading ? 'opacity-0' : 'opacity-100',
          )}
        >
          {provider.icon}
        </span>
      )}
    </span>
  )
}

function providerSignInClasses(
  size: NonNullable<ProviderSignInBaseProps['size']>,
  disabled: boolean,
  pending: boolean,
  className: string | undefined,
): string {
  return cn(
    'w-full justify-center gap-2',
    // 44px minimum touch target; `size="sm"` is the opt-in compact escape hatch.
    size !== 'sm' && 'min-h-11',
    'aria-disabled:pointer-events-none',
    disabled && !pending && 'opacity-50',
    className,
  )
}

function ProviderSignInLink(props: ProviderSignInLinkProps) {
  const {
    provider,
    loading = false,
    disabled = false,
    variant = 'outline',
    size = 'lg',
    className,
    children,
    href,
    ...anchorProps
  } = props
  const inert = loading || disabled

  return (
    <Button
      asChild
      data-slot="provider-sign-in-button"
      aria-busy={loading || undefined}
      variant={variant}
      size={size}
      className={providerSignInClasses(size, disabled, loading, className)}
    >
      {/* The anchor stays an anchor while loading; aria-disabled blocks the
          pointer and the Enter key without dumping focus. */}
      <a
        {...anchorProps}
        href={href}
        aria-disabled={inert || undefined}
        onClick={(event) => {
          if (inert) {
            event.preventDefault()
            return
          }
          anchorProps.onClick?.(event)
        }}
      >
        <ProviderSignInIcon provider={provider} loading={loading} />
        {children ?? `Continue with ${provider.name}`}
      </a>
    </Button>
  )
}

/** For server-rendered flows that navigate to an auth route, use
 * `ProviderSignInLink` instead. */
function ProviderSignInButton(props: ProviderSignInButtonProps) {
  const {
    provider,
    loading = false,
    disabled = false,
    variant = 'outline',
    size = 'lg',
    className,
    children,
    onSignIn,
    ...buttonProps
  } = props
  const [asyncPending, setAsyncPending] = useState(false)
  const pending = loading || asyncPending
  const inert = pending || disabled

  return (
    <Button
      type="button"
      {...buttonProps}
      aria-disabled={inert || undefined}
      data-slot="provider-sign-in-button"
      aria-busy={pending || undefined}
      variant={variant}
      size={size}
      className={providerSignInClasses(size, disabled, pending, className)}
      onClick={(event) => {
        if (inert) return
        buttonProps.onClick?.(event)
        const result = onSignIn?.()
        if (!isPromiseLike(result)) return
        setAsyncPending(true)
        result.then(
          () => setAsyncPending(false),
          () => setAsyncPending(false),
        )
      }}
    >
      <ProviderSignInIcon provider={provider} loading={pending} />
      {children ?? `Continue with ${provider.name}`}
    </Button>
  )
}

export {
  ProviderSignInButton,
  type ProviderSignInButtonProps,
  ProviderSignInLink,
  type ProviderSignInLinkProps,
}
