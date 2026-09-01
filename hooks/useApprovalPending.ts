import { useEffect, useState } from 'react';
import { isApprovalPending, subscribePendingApprovals } from '../services/approvalPendingStore';

export function useApprovalPending(type: string, targetId?: string): boolean {
  const [pending, setPending] = useState(() => (targetId ? isApprovalPending(type, targetId) : false));

  useEffect(() => {
    if (!targetId) {
      setPending(false);
      return;
    }
    const sync = () => setPending(isApprovalPending(type, targetId));
    sync();
    return subscribePendingApprovals(sync);
  }, [type, targetId]);

  return pending;
}
