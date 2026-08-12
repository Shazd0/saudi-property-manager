import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CommandTargetAdapter } from './command-target-adapters.mjs';

const id = z.string().trim().min(1).max(128);
const ServiceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().email(),
  private_key: z.string().min(1),
}).passthrough();
export const BuyerCommandProjectSchema = z.object({
  buyerId: id,
  tenantId: id.optional(),
  bookId: id,
  schemaVersion: z.union([z.string().min(1).max(64), z.number().int().nonnegative()]).default(1),
  capabilities: z.array(z.string().trim().min(1).max(128)).max(500).default([]),
  enabled: z.boolean().default(true),
  serviceAccount: ServiceAccountSchema,
  buildingIds: z.array(id).max(500).optional(),
}).strict().transform((value) => ({ ...value, tenantId: value.tenantId || value.buyerId }));
export const BuyerCommandProjectsSchema = z.record(z.string().min(1), BuyerCommandProjectSchema);

const failure = (message, code) => Object.assign(new Error(message), { code });
const stale = () => failure('Target changed since prepare', 'STALE_VERSION');
const unsupported = () => failure('This action is not safely supported by the Firebase buyer adapter', 'BUYER_ACTION_UNSUPPORTED');
const inputHash = (input) => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const versionOf = (snapshot) => snapshot.updateTime?.toDate?.().toISOString?.()
  || snapshot.data()?.updatedAt
  || snapshot.data()?.updated_at;

function capabilityMatches(capabilities, actionId) {
  return capabilities.includes('*') || capabilities.includes(actionId)
    || capabilities.some((value) => value.endsWith('.*') && actionId.startsWith(value.slice(0, -1)));
}

