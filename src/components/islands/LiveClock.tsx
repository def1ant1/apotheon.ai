import { useEffect, useState } from 'react';

/**
 * Example React island demonstrating how to incrementally hydrate only what is
 * interactive. Astro will server render the static shell while deferring this
 * component until the client requests it, dramatically reducing JavaScript
 * shipped to end users.
 */
export function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="rounded border border-slate-800 bg-slate-900/60 p-4 shadow-lg">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
        Edge-ready hydration demo
      </h2>
      <p className="mt-2 text-3xl font-bold text-emerald-300" aria-live="polite">
        {now.toLocaleTimeString()}
      </p>
      <p className="mt-3 text-xs text-slate-500">
        This island proves React components remain supported for targeted
        interactivity while the rest of the site stays static.
      </p>
    </div>
  );
}

export default LiveClock;
