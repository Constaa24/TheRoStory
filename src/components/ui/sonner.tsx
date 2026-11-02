"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Toasts in the storybook's voice: a slip of paper with a gold edge and an
 * italic line.
 *
 * Must render inside the ThemeProvider (App mounts it there). It used to sit
 * beside <App /> in main.tsx, outside the provider, where useTheme() has no
 * context and reports nothing — so toasts followed the OS colour scheme
 * instead of the site's theme. resolvedTheme, not theme, for the same reason
 * as the Navbar: theme can be the literal "system".
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={(resolvedTheme === "light" ? "light" : "dark") as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[color:var(--paper)] group-[.toaster]:text-[color:var(--parchment)] group-[.toaster]:border-[color:var(--gold-deep)] group-[.toaster]:rounded-2xl group-[.toaster]:shadow-[var(--shadow-soft)] group-[.toaster]:font-display group-[.toaster]:italic group-[.toaster]:text-[17px]",
          description: "group-[.toast]:text-[color:var(--text-dim)] group-[.toast]:not-italic group-[.toast]:font-serif",
          actionButton:
            "group-[.toast]:bg-[color:var(--gold)] group-[.toast]:text-[color:var(--on-gold)] group-[.toast]:rounded-full group-[.toast]:not-italic group-[.toast]:font-ui",
          cancelButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-[color:var(--text-dim)] group-[.toast]:rounded-full group-[.toast]:not-italic group-[.toast]:font-ui",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
