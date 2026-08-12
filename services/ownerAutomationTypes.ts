export type OwnerAutomationJson =
  | string
  | number
  | boolean
  | null
  | readonly OwnerAutomationJson[]
  | { readonly [key: string]: OwnerAutomationJson };

export type OwnerAutomationStatus =
  | 'prepared'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'pending'
  | 'reconciliation_needed';

export type RollbackSupport = 'supported' | 'unsupported' | 'conditional';

export interface OwnerActionSummary {
  readonly id: string;
  readonly commandId: string;
  readonly actionId: string;
  readonly summary: string;
  readonly tenantId: string;
  readonly projectId?: string;
  readonly buyerId?: string;
  readonly bookId: string;
  readonly adapter: string;
  readonly status: OwnerAutomationStatus;
  readonly actorId?: string;
  readonly createdAt: string;
  readonly completedAt?: string;
  readonly reconciliationNeeded: boolean;
  readonly rollbackSupport: RollbackSupport;
  readonly rollbackReason?: string;
}

export interface ImmutableAuditEntry {
  readonly id: string;
  readonly commandId: string;
  readonly operation: string;
  readonly collectionName: string;
  readonly documentId: string;
  readonly actorId?: string;
  readonly createdAt: string;
  readonly before: OwnerAutomationJson;
  readonly after: OwnerAutomationJson;
  readonly adapter?: string;
  readonly reconciliationNeeded: boolean;
}

export interface OwnerActionDetail extends OwnerActionSummary {
  readonly exactTarget: string;
  readonly before: OwnerAutomationJson;
  readonly after: OwnerAutomationJson;
  readonly sideEffects: readonly string[];
  readonly auditEntries: readonly ImmutableAuditEntry[];
}

export type ReversalRequestStatus =
  | 'prepared'
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'failed'
  | 'rejected';

export interface OwnerReversalRequest {
  readonly id: string;
  readonly actionId: string;
  readonly commandId?: string;
  readonly status: ReversalRequestStatus;
  readonly reason: string;
  readonly requestedAt: string;
  readonly completedAt?: string;
  readonly requestedBy?: string;
  readonly failureReason?: string;
}

export interface RollbackPreview {
  readonly exactTarget: string;
  readonly summary: string;
  readonly sideEffects: readonly string[];
  readonly rollback: string;
  readonly checkpoint: boolean;
}

export interface PreparedRollback {
  readonly commandId: string;
  readonly actionId: string;
  readonly status: 'prepared';
  readonly preview: RollbackPreview;
  readonly confirmationToken: string;
  readonly confirmationExpiresAt: string;
}

export interface OwnerCommandResult {
  readonly commandId: string;
  readonly status: OwnerAutomationStatus;
  readonly reconciliationNeeded: boolean;
}

export interface OwnerActionFilters {
  readonly tenantId?: string;
  readonly projectId?: string;
  readonly buyerId?: string;
  readonly bookId?: string;
  readonly adapter?: string;
  readonly status?: OwnerAutomationStatus;
  readonly actionId?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface OwnerActionsPage {
  readonly items: readonly OwnerActionSummary[];
  readonly nextCursor?: string;
}
