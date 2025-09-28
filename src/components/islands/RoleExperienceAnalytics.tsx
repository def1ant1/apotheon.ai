import { useEffect } from 'react';

import { trackAnalyticsEvent } from '../../utils/analytics';

import type { AudienceRole } from '../../utils/audience-resolver';

interface RoleExperienceAnalyticsProps {
  readonly role: AudienceRole;
  readonly surface: string;
}

/**
 * Lightweight client island that emits a single analytics event when role-targeted experiences
 * render. Keeping telemetry centralized here prevents every surface from reimplementing the
 * tracking boilerplate while preserving tree-shakeable ergonomics.
 */
export default function RoleExperienceAnalytics({ role, surface }: RoleExperienceAnalyticsProps) {
  useEffect(() => {
    void trackAnalyticsEvent({
      event: 'role_experience_impression',
      payload: { role, surface },
      consentService: 'pipeline-alerts',
    });
  }, [role, surface]);

  return null;
}