function createFirebaseTransaction({ firestore, native, command, config }) {
  const audit = [];
  const ref = (collection, documentId) => firestore.collection(collection).doc(documentId);
  const assertScope = (data) => {
    if (data.tenantId && data.tenantId !== config.tenantId) throw failure('Buyer document tenant mismatch', 'TARGET_DENIED');
    if (data.buyerId && data.buyerId !== config.buyerId) throw failure('Buyer document buyer mismatch', 'TARGET_DENIED');
    if (data.bookId && data.bookId !== config.bookId) throw failure('Buyer document book mismatch', 'TARGET_DENIED');
  };
  const scoped = (data) => ({
    ...data,
    tenantId: data.tenantId || config.tenantId,
    buyerId: data.buyerId || config.buyerId,
    bookId: data.bookId || config.bookId,
  });
  async function document(collection, documentId, expected) {
    const snapshot = await native.get(ref(collection, documentId));
    if (!snapshot.exists) throw stale();
    const data = snapshot.data() || {};
    assertScope(data);
    if (expected && versionOf(snapshot) !== expected) throw stale();
    return { snapshot, data };
  }
  const record = (collection, documentId, operation, before, after) => {
    audit.push({ collection, documentId, operation, before, after });
  };

  return {
    audit,
    async createDocument(collection, documentId, data) {
      const documentRef = ref(collection, documentId);
      const existing = await native.get(documentRef);
      if (existing.exists) throw failure('Document already exists', 'DOCUMENT_EXISTS');
      const after = scoped(data);
      native.create(documentRef, after);
      record(collection, documentId, 'create', null, after);
      return { id: documentId, ...after };
    },
    async updateDocument(collection, documentId, expected, patch) {
      const before = await document(collection, documentId, expected);
      const after = scoped({ ...before.data, ...patch });
      native.set(before.snapshot.ref, after);
      record(collection, documentId, 'update', before.data, after);
      return { id: documentId, ...after };
    },
    async setDocumentDeleted(collection, documentId, expected, deleted) {
      const before = await document(collection, documentId, expected);
      const after = scoped({ ...before.data, deleted });
      native.set(before.snapshot.ref, after);
      record(collection, documentId, deleted ? 'soft-delete' : 'restore', before.data, after);
      return { id: documentId, ...after };
    },
    async permanentDeleteDocument(collection, documentId, expected) {
      const before = await document(collection, documentId, expected);
      native.delete(before.snapshot.ref);
      record(collection, documentId, 'permanent-delete', before.data, null);
      return { id: documentId, deleted: true, permanent: true };
    },
    async renewContract(input) {
      const old = await document('contracts', input.contractId, input.expectedUpdatedAt);
      const newId = input.newContractId || `${input.contractId}-renewal-${command.id.slice(0, 8)}`;
      const newRef = ref('contracts', newId);
      if ((await native.get(newRef)).exists) throw failure('Renewal contract already exists', 'DOCUMENT_EXISTS');
      const oldAfter = scoped({ ...old.data, status: 'renewed', renewedByContractId: newId });
      const newData = scoped({ ...old.data, ...input.terms, previousContractId: input.contractId, renewalOf: input.contractId, status: 'active' });
      native.set(old.snapshot.ref, oldAfter); native.create(newRef, newData);
      record('contracts', input.contractId, 'renew-source', old.data, oldAfter);
      record('contracts', newId, 'renew-successor', null, newData);
      return { originalContractId: input.contractId, newContractId: newId };
    },
    async createTransfer(input) {
      const transferId = input.transferId || command.id;
      const debitId = `${transferId}:debit`; const creditId = `${transferId}:credit`;
      const debitRef = ref('transactions', debitId); const creditRef = ref('transactions', creditId);
      const [debitExists, creditExists] = await Promise.all([native.get(debitRef), native.get(creditRef)]);
      if (debitExists.exists || creditExists.exists) throw failure('Transfer already exists', 'DOCUMENT_EXISTS');
      const common = { transferId, currency: input.currency.toUpperCase(), date: input.date, memo: input.memo };
      const debit = scoped({ ...common, accountId: input.fromAccountId, amount: -input.amount, type: 'TRANSFER' });
      const credit = scoped({ ...common, accountId: input.toAccountId, amount: input.amount, type: 'TRANSFER' });
      native.create(debitRef, debit); native.create(creditRef, credit);
      record('transactions', debitId, 'transfer-debit', null, debit);
      record('transactions', creditId, 'transfer-credit', null, credit);
      return { transferId, entries: [{ id: debitId, amount: -input.amount }, { id: creditId, amount: input.amount }], balanced: true };
    },
    async reverseTransfer(input) {
      const debitId = `${input.originalTransferId}:debit`; const creditId = `${input.originalTransferId}:credit`;
      const debit = await document('transactions', debitId); const credit = await document('transactions', creditId);
      if (debit.data.transferId !== input.originalTransferId || credit.data.transferId !== input.originalTransferId
        || debit.data.reversalTransferId || credit.data.reversalTransferId) {
        throw failure('Original transfer pair is not reversible', 'TRANSFER_NOT_REVERSIBLE');
      }
      const debitAmount = Number(debit.data.amount); const creditAmount = Number(credit.data.amount);
      if (!Number.isFinite(debitAmount) || !Number.isFinite(creditAmount) || Math.abs(debitAmount + creditAmount) > 0.000001) {
        throw failure('Original transfer is not balanced', 'TRANSFER_NOT_REVERSIBLE');
      }
      const transferId = input.reversalTransferId || `${input.originalTransferId}:reversal:${command.id.slice(0, 8)}`;
      const reverseDebitId = `${transferId}:debit`; const reverseCreditId = `${transferId}:credit`;
      const reverseDebitRef = ref('transactions', reverseDebitId); const reverseCreditRef = ref('transactions', reverseCreditId);
      const [rd, rc] = await Promise.all([native.get(reverseDebitRef), native.get(reverseCreditRef)]);
      if (rd.exists || rc.exists) throw failure('Reversal already exists', 'TRANSFER_NOT_REVERSIBLE');
      const debitAfter = scoped({ ...debit.data, reversalTransferId: transferId });
      const creditAfter = scoped({ ...credit.data, reversalTransferId: transferId });
      const reverseDebit = scoped({ ...credit.data, transferId, amount: -creditAmount, reversesTransferId: input.originalTransferId, reason: input.reason });
      const reverseCredit = scoped({ ...debit.data, transferId, amount: -debitAmount, reversesTransferId: input.originalTransferId, reason: input.reason });
      native.set(debit.snapshot.ref, debitAfter); native.set(credit.snapshot.ref, creditAfter);
      native.create(reverseDebitRef, reverseDebit); native.create(reverseCreditRef, reverseCredit);
      record('transactions', debitId, 'transfer-reversal-link', debit.data, debitAfter);
      record('transactions', creditId, 'transfer-reversal-link', credit.data, creditAfter);
      record('transactions', reverseDebitId, 'transfer-reversal-debit', null, reverseDebit);
      record('transactions', reverseCreditId, 'transfer-reversal-credit', null, reverseCredit);
      return { transferId, reversesTransferId: input.originalTransferId, entries: [{ id: reverseDebitId, amount: reverseDebit.amount }, { id: reverseCreditId, amount: reverseCredit.amount }], balanced: true };
    },
    async applyAmountOperation(collection, documentId, expected, operation) {
      const before = await document(collection, documentId, expected);
      const previousAmount = Number(before.data[operation.field] || 0);
      const delta = operation.operation === 'increase' ? operation.amount : -operation.amount;
      const amount = previousAmount + delta;
      if (!Number.isFinite(previousAmount) || amount < 0) throw failure('Amount operation would create a negative balance', 'NEGATIVE_BALANCE');
      const event = { id: `${operation.event}:${command.id}`, type: operation.event, amount: operation.amount, delta, ...(operation.metadata || {}) };
      const after = scoped({ ...before.data, [operation.field]: amount, amountEvents: [...(before.data.amountEvents || []), event] });
      native.set(before.snapshot.ref, after); record(collection, documentId, operation.event, before.data, after);
      return { id: documentId, field: operation.field, previousAmount, amount, event };
    },
    async adjustInventory(input) {
      const before = await document('stockItems', input.itemId, input.expectedUpdatedAt);
      const quantity = Number(before.data.quantity || 0) + input.quantityDelta;
      if (!Number.isFinite(quantity) || quantity < 0) throw failure('Inventory cannot become negative', 'NEGATIVE_STOCK');
      const adjustmentId = input.adjustmentId || command.id;
      const after = scoped({ ...before.data, quantity, inventoryAdjustments: [...(before.data.inventoryAdjustments || []), { id: adjustmentId, delta: input.quantityDelta, reason: input.reason }] });
      native.set(before.snapshot.ref, after); record('stockItems', input.itemId, 'inventory-adjust', before.data, after);
      return { itemId: input.itemId, adjustmentId, quantity };
    },
    async reverseInventoryAdjustment(input) {
      const before = await document('stockItems', input.itemId, input.expectedUpdatedAt);
      const original = (before.data.inventoryAdjustments || []).find((item) => item.id === input.originalAdjustmentId && !item.reversedBy);
      if (!original) throw failure('Adjustment is missing or already reversed', 'ADJUSTMENT_NOT_REVERSIBLE');
      const quantity = Number(before.data.quantity || 0) - Number(original.delta);
      if (!Number.isFinite(quantity) || quantity < 0) throw failure('Reversal cannot make stock negative', 'NEGATIVE_STOCK');
      const reversalId = input.reversalId || command.id;
      const adjustments = before.data.inventoryAdjustments.map((item) => item.id === original.id ? { ...item, reversedBy: reversalId } : item);
      adjustments.push({ id: reversalId, delta: -Number(original.delta), reverses: original.id });
      const after = scoped({ ...before.data, quantity, inventoryAdjustments: adjustments });
      native.set(before.snapshot.ref, after); record('stockItems', input.itemId, 'inventory-reversal', before.data, after);
      return { itemId: input.itemId, reversalId, quantity };
    },
    async createCreditNote(input) {
      const original = await document('transactions', input.originalTransactionId, input.expectedUpdatedAt);
      if (original.data.creditNoteId) throw failure('Credit note already exists', 'CREDIT_NOTE_EXISTS');
      const creditNoteId = input.creditNoteId || `${input.originalTransactionId}:credit:${command.id.slice(0, 8)}`;
      const noteRef = ref('transactions', creditNoteId);
      if ((await native.get(noteRef)).exists) throw failure('Credit note already exists', 'CREDIT_NOTE_EXISTS');
      const amount = -Number(original.data.amount || original.data.total || 0);
      if (!Number.isFinite(amount) || amount === 0) throw failure('Original transaction has no reversible amount', 'CREDIT_NOTE_EXISTS');
      const originalAfter = scoped({ ...original.data, creditNoteId });
      const note = scoped({ ...original.data, amount, total: amount, type: 'CREDIT_NOTE', originalTransactionId: input.originalTransactionId, reason: input.reason });
      native.set(original.snapshot.ref, originalAfter); native.create(noteRef, note);
      record('transactions', input.originalTransactionId, 'credit-note-link', original.data, originalAfter);
      record('transactions', creditNoteId, 'credit-note-create', null, note);
      return { originalTransactionId: input.originalTransactionId, creditNoteId, amount };
    },
    async resolveApproval(input) {
      const approval = await document('approvals', input.approvalId, input.expectedUpdatedAt);
      if (approval.data.status !== 'pending') throw failure('Approval is already resolved', 'APPROVAL_RESOLVED');
      const allowed = new Set(['transactions', 'contracts', 'tasks', 'vendors']);
      if (!allowed.has(approval.data.targetCollection)) throw failure('Approval target is not allowlisted', 'TARGET_DENIED');
      const target = await document(approval.data.targetCollection, approval.data.targetId, input.targetExpectedUpdatedAt);
      const approvalAfter = scoped({ ...approval.data, status: input.resolution, note: input.note });
      const targetAfter = scoped({ ...target.data, approvalStatus: input.resolution });
      native.set(approval.snapshot.ref, approvalAfter); native.set(target.snapshot.ref, targetAfter);
      record('approvals', input.approvalId, 'approval-resolve', approval.data, approvalAfter);
      record(approval.data.targetCollection, approval.data.targetId, 'approval-target-update', target.data, targetAfter);
      return { approvalId: input.approvalId, targetId: approval.data.targetId, resolution: input.resolution };
    },
    async rollbackCommand(input) {
      const originalAuditRef = firestore.collection('__mcpCommandAudits').doc(input.originalCommandId);
      const originalAuditSnapshot = await native.get(originalAuditRef);
      if (!originalAuditSnapshot.exists) throw failure('Original immutable Firebase audit is unavailable', 'ROLLBACK_UNAVAILABLE');
      const original = originalAuditSnapshot.data() || {};
      if (original.status !== 'completed' || original.actionId === 'command.rollback.v1'
        || original.projectId !== input.target.projectId || original.tenantId !== config.tenantId
        || original.bookId !== config.bookId || !Array.isArray(original.operations) || !original.operations.length) {
        throw failure('Original Firebase command is not rollbackable in this target', 'ROLLBACK_UNAVAILABLE');
      }
      const states = [];
      for (const operation of [...original.operations].reverse()) {
        if (!operation?.collection || !operation?.documentId
          || !Object.hasOwn(operation, 'before') || !Object.hasOwn(operation, 'after')) {
          throw failure('Original Firebase operation audit is incomplete', 'ROLLBACK_UNAVAILABLE');
        }
        const documentRef = ref(operation.collection, operation.documentId);
        const snapshot = await native.get(documentRef);
        const current = snapshot.exists ? snapshot.data() : null;
        if (JSON.stringify(current) !== JSON.stringify(operation.after)) {
          throw failure('Current Firebase state no longer matches the immutable after-state', 'ROLLBACK_STALE');
        }
        if (current) assertScope(current);
        if (operation.before) assertScope(operation.before);
        states.push({ operation, snapshot, documentRef, current });
      }
      for (const { operation, snapshot, documentRef, current } of states) {
        if (operation.before === null) native.delete(documentRef);
        else if (snapshot.exists) native.set(documentRef, operation.before);
        else native.create(documentRef, operation.before);
        record(operation.collection, operation.documentId, `rollback:${operation.operation}`, current, operation.before);
      }
      return {
        originalCommandId: input.originalCommandId,
        reversedOperations: states.map(({ operation }) => ({
          collection: operation.collection,
          documentId: operation.documentId,
        })),
      };
    },
    async createCheckpoint(commandId, type, data) {
      return { id: `${commandId}:${type}`, commandId, type, data, localToBuyerCommand: true };
    },
    async enqueueJob() { throw unsupported(); },
    async createBuyerDeploymentManifest() { throw unsupported(); },
    async enqueueOutbox() { throw unsupported(); },
    async createSchedule() { throw unsupported(); },
    async cancelSchedule() { throw unsupported(); },
  };
}

