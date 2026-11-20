import { useEffect, useState } from 'react';
import { elapsedSeconds, usePresentation } from '../store/presentation';
import { formatDuration } from '../utils/format';

/** Re-renders once per second with the presentation's elapsed time. */
export function useElapsed(): { seconds: number; label: string } {
  const base = usePresentation((s) => s.elapsedBase);
  const resumedAt = usePresentation((s) => s.resumedAt);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!resumedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resumedAt]);
  const seconds = elapsedSeconds({ elapsedBase: base, resumedAt }, now);
  return { seconds, label: formatDuration(seconds) };
}
