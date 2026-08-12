function iso(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function requiredText(value, fallback) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function actionTitle(actionId) {
  return String(actionId || 'action')
    .replace(/\.v\d+$/, '')
    .split('.')
    .map((part) => part.replace(/-/g, ' '))
    .join(' · ');
}

function publicStatus(row) {
  if (row.hasRollback && row.status === 'completed') return 'reversed';
  return row.status;
}

function stringifyTarget(target) {
  try {
    return JSON.stringify(target || {});
  } catch {
    return '{}';
  }
}

export function presentOwnerActionSummary(row, buyerIdByProject = {}) {
  const target = row.target || {};
  const supported = Boolean(row.rollbackSupported);
  return {
    id: row.id,
    commandId: row.id,
    actionId: row.actionId,
    summary: requiredText(row.preview?.summary, actionTitle(row.actionId)),
    tenantId: requiredText(target.tenantId, 'unknown-tenant'),
    projectId: target.projectId || undefined,
    buyerId: target.buyerId || buyerIdByProject[target.projectId] || undefined,
    bookId: requiredText(target.bookId, 'unknown-book'),
    adapter: requiredText(target.adapter || row.targetAdapter, 'unknown'),
    status: row.reconciliationNeeded ? 'reconciliation_needed' : row.status,
    actorId: row.actorId || undefined,
    createdAt: iso(row.preparedAt || row.createdAt) || '1970-01-01T00:00:00.000Z',
    completedAt: iso(row.completedAt),
    reconciliationNeeded: Boolean(row.reconciliationNeeded),
    rollbackSupport: supported ? 'supported' : 'unsupported',
    rollbackReason: row.rollbackUnavailableReason || undefined,
  };
}

export function presentOwnerActionDetail(row, buyerIdByProject = {}) {
  const summary = presentOwnerActionSummary(row, buyerIdByProject);
  const operations = Array.isArray(row.operations) ? row.operations : [];
  const first = operations[0] || {};
  const last = operations.at(-1) || first;
  return {
    ...summary,
    exactTarget: stringifyTarget(row.target),
    before: first.before ?? null,
    after: last.after ?? null,
    sideEffects: Array.isArray(row.preview?.sideEffects) ? row.preview.sideEffects.map(String) : [],
    auditEntries: operations.map((operation, index) => ({
      id: String(operation.id || `${row.id}:${index}`),
      commandId: String(operation.commandId || row.id),
      operation: requiredText(operation.operation, 'unknown'),
      collectionName: requiredText(operation.collection || operation.collectionName, 'unknown'),
      documentId: requiredText(operation.documentId, 'unknown'),
      actorId: operation.actorId || row.actorId || undefined,
      createdAt: iso(operation.createdAt) || summary.createdAt,
      before: operation.before ?? null,
      after: operation.after ?? null,
      adapter: operation.adapter || summary.adapter,
      reconciliationNeeded: Boolean(operation.reconciliationNeeded || row.reconciliationNeeded),
    })),
  };
}

export function presentOwnerActionsPage(page, buyerIdByProject = {}) {
  return {
    items: (page.items || []).map((item) => presentOwnerActionSummary(item, buyerIdByProject)),
    nextCursor: page.nextCursor || undefined,
  };
}

export function presentOwnerReversalRequest(row) {
  return {
    id: row.id,
    actionId: requiredText(row.original_command_id || row.originalCommandId || row.actionId, 'unknown'),
    commandId: row.prepared_rollback_command_id || row.preparedRollbackCommandId || undefined,
    status: row.status,
    reason: requiredText(row.reason, 'No reason provided'),
    requestedAt: iso(row.created_at || row.createdAt || row.requestedAt) || '1970-01-01T00:00:00.000Z',
    completedAt: iso(row.completed_at || row.completedAt),
    requestedBy: row.requester_actor_id || row.requesterActorId || row.requestedBy || undefined,
    failureReason: row.failure_reason || row.failureReason || undefined,
  };
}

export function presentOwnerPreparedRollback(prepared) {
  const preview = prepared.preview || {};
  const exactTarget = typeof preview.exactTarget === 'string'
    ? preview.exactTarget
    : stringifyTarget(preview.exactTarget || prepared.target);
  return {
    commandId: prepared.commandId,
    actionId: prepared.actionId,
    status: prepared.status || 'prepared',
    confirmationToken: prepared.confirmationToken,
    confirmationExpiresAt: iso(prepared.confirmationExpiresAt) || new Date(0).toISOString(),
    preview: {
      exactTarget,
      summary: requiredText(preview.summary, 'Rollback prepared command'),
      sideEffects: Array.isArray(preview.sideEffects) ? preview.sideEffects.map(String) : [],
      rollback: requiredText(preview.rollback, 'Not recursively reversible'),
      checkpoint: Boolean(preview.checkpointRequired ?? preview.checkpoint),
    },
    reversalRequestId: prepared.reversalRequestId,
  };
}

export function presentBuyerActionItem(row) {
  const status = publicStatus(row);
  const title = actionTitle(row.actionId);
  const summary = row.preview?.summary || `${title} (${status})`;
  const item = {
    id: row.id,
    actionId: row.actionId,
    status,
    title,
    summary,
    createdAt: iso(row.preparedAt || row.createdAt) || '1970-01-01T00:00:00.000Z',
    rollbackSupported: Boolean(row.rollbackSupported),
  };
  if (row.completedAt) item.completedAt = iso(row.completedAt);
  if (!row.rollbackSupported && row.rollbackUnavailableReason) {
    item.rollbackUnsupportedReason = row.rollbackUnavailableReason;
  }
  if (row.reversalRequest) {
    item.reversalRequest = {
      id: row.reversalRequest.id,
      status: row.reversalRequest.status,
      reason: row.reversalRequest.reason,
      createdAt: iso(row.reversalRequest.created_at || row.reversalRequest.createdAt) || item.createdAt,
      ...(row.reversalRequest.updated_at || row.reversalRequest.updatedAt
        ? { updatedAt: iso(row.reversalRequest.updated_at || row.reversalRequest.updatedAt) }
        : {}),
    };
  }
  return item;
}

export function presentBuyerActionDetail(row) {
  const item = presentBuyerActionItem(row);
  const operations = Array.isArray(row.operations) ? row.operations : [];
  return {
    ...item,
    details: [
      { label: 'Action', value: row.actionId },
      { label: 'Status', value: item.status },
      { label: 'Book', value: String(row.target?.bookId || '') },
      { label: 'Adapter', value: String(row.target?.adapter || row.targetAdapter || '') },
      { label: 'Affected records', value: String(row.affectedRecords || operations.length || 0) },
      ...operations.slice(0, 20).map((operation) => ({
        label: `${operation.operation || 'change'} ${operation.collection || operation.collectionName || ''}`.trim(),
        value: String(operation.documentId || ''),
      })),
    ].filter((detail) => detail.value),
  };
}

export function presentBuyerActionsPage(page) {
  return {
    items: (page.items || []).map(presentBuyerActionItem),
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
  };
}

export function presentBuyerReversalRequest(row) {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    createdAt: iso(row.created_at || row.createdAt) || '1970-01-01T00:00:00.000Z',
    ...(row.updated_at || row.updatedAt ? { updatedAt: iso(row.updated_at || row.updatedAt) } : {}),
  };
}

export function normalizeOwnerListFilters(query = {}) {
  const { dateFrom, dateTo, ...rest } = query;
  return {
    ...rest,
    from: query.from || dateFrom,
    to: query.to || dateTo,
  };
}
