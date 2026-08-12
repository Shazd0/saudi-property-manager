import type {
  ImmutableAuditEntry,
  OwnerActionDetail,
  OwnerActionFilters,
  OwnerActionSummary,
  OwnerActionsPage,
  OwnerAutomationJson,
  OwnerAutomationStatus,
  OwnerCommandResult,
  OwnerReversalRequest,
  PreparedRollback,
  ReversalRequestStatus,
  RollbackPreview,
  RollbackSupport,
} from './ownerAutomationTypes';
import { auth } from '../firebase';

const AMLAK_ADMIN_PREFIX = 'amlak-admin.';

function staffAdminId(): string | undefined {
  try {
    const session = JSON.parse(localStorage.getItem('savedUserSession') || '{}');
    const role = String(session.role || '').trim().toUpperCase();
    if (role !== 'ADMIN') return undefined;
    const id = String(session.id || session.uid || '').trim();
    if (!id || id.length > 128 || !/^[A-Za-z0-9._:@-]+$/.test(id)) return undefined;
    return id;
  } catch {
    return undefined;
  }
}

const API_BASE = String((import.meta as any).env?.VITE_OWNER_AUTOMATION_URL || '/owner-api').trim();
const REQUEST_TIMEOUT_MS = 12_000;
const FILTER_KEYS = new Set<keyof OwnerActionFilters>([
  'tenantId', 'projectId', 'buyerId', 'bookId', 'adapter', 'status',
  'actionId', 'dateFrom', 'dateTo', 'limit', 'cursor',
]);
const STATUSES = new Set<OwnerAutomationStatus>([
  'prepared', 'executing', 'completed', 'failed', 'cancelled', 'pending', 'reconciliation_needed',
]);
const REVERSAL_STATUSES = new Set<ReversalRequestStatus>([
  'prepared', 'pending', 'confirmed', 'completed', 'cancelled', 'expired', 'failed', 'rejected',
]);
const ROLLBACK_SUPPORT = new Set<RollbackSupport>(['supported', 'unsupported', 'conditional']);

type UnknownRecord = Record<string, unknown>;

export class OwnerAutomationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'OwnerAutomationError';
  }
}

function record(value: unknown, context: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OwnerAutomationError(`Invalid ${context} response.`, 'INVALID_RESPONSE');
  }
  return value as UnknownRecord;
}

function stringField(source: UnknownRecord, key: string, context: string, optional = false): string | undefined {
  const value = source[key];
  if (optional && (value === undefined || value === null || value === '')) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > 2_000) {
    throw new OwnerAutomationError(`Invalid ${context} response.`, 'INVALID_RESPONSE');
  }
  return value;
}

function booleanField(source: UnknownRecord, key: string, context: string, fallback?: boolean): boolean {
  const value = source[key];
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'boolean') throw new OwnerAutomationError(`Invalid ${context} response.`, 'INVALID_RESPONSE');
  return value;
}

function isoField(source: UnknownRecord, key: string, context: string, optional = false): string | undefined {
  const value = stringField(source, key, context, optional);
  if (value && Number.isNaN(Date.parse(value))) {
    throw new OwnerAutomationError(`Invalid ${context} response.`, 'INVALID_RESPONSE');
  }
  return value;
}

function jsonValue(value: unknown, depth = 0): OwnerAutomationJson {
  if (depth > 20) throw new OwnerAutomationError('Response data is too deeply nested.', 'INVALID_RESPONSE');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => jsonValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const output: Record<string, OwnerAutomationJson> = {};
    for (const [key, item] of Object.entries(value as UnknownRecord)) {
      if (key.length > 256) throw new OwnerAutomationError('Invalid response data.', 'INVALID_RESPONSE');
      output[key] = jsonValue(item, depth + 1);
    }
    return output;
  }
  throw new OwnerAutomationError('Invalid response data.', 'INVALID_RESPONSE');
}

function parseSummary(value: unknown): OwnerActionSummary {
  const item = record(value, 'action');
  const status = stringField(item, 'status', 'action') as OwnerAutomationStatus;
  const rollbackSupport = stringField(item, 'rollbackSupport', 'action') as RollbackSupport;
  if (!STATUSES.has(status) || !ROLLBACK_SUPPORT.has(rollbackSupport)) {
    throw new OwnerAutomationError('Invalid action response.', 'INVALID_RESPONSE');
  }
  const id = stringField(item, 'id', 'action')!;
  return {
    id,
    commandId: stringField(item, 'commandId', 'action', true) || id,
    actionId: stringField(item, 'actionId', 'action')!,
    summary: stringField(item, 'summary', 'action')!,
    tenantId: stringField(item, 'tenantId', 'action')!,
    projectId: stringField(item, 'projectId', 'action', true),
    buyerId: stringField(item, 'buyerId', 'action', true),
    bookId: stringField(item, 'bookId', 'action')!,
    adapter: stringField(item, 'adapter', 'action')!,
    status,
    actorId: stringField(item, 'actorId', 'action', true),
    createdAt: isoField(item, 'createdAt', 'action')!,
    completedAt: isoField(item, 'completedAt', 'action', true),
    reconciliationNeeded: booleanField(item, 'reconciliationNeeded', 'action', false),
    rollbackSupport,
    rollbackReason: stringField(item, 'rollbackReason', 'action', true),
  };
}

