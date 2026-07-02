import { useEffect, useState } from "react";

/**
 * Simple submit-cooldown countdown, shared by the newsletter form and the
 * contact form. Call `start(seconds)` after a successful submit; `remaining`
 * ticks down to 0 once per second. Disable the submit control while
 * `remaining > 0`.
 */
export function useCooldown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);

  return { remaining, start: setRemaining };
}