export class FirebaseBuyerCommandAdapter extends CommandTargetAdapter {
  constructor(projects, { firestoreForProject } = {}) {
    super({ name: 'buyer', remote: true });
    this.projects = BuyerCommandProjectsSchema.parse(projects || {});
    for (const [projectId, config] of Object.entries(this.projects)) {
      if (config.serviceAccount.project_id !== projectId) {
        throw failure(`Firebase service account project mismatch for ${projectId}`, 'TARGET_DENIED');
      }
    }
    this.firestoreForProject = firestoreForProject || ((projectId, config) => {
      const name = `mcp-buyer-${projectId}`;
      const app = getApps().find((candidate) => candidate.name === name)
        || initializeApp({ credential: cert(config.serviceAccount), projectId }, name);
      return getFirestore(app);
    });
  }

  validate({ target, actionId }) {
    if (target.adapter !== 'buyer' || !target.projectId) throw failure('Buyer project target is required', 'TARGET_DENIED');
    const config = this.projects[target.projectId];
    if (!config || !config.enabled) throw failure('Buyer project is unavailable', 'TARGET_DISABLED');
    if (target.tenantId !== config.tenantId || target.bookId !== config.bookId) {
      throw failure('Buyer target does not match server configuration', 'TARGET_DENIED');
    }
    if (String(config.schemaVersion) !== '1') {
      throw failure('Buyer project schema version is not supported', 'SCHEMA_VERSION_DENIED');
    }
    if (!capabilityMatches(config.capabilities, actionId)) {
      throw failure('Buyer project does not allow this action', 'CAPABILITY_DENIED');
    }
    return { adapter: this, target: { ...target }, config, central: Boolean(getCentralInfrastructure(actionId)) };
  }