function parseAudit(value: unknown): ImmutableAuditEntry {
  const item = record(value, 'audit entry');
  return Object.freeze({
    id: stringField(item, 'id', 'audit entry')!,
    commandId: stringField(item, 'commandId', 'audit entry')!,
    operation: stringField(item, 'operation', 'audit entry')!,
    collectionName: stringField(item, 'collectionName', 'audit entry')!,
    documentId: stringField(item, 'documentId', 'audit entry')!,
    actorId: stringField(item, 'actorId', 'audit entry', true),
    createdAt: isoField(item, 'createdAt', 'audit entry')!,
    before: jsonValue(item.before ?? null),
    after: jsonValue(item.after ?? null),
    adapter: stringField(item, 'adapter', 'audit entry', true),
    reconciliationNeeded: booleanField(item, 'reconciliationNeeded', 'audit entry', false),
  });
}

function parsePreview(value: unknown): RollbackPreview {
  const item = record(value, 'rollback preview');
  if (!Array.isArray(item.sideEffects) || !item.sideEffects.every(effect => typeof effect === 'string' && effect.length <= 2_000)) {
    throw new OwnerAutomationError('Invalid rollback preview response.', 'INVALID_RESPONSE');
  }
  return {
    exactTarget: stringField(item, 'exactTarget', 'rollback preview')!,
    summary: stringField(item, 'summary', 'rollback preview')!,
    sideEffects: item.sideEffects as string[],
    rollback: stringField(item, 'rollback', 'rollback preview')!,
    checkpoint: booleanField(item, 'checkpoint', 'rollback preview'),
  };
}

function responseItems(payload: unknown, context: string): { items: unknown[]; nextCursor?: string } {
  if (Array.isArray(payload)) return { items: payload };
  const body = record(payload, context);
  if (!Array.isArray(body.items)) throw new OwnerAutomationError(`Invalid ${context} response.`, 'INVALID_RESPONSE');
  return {
    items: body.items,
    nextCursor: stringField(body, 'nextCursor', context, true),
  };
}

