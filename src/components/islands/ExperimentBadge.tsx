import React, { useEffect, useState } from 'react';

import { useExperimentFlag } from '../../utils/experiments';

/**
 * Homepage experiment badge
 * -------------------------
 *
 * This lightweight island demonstrates how GrowthBook flags influence the hero
 * pitch without forcing the entire layout to hydrate. The copy intentionally
 * references the editorial calendar so marketing can coordinate experiments
 * with upcoming content drops.
 */
export default function ExperimentBadge(): JSX.Element {
  const [isReady, setIsReady] = useState(false);
  const { value, loading, snapshotSource, hash } = useExperimentFlag<string>({
    flag: 'homepage.hero.badge',
    fallback: 'control',
    attributes: {
      channel: 'web',
      page: 'homepage',
    },
    refetchOnMount: true,
  });

  useEffect(() => {
    setIsReady(true);
  }, []);

  const variant = value ?? 'control';
  const message =
    variant === 'accelerated'
      ? 'Growth experiments aligned to this week’s content drop are live.'
      : 'Editorial cadence steady—control narrative in market.';

  return (
    <div
      className="flex flex-col gap-1 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 text-xs uppercase tracking-[0.2rem] text-slate-300 shadow-inner"
      data-testid="experiment-badge"
      data-js-ready={isReady ? 'true' : 'false'}
      data-variant={variant}
      data-loading={loading ? 'true' : 'false'}
      data-source={snapshotSource}
      data-hash={hash}
      role="status"
      aria-live="polite"
    >
      <span className="text-sky-400">Experiment cadence</span>
      <span className="font-semibold text-slate-100">{message}</span>
    </div>
  );
}
