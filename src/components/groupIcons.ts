import type { IconName } from './Icon';

/** One icon per topic group, shared by the sidebar and the review topic picker. */
const GROUP_ICON: Record<string, IconName> = {
  'languages-frontend': 'code',
  'backend-apis': 'server',
  data: 'database',
  'cloud-devops': 'cloud',
  'architecture-design': 'network',
  'quality-security': 'shield',
  ai: 'sparkles',
  delivery: 'rocket',
  'product-business': 'target',
  'leadership-people': 'users',
};

export const groupIcon = (groupId: string): IconName => GROUP_ICON[groupId] ?? 'folder';
