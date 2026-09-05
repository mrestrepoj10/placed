'use client'

import { LoaderCircleIcon } from 'lucide-react'
import type * as React from 'react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TokenStatus } from '@/components/ui/token-status'
import { UserAccountBadge } from '@/components/ui/user-account-badge'
import type { OAuthConnection } from '@/lib/oauth-types'
import { cn } from '@/lib/utils'

interface ConnectionCardProps extends React.ComponentProps<typeof Card> {
  connection: OAuthConnection
  onDisconnect?: () => void | Promise<void>
  onReconnect?: () => void | Promise<void>
  /** Never pass `undefined` for the handler to express "busy" — that unmounts
   * the control under the user's cursor. */
  disconnectPending?: boolean
  reconnectPending?: boolean
  showScopes?: boolean
}

interface ConnectionActionProps {
  pending: boolean
  onAction: () => void | Promise<void>
  variant?: React.ComponentProps<typeof Button>['variant']
  className?: string
  children: React.ReactNode
}

/** Thenable check, not `instanceof Promise`: a polyfilled or cross-realm
 * promise is still a pending round trip the button must reflect. */
function isPromiseLike(value: void | Promise<void>): value is Promise<void> {
  return value != null && typeof (value as Promise<void>).then === 'function'
}

function ConnectionAction({
  pending,
  onAction,
  variant,
  className,
  children,
}: ConnectionActionProps) {
  const [asyncPending, setAsyncPending] = useState(false)
  const busy = pending || asyncPending

  return (
    <Button
      size="sm"
      variant={variant}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      // The pseudo-element extends the hit area to the 44px floor.
      className={cn(
        'relative gap-0 after:absolute after:-inset-y-2 after:inset-x-0',
        'aria-disabled:pointer-events-none aria-disabled:opacity-50',
        className,
      )}
      onClick={() => {
        if (busy) return
        const result = onAction()
        if (!isPromiseLike(result)) return
        setAsyncPending(true)
        result.then(
          () => setAsyncPending(false),
          () => setAsyncPending(false),
        )
      }}
    >
      <span
        aria-hidden
        className={cn(
          'grid shrink-0 place-items-center overflow-hidden transition-[width,margin] duration-150 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
          busy ? 'mr-1 w-3.5' : 'mr-0 w-0',
        )}
      >
        {/* The spin lives on a wrapper: transform animations on the <svg>
            itself skip the compositor in some engines. */}
        <span className="grid size-3.5 animate-spin place-items-center">
          <LoaderCircleIcon
            className={cn(
              'size-3.5 transition-[opacity,scale,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
              busy ? 'scale-100 opacity-100 blur-none' : 'scale-25 opacity-0 blur-[4px]',
            )}
          />
        </span>
      </span>
      {children}
    </Button>
  )
}

function ConnectionCard({
  connection,
  onDisconnect,
  onReconnect,
  disconnectPending = false,
  reconnectPending = false,
  showScopes = true,
  className,
  ...props
}: ConnectionCardProps) {
  const { provider, account, status } = connection
  const needsReconnect = status === 'expired' || status === 'error' || status === 'disconnected'

  return (
    <Card data-slot="connection-card" className={cn('w-full', className)} {...props}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {provider.icon && (
            <span aria-hidden className="flex shrink-0 [&_svg]:size-5 [&_svg]:shrink-0">
              {provider.icon}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate font-medium">{provider.name}</span>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            {needsReconnect && onReconnect && (
              <ConnectionAction pending={reconnectPending} onAction={onReconnect}>
                {status === 'disconnected' ? 'Connect' : 'Reconnect'}
              </ConnectionAction>
            )}
            {status === 'connected' && onDisconnect && (
              // --status-danger ink instead of the variant's own --destructive:
              // destructive ink on its 10% tint misses AA on a stock theme.
              <ConnectionAction
                pending={disconnectPending}
                onAction={onDisconnect}
                variant="destructive"
                className="text-status-danger"
              >
                Disconnect
              </ConnectionAction>
            )}
          </div>
        </div>
        {account && <UserAccountBadge account={account} size="sm" />}
        <TokenStatus connection={connection} showScopes={showScopes} />
      </CardContent>
    </Card>
  )
}

export { ConnectionCard, type ConnectionCardProps }
