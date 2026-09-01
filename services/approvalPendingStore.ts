/** In-memory pending approval keys synced from Firestore listener. */
const keys = new Set<string>();
const listeners = new Set<() => void>();

export function approvalPendingKey(type: string, targetId: string): string {
  return `${type}|${targetId}`;
}

export function setPendingApprovalKeysFromList(approvals: any[]): void {
  keys.clear();
  for (const a of approvals || []) {
    if ((a.status || 'PENDING') !== 'PENDING') continue;
    if (!a.type || !a.targetId) continue;
    keys.add(approvalPendingKey(a.type, a.targetId));
  }
  listeners.forEach((cb) => cb());
}

export function isApprovalPending(type: string, targetId: string): boolean {
  return keys.has(approvalPendingKey(type, targetId));
}

export function subscribePendingApprovals(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
