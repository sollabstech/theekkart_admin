import { statusLabel, statusColor } from '@/lib/orderStatus';
import clsx from 'clsx';

// Pass the whole `order` (preferred — handles legacy values such as an old
// `out_for_delivery` that really meant "ready, waiting for a rider"), or just
// a `status` string.
export default function StatusBadge({ order, status }) {
  const source = order || { status };
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      statusColor(source)
    )}>
      {statusLabel(source)}
    </span>
  );
}
