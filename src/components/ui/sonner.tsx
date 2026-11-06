"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Toasts as the redesign draws them: a pill at the foot of the screen with a
 * gold edge, a knot for "done", and one short line in the UI face. A longer
 * message (an error with a description) wraps inside the same rounded slip.
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
      position="bottom-center"
      icons={{ success: <span aria-hidden="true" className="sb-knot sb-knot-sm" style={{ width: 8, height: 8 }} /> }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[color:var(--ink-2)] group-[.toaster]:text-[color:var(--parchment)] group-[.toaster]:border-[color:var(--gold-deep)] group-[.toaster]:rounded-[26px] group-[.toaster]:px-5 group-[.toaster]:py-3 group-[.toaster]:shadow-[var(--shadow-dropdown)] group-[.toaster]:font-ui group-[.toaster]:font-semibold group-[.toaster]:text-[14px]",
          description: "group-[.toast]:text-[color:var(--text-dim)] group-[.toast]:font-ui group-[.toast]:font-medium group-[.toast]:text-[13px]",
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