function resolveBase(): string {
  const base = API_BASE || '/owner-api';
  if (/^https?:\/\//i.test(base)) return base.replace(/\/+$/, '');
  const normalized = `/${base.replace(/^\/+|\/+$/g, '')}`;
  return typeof window === 'undefined' ? normalized : `${window.location.origin}${normalized}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (auth.currentUser) {
    return { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` };
  }
  const staffId = staffAdminId();
  if (staffId) return { Authorization: `Bearer ${AMLAK_ADMIN_PREFIX}${staffId}` };
  throw new OwnerAutomationError('Sign in as an admin to view action history.', 'SIGN_IN_REQUIRED');
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${resolveBase()}${path}`, {
      ...init,
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(await authHeaders()),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      let code = `HTTP_${response.status}`;
      try {
        const errorBody = record(await response.json(), 'error');
        if (typeof errorBody.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(errorBody.code)) code = errorBody.code;
      } catch { /* Do not surface raw server bodies or confirmation tokens. */ }
      throw new OwnerAutomationError(
        response.status === 401 || response.status === 403
          ? 'Admin automation access was denied.'
          : response.status === 404
            ? 'The requested owner automation record was not found.'
            : 'The owner automation request could not be completed.',
        code,
        response.status,
      );
    }
    return await response.json();
  } catch (error) {
    if (error instanceof OwnerAutomationError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new OwnerAutomationError('The owner automation request timed out.', 'TIMEOUT');
    }
    throw new OwnerAutomationError('Unable to reach owner automation.', 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }
}

function query(filters: OwnerActionFilters): string {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(filters)) {
    if (!FILTER_KEYS.has(key as keyof OwnerActionFilters) || rawValue === undefined || rawValue === '') continue;
    if (key === 'limit') {
      if (!Number.isInteger(rawValue) || Number(rawValue) < 1 || Number(rawValue) > 100) {
        throw new OwnerAutomationError('The action result limit must be between 1 and 100.', 'INVALID_FILTER');
      }
    } else if (typeof rawValue !== 'string' || rawValue.length > 200) {
      throw new OwnerAutomationError('An action filter is invalid.', 'INVALID_FILTER');
    }
    params.set(key, String(rawValue));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export async function getOwnerActions(filters: OwnerActionFilters = {}): Promise<OwnerActionsPage> {
  const page = responseItems(await request(`/actions${query(filters)}`), 'actions');
  return { items: page.items.map(parseSummary), nextCursor: page.nextCursor };
}

export async function getOwnerAction(id: string): Promise<OwnerActionDetail> {
  const payload = record(await request(`/actions/${encodeURIComponent(id)}`), 'action detail');
  const item = record(payload.item ?? payload, 'action detail');
  const summary = parseSummary(item);
  if (!Array.isArray(item.sideEffects) || !Array.isArray(item.auditEntries)) {
    throw new OwnerAutomationError('Invalid action detail response.', 'INVALID_RESPONSE');
  }
  return {
    ...summary,
    exactTarget: stringField(item, 'exactTarget', 'action detail')!,
    before: jsonValue(item.before ?? null),
    after: jsonValue(item.after ?? null),
    sideEffects: item.sideEffects.map(effect => {
      if (typeof effect !== 'string' || effect.length > 2_000) throw new OwnerAutomationError('Invalid action detail response.', 'INVALID_RESPONSE');
      return effect;
    }),
    auditEntries: item.auditEntries.map(parseAudit),
  };
}

export async function getOwnerReversalRequests(): Promise<readonly OwnerReversalRequest[]> {
  const page = responseItems(await request('/reversal-requests'), 'reversal requests');
  return page.items.map(value => {
    const item = record(value, 'reversal request');
    const status = stringField(item, 'status', 'reversal request') as ReversalRequestStatus;
    if (!REVERSAL_STATUSES.has(status)) throw new OwnerAutomationError('Invalid reversal request response.', 'INVALID_RESPONSE');
    return {
      id: stringField(item, 'id', 'reversal request')!,
      actionId: stringField(item, 'actionId', 'reversal request')!,
      commandId: stringField(item, 'commandId', 'reversal request', true),
      status,
      reason: stringField(item, 'reason', 'reversal request')!,
      requestedAt: isoField(item, 'requestedAt', 'reversal request')!,
      completedAt: isoField(item, 'completedAt', 'reversal request', true),
      requestedBy: stringField(item, 'requestedBy', 'reversal request', true),
      failureReason: stringField(item, 'failureReason', 'reversal request', true),
    };
  });
}

export async function prepareOwnerActionReversal(actionId: string, reason: string): Promise<PreparedRollback> {
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 3 || normalizedReason.length > 500) {
    throw new OwnerAutomationError('Enter a reversal reason between 3 and 500 characters.', 'INVALID_REASON');
  }
  const payload = record(await request(`/actions/${encodeURIComponent(actionId)}/prepare-reversal`, {
    method: 'POST',
    body: JSON.stringify({ reason: normalizedReason }),
  }), 'prepared rollback');
  const item = record(payload.item ?? payload, 'prepared rollback');
  const status = stringField(item, 'status', 'prepared rollback');
  if (status !== 'prepared') throw new OwnerAutomationError('Invalid prepared rollback response.', 'INVALID_RESPONSE');
  const token = stringField(item, 'confirmationToken', 'prepared rollback')!;
  if (token.length < 32 || token.length > 256) throw new OwnerAutomationError('Invalid prepared rollback response.', 'INVALID_RESPONSE');
  return {
    commandId: stringField(item, 'commandId', 'prepared rollback')!,
    actionId: stringField(item, 'actionId', 'prepared rollback')!,
    status,
    preview: parsePreview(item.preview),
    confirmationToken: token,
    confirmationExpiresAt: isoField(item, 'confirmationExpiresAt', 'prepared rollback')!,
  };
}

function parseCommandResult(value: unknown): OwnerCommandResult {
  const payload = record(value, 'command');
  const item = record(payload.item ?? payload, 'command');
  const status = stringField(item, 'status', 'command') as OwnerAutomationStatus;
  if (!STATUSES.has(status)) throw new OwnerAutomationError('Invalid command response.', 'INVALID_RESPONSE');
  return {
    commandId: stringField(item, 'commandId', 'command')!,
    status,
    reconciliationNeeded: booleanField(item, 'reconciliationNeeded', 'command', false),
  };
}

export async function confirmOwnerCommand(commandId: string, confirmationToken: string): Promise<OwnerCommandResult> {
  return parseCommandResult(await request(`/commands/${encodeURIComponent(commandId)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ confirmationToken }),
  }));
}

export async function cancelOwnerCommand(commandId: string): Promise<OwnerCommandResult> {
  return parseCommandResult(await request(`/commands/${encodeURIComponent(commandId)}/cancel`, { method: 'POST' }));
}