  async execute({ transaction, resolved, action, input, command }) {
    if (resolved.central) {
      if (!transaction || !action.centralInfrastructure) throw unsupported();
      return action.execute(transaction, input, command);
    }
    const { config, target } = resolved;
    const firestore = this.firestoreForProject(target.projectId, config);
    const auditRef = firestore.collection('__mcpCommandAudits').doc(command.id);
    const expectedInputHash = inputHash(input);
    return firestore.runTransaction(async (native) => {
      const existing = await native.get(auditRef);
      if (existing.exists) {
        const data = existing.data() || {};
        if (data.actionId !== action.id || data.tenantId !== config.tenantId || data.bookId !== config.bookId
          || data.inputHash !== expectedInputHash || data.actorId !== command.actorId) {
          throw failure('Buyer command idempotency scope mismatch', 'IDEMPOTENCY_CONFLICT');
        }
        if (data.status === 'completed') return { result: data.result, idempotentReplay: true, remoteAuditId: command.id };
        throw failure('Buyer command has an incomplete prior attempt', 'REMOTE_COMMAND_INCOMPLETE');
      }
      const transaction = createFirebaseTransaction({ firestore, native, command, config });
      const result = await action.execute(transaction, input, command);
      const remote = {
        commandId: command.id,
        actionId: action.id,
        actorId: command.actorId,
        inputHash: expectedInputHash,
        tenantId: config.tenantId,
        buyerId: config.buyerId,
        bookId: config.bookId,
        projectId: target.projectId,
        schemaVersion: String(config.schemaVersion),
        status: 'completed',
        result,
        operations: transaction.audit,
        immutable: true,
      };
      native.create(auditRef, remote);
      return { result, idempotentReplay: false, remoteAuditId: command.id };
    });
  }
}

function getCentralInfrastructure(actionId) {
  return new Set([
    'buyer.deployment.publish.v1', 'schedule.create.v1', 'schedule.cancel.v1',
    'event-trigger.create.v1', 'event-trigger.cancel.v1',
    'automation.emergency-disable.v1', 'automation.emergency-enable.v1',
    'automation.worker-pause.v1', 'automation.worker-resume.v1',
  ]).has(actionId)
    || /^(report\.export|data\.(import|export)|backup\.(create|restore)|book\.reset|migration\.execute|bank\.merge|book\.cross-transfer|buyer-support\.operation)\.v1$/.test(actionId)
    || /^(external\.send|notification\.send|reminder\.send|invoice\.submit-zatca|payment\.send-sadad|absher\.submit|ejar\.submit|sadad\.submit)\.v1$/.test(actionId);
}

export function parseBuyerCommandProjects(json) {
  if (!json) return {};
  try {
    return BuyerCommandProjectsSchema.parse(JSON.parse(json));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('BUYER_FIREBASE_PROJECTS_JSON is invalid JSON');
    throw error;
  }
}
