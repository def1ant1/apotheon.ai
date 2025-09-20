import {
  IndustryEnergyIcon,
  IndustryFinanceIcon,
  IndustryHealthcareIcon,
  IndustryManufacturingIcon,
  IndustryPublicSectorIcon,
  IndustryTransportIcon,
} from '../icons';

import type { IndustryIconSlug } from '../../content/industries/iconSlugs';
import type { ComponentType, SVGProps } from 'react';

export type IndustryIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const iconMap: Record<IndustryIconSlug, IndustryIconComponent> = {
  finance: IndustryFinanceIcon,
  healthcare: IndustryHealthcareIcon,
  'public-sector': IndustryPublicSectorIcon,
  energy: IndustryEnergyIcon,
  manufacturing: IndustryManufacturingIcon,
  transport: IndustryTransportIcon,
};

export function resolveIndustryIcon(slug: IndustryIconSlug): IndustryIconComponent {
  return iconMap[slug];
}
