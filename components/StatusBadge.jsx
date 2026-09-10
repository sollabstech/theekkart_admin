import { STATUS_LABELS, STATUS_COLORS } from '@/lib/firestore';
import clsx from 'clsx';

export default function StatusBadge({ status }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'
    )}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
