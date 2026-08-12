import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CronExpressionParser } from 'cron-parser';

const id = z.string().trim().min(1).max(128).regex(/^[\w.:@/-]+$/);
const uuid = z.string().uuid();
const iso = z.string().datetime({ offset: true });
const money = z.number().finite().positive();
const jsonObject = z.record(z.string(), z.unknown());
export const targetSchema = z.object({
  adapter: z.enum(['mac', 'buyer']),
  tenantId: id,
  bookId: id,
  projectId: id.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.adapter === 'buyer' && !value.projectId) {
    ctx.addIssue({ code: 'custom', path: ['projectId'], message: 'projectId is required for buyer targets' });
  }
});

const base = {
  target: targetSchema,
  idempotencyKey: id,
};
const createInput = z.object({ ...base, documentId: id.optional(), data: jsonObject }).strict();
const updateInput = z.object({
  ...base, documentId: id, expectedUpdatedAt: iso, patch: jsonObject,
}).strict();
const deleteInput = z.object({
  ...base, documentId: id, expectedUpdatedAt: iso,
}).strict();
const statusSchema = z.enum(['draft', 'pending', 'approved', 'paid', 'void', 'cancelled', 'completed']);
const currency = z.string().trim().regex(/^[A-Z]{3}$/);

const documentHandlers = {
  create: (collection) => async (tx, input) =>
    tx.createDocument(collection, input.documentId || randomUUID(), input.data),
  update: (collection) => async (tx, input) =>
    tx.updateDocument(collection, input.documentId, input.expectedUpdatedAt, input.patch),
  softDelete: (collection) => async (tx, input) =>
    tx.setDocumentDeleted(collection, input.documentId, input.expectedUpdatedAt, true),
  restore: (collection) => async (tx, input) =>
    tx.setDocumentDeleted(collection, input.documentId, input.expectedUpdatedAt, false),
  permanentDelete: (collection) => async (tx, input) =>
    tx.permanentDeleteDocument(collection, input.documentId, input.expectedUpdatedAt),
};

function preview(label, { sideEffects = [], rollback = 'Compensating command required', checkpoint = false } = {}) {
  return (input) => ({
    summary: `${label} in book ${input.target.bookId}`,
    exactTarget: input.target,
    sideEffects,
    rollback,
    checkpointRequired: checkpoint,
  });
}

const definitions = [];
function define(action) {
  definitions.push(Object.freeze(action));
}
function fixedCreate({ actionId, domain, collection, schema, label, critical = false }) {
  define({
    id: actionId, domain, mutation: true, critical, schema,
    preview: preview(label),
    execute: (tx, input) => tx.createDocument(collection, input.documentId || randomUUID(), input.data),
  });
}
function fixedUpdate({ actionId, domain, collection, schema, label, critical = false, patch }) {
  define({
    id: actionId, domain, mutation: true, critical, schema,
    preview: preview(label),
    execute: (tx, input) => tx.updateDocument(collection, input.documentId, input.expectedUpdatedAt, patch(input)),
  });
}
function queued({ actionId, domain, label, schema, critical = false, payload = (input) => input }) {
  define({
    id: actionId, domain, mutation: true, critical, schema, centralInfrastructure: true,
    preview: preview(label, { sideEffects: ['Creates a checkpointed durable job'], rollback: 'Job-specific recovery only; execution is not claimed reversible', checkpoint: true }),
    execute: async (tx, input, command) => {
      const jobPayload = payload(input);
      const checkpoint = await tx.createCheckpoint(command.id, actionId, jobPayload);
      return tx.enqueueJob(command.id, actionId, input.target, jobPayload, checkpoint.id);
    },
  });
}
function documents(domain, noun, collection, { critical = false } = {}) {
  const prefix = `${noun}`;
  define({ id: `${prefix}.create.v1`, domain, mutation: true, critical, schema: createInput, preview: preview(`Create ${noun}`), execute: documentHandlers.create(collection) });
  define({ id: `${prefix}.update.v1`, domain, mutation: true, critical, schema: updateInput, preview: preview(`Update ${noun}`), execute: documentHandlers.update(collection) });
  define({ id: `${prefix}.delete.v1`, domain, mutation: true, critical, schema: deleteInput, preview: preview(`Soft-delete ${noun}`), execute: documentHandlers.softDelete(collection) });
  define({ id: `${prefix}.restore.v1`, domain, mutation: true, critical, schema: deleteInput, preview: preview(`Restore ${noun}`), execute: documentHandlers.restore(collection) });
  define({ id: `${prefix}.permanent-delete.v1`, domain, mutation: true, critical: true, schema: deleteInput, preview: preview(`Permanently delete ${noun}`, { rollback: 'Not reversible', checkpoint: true }), execute: async (tx, input, command) => {
    await tx.createCheckpoint(command.id, `${prefix}.permanent-delete`, { collection, documentId: input.documentId });
    return documentHandlers.permanentDelete(collection)(tx, input);
  } });
}

documents('finance', 'transaction', 'transactions');
documents('property', 'property', 'buildings');
documents('property', 'unit', 'units');
documents('property', 'contract', 'contracts');
documents('operations', 'task', 'tasks');
documents('operations', 'inventory-item', 'stockItems');
documents('administration', 'customer', 'customers');
documents('administration', 'employee', 'employees');
documents('administration', 'vendor', 'vendors');
documents('administration', 'approval', 'approvals');
documents('finance', 'bank-account', 'bankAccounts');
documents('finance', 'borrowing', 'borrowings');
documents('property', 'owner', 'owners');
documents('property', 'service-agreement', 'serviceAgreements');
documents('operations', 'utility', 'utilities');
documents('operations', 'security-deposit', 'securityDeposits');
documents('operations', 'municipality-license', 'municipalityLicenses');
documents('operations', 'civil-defense', 'civilDefenseRecords');
documents('operations', 'vehicle', 'vehicles');
documents('operations', 'maintenance', 'maintenanceRecords');
documents('operations', 'compliance', 'complianceRecords');
documents('administration', 'staff-assignment', 'staffAssignments', { critical: true });
documents('administration', 'setting', 'settings');
documents('administration', 'book', 'books');
documents('administration', 'category', 'categories');

define({
  id: 'contract.renew.v1', domain: 'property', mutation: true,
  schema: z.object({ ...base, contractId: id, expectedUpdatedAt: iso, newContractId: id.optional(), terms: jsonObject }).strict(),
  preview: preview('Renew contract', { sideEffects: ['Closes original contract', 'Creates linked successor contract'], rollback: 'Cancel successor and restore original through compensating commands' }),
  execute: async (tx, input) => tx.renewContract(input),
});
define({
  id: 'transaction.transfer.v1', domain: 'finance', mutation: true,
  schema: z.object({ ...base, transferId: id.optional(), fromAccountId: id, toAccountId: id, amount: money, currency, date: z.string().date(), memo: z.string().max(500).optional() }).strict()
    .refine((v) => v.fromAccountId !== v.toAccountId, 'Transfer accounts must differ'),
  preview: preview('Create balanced transfer', { sideEffects: ['Creates linked debit and credit transactions'], rollback: 'Create a linked reversing transfer' }),
  execute: async (tx, input) => tx.createTransfer(input),
});
define({
  id: 'transaction.transfer-reverse.v1', domain: 'finance', mutation: true,
  schema: z.object({ ...base, originalTransferId: id, reversalTransferId: id.optional(), reason: z.string().trim().min(1).max(500) }).strict(),
  preview: preview('Reverse balanced transfer', { sideEffects: ['Creates linked inverse entries and marks the original pair reversed'], rollback: 'Create another explicit balanced transfer' }),
  execute: (tx, input) => tx.reverseTransfer(input),
});
fixedCreate({
  actionId: 'rent.record.v1', domain: 'finance', collection: 'transactions', label: 'Record rent charge or receipt',
  schema: z.object({ ...base, documentId: id.optional(), data: z.object({
    contractId: id, customerId: id, amount: money, currency, date: z.string().date(),
    kind: z.enum(['charge', 'receipt']), reference: z.string().max(128).optional(),
  }).strict() }).strict(),
});
fixedCreate({
  actionId: 'payment.record.v1', domain: 'finance', collection: 'transactions', label: 'Record payment',
  schema: z.object({ ...base, documentId: id.optional(), data: z.object({
    invoiceId: id.optional(), customerId: id, amount: money, currency, date: z.string().date(),
    method: z.enum(['cash', 'bank', 'card', 'sadad', 'other']), reference: z.string().max(128).optional(),
  }).strict() }).strict(),
});
fixedCreate({
  actionId: 'expense.create.v1', domain: 'finance', collection: 'transactions', label: 'Create expense',
  schema: z.object({ ...base, documentId: id.optional(), data: z.object({
    vendorId: id.optional(), categoryId: id, amount: money, currency, date: z.string().date(),
    description: z.string().trim().min(1).max(1000),
  }).strict() }).strict(),
});
for (const actionId of ['rent.status.update.v1', 'payment.status.update.v1', 'expense.status.update.v1', 'transaction.status.update.v1']) {
  fixedUpdate({
    actionId, domain: 'finance', collection: 'transactions', label: `Update ${actionId.split('.')[0]} status`,
    schema: z.object({ ...base, documentId: id, expectedUpdatedAt: iso, status: statusSchema }).strict(),
    patch: (input) => ({ status: input.status }),
  });
}
fixedCreate({
  actionId: 'accounting-journal.post.v1', domain: 'finance', collection: 'accountingJournals', label: 'Post balanced accounting journal',
  schema: z.object({
    ...base, documentId: id.optional(),
    data: z.object({
      date: z.string().date(), description: z.string().trim().min(1).max(1000), currency,
      lines: z.array(z.object({ accountId: id, debit: z.number().nonnegative(), credit: z.number().nonnegative() }).strict()
        .refine((line) => (line.debit === 0) !== (line.credit === 0), 'Each line must contain exactly one side')).min(2).max(100),
    }).strict().refine((journal) => Math.abs(journal.lines.reduce((sum, line) => sum + line.debit - line.credit, 0)) < 0.000001, 'Journal must balance'),
  }).strict(),
});
fixedUpdate({
  actionId: 'bank-reconciliation.resolve.v1', domain: 'finance', collection: 'bankReconciliations', label: 'Resolve bank reconciliation item',
  schema: z.object({ ...base, documentId: id, expectedUpdatedAt: iso, resolution: z.enum(['matched', 'ignored', 'adjusted']), transactionId: id.optional(), note: z.string().max(500).optional() }).strict(),
  patch: (input) => ({ status: input.resolution, transactionId: input.transactionId, note: input.note }),
});
define({
  id: 'borrowing.repay.v1', domain: 'finance', mutation: true,
  schema: z.object({ ...base, borrowingId: id, expectedUpdatedAt: iso, amount: money, currency, date: z.string().date(), reference: z.string().max(128).optional() }).strict(),
  preview: preview('Record borrowing repayment', { sideEffects: ['Decreases outstanding balance without allowing a negative balance'] }),
  execute: (tx, input) => tx.applyAmountOperation('borrowings', input.borrowingId, input.expectedUpdatedAt, {
    amount: input.amount, field: 'outstandingAmount', operation: 'decrease', event: 'repayment', metadata: { date: input.date, currency: input.currency, reference: input.reference },
  }),
});
define({
  id: 'inventory.adjust.v1', domain: 'operations', mutation: true,
  schema: z.object({ ...base, itemId: id, expectedUpdatedAt: iso, adjustmentId: id.optional(), quantityDelta: z.number().int().refine((v) => v !== 0), reason: z.string().trim().min(1).max(500) }).strict(),
  preview: preview('Adjust inventory', { rollback: 'Use inventory.adjust-reversal.v1' }),
  execute: async (tx, input) => tx.adjustInventory(input),
});
define({
  id: 'inventory.adjust-reversal.v1', domain: 'operations', mutation: true,
  schema: z.object({ ...base, itemId: id, expectedUpdatedAt: iso, originalAdjustmentId: id, reversalId: id.optional() }).strict(),
  preview: preview('Reverse inventory adjustment', { rollback: 'Submit another explicit adjustment' }),
  execute: async (tx, input) => tx.reverseInventoryAdjustment(input),
});
for (const [actionId, sign, reason] of [
  ['stock.restock.v1', 1, 'restock'],
  ['stock.consume.v1', -1, 'consume'],
  ['stock.sell.v1', -1, 'sale'],
  ['stock.free-issue.v1', -1, 'free-issue'],
]) {
  define({
    id: actionId, domain: 'operations', mutation: true,
    schema: z.object({
      ...base, itemId: id, expectedUpdatedAt: iso, operationId: id.optional(),
      quantity: z.number().int().positive(), reference: z.string().trim().min(1).max(256),
    }).strict(),
    preview: preview(`${reason} inventory`, { rollback: 'Use inventory.adjust-reversal.v1 with the returned adjustment ID' }),
    execute: (tx, input) => tx.adjustInventory({
      ...input,
      adjustmentId: input.operationId,
      quantityDelta: sign * input.quantity,
      reason: `${reason}:${input.reference}`,
    }),
  });
}
for (const [actionId, operation, event] of [
  ['security-deposit.refund.v1', 'decrease', 'refund'],
  ['security-deposit.deduct.v1', 'decrease', 'deduction'],
]) {
  define({
    id: actionId, domain: 'operations', mutation: true,
    schema: z.object({ ...base, depositId: id, expectedUpdatedAt: iso, amount: money, reason: z.string().trim().min(1).max(500) }).strict(),
    preview: preview(`${event} security deposit`, { sideEffects: ['Decreases the available deposit without allowing a negative balance'] }),
    execute: (tx, input) => tx.applyAmountOperation('securityDeposits', input.depositId, input.expectedUpdatedAt, {
      amount: input.amount, field: 'availableAmount', operation, event, metadata: { reason: input.reason },
    }),
  });
}
for (const [actionId, status, critical] of [
  ['contract.finalize.v1', 'finalized', false],
  ['contract.terminate.v1', 'terminated', true],
]) {
  queued({
    actionId, domain: 'property', label: `${status} contract`, critical,
    schema: z.object({ ...base, contractId: id, expectedUpdatedAt: iso, effectiveDate: z.string().date(), reason: z.string().trim().min(1).max(1000) }).strict(),
    payload: (input) => ({ contractId: input.contractId, expectedUpdatedAt: input.expectedUpdatedAt, effectiveDate: input.effectiveDate, reason: input.reason, status }),
  });
}
queued({
  actionId: 'unit.rename-cascade.v1', domain: 'property', label: 'Rename unit and cascade references',
  schema: z.object({ ...base, unitId: id, expectedUpdatedAt: iso, newName: z.string().trim().min(1).max(200) }).strict(),
  payload: (input) => ({ unitId: input.unitId, expectedUpdatedAt: input.expectedUpdatedAt, newName: input.newName }),
});
define({
  id: 'credit-note.create.v1', domain: 'finance', mutation: true,
  schema: z.object({ ...base, originalTransactionId: id, expectedUpdatedAt: iso, creditNoteId: id.optional(), reason: z.string().trim().min(1).max(500) }).strict(),
  preview: preview('Create credit note', { sideEffects: ['Creates a linked negating transaction'], rollback: 'Issue an explicit compensating transaction' }),
  execute: async (tx, input) => tx.createCreditNote(input),
});
define({
  id: 'approval.resolve.v1', domain: 'administration', mutation: true,
  schema: z.object({ ...base, approvalId: id, expectedUpdatedAt: iso, resolution: z.enum(['approved', 'rejected']), targetExpectedUpdatedAt: iso, note: z.string().max(1000).optional() }).strict(),
  preview: preview('Resolve approval atomically', { sideEffects: ['Updates approval and its allowlisted target in one transaction'] }),
  execute: async (tx, input) => tx.resolveApproval(input),
});

queued({
  actionId: 'report.export.v1', domain: 'reporting/export', label: 'Generate report export',
  schema: z.object({ ...base, report: z.enum(['portfolio', 'vat', 'income', 'expense', 'occupancy', 'audit']), format: z.enum(['pdf', 'csv', 'xlsx']), from: z.string().date().optional(), to: z.string().date().optional() }).strict()
    .refine((value) => !value.from || !value.to || value.from <= value.to, 'from must not exceed to'),
});
queued({
  actionId: 'data.export.v1', domain: 'reporting/export', label: 'Generate data export',
  schema: z.object({ ...base, dataset: z.enum(['buildings', 'units', 'contracts', 'customers', 'transactions', 'tasks', 'inventory']), format: z.enum(['json', 'csv', 'xlsx']) }).strict(),
});
queued({
  actionId: 'data.import.v1', domain: 'reporting/export', label: 'Validate and import data',
  schema: z.object({ ...base, dataset: z.enum(['buildings', 'units', 'contracts', 'customers', 'transactions', 'inventory']), uploadId: uuid, mode: z.enum(['insert-only', 'upsert']) }).strict(),
});
queued({
  actionId: 'backup.create.v1', domain: 'backup/migration', label: 'Create backup', critical: true,
  schema: z.object({ ...base, label: z.string().trim().min(1).max(200), includeAttachments: z.boolean().default(false) }).strict(),
});
queued({
  actionId: 'backup.restore.v1', domain: 'backup/migration', label: 'Restore backup', critical: true,
  schema: z.object({ ...base, backupId: uuid, verifyDigest: z.string().regex(/^[a-fA-F0-9]{64}$/) }).strict(),
});
queued({
  actionId: 'book.reset.v1', domain: 'backup/migration', label: 'Reset book data', critical: true,
  schema: z.object({ ...base, checkpointLabel: z.string().trim().min(1).max(200), retainUsers: z.boolean() }).strict(),
});
queued({
  actionId: 'migration.execute.v1', domain: 'backup/migration', label: 'Execute migration', critical: true,
  schema: z.object({ ...base, migrationId: id, direction: z.enum(['import', 'export', 'upgrade']), sourceDigest: z.string().regex(/^[a-fA-F0-9]{64}$/).optional() }).strict(),
});
queued({
  actionId: 'bank.merge.v1', domain: 'finance', label: 'Merge bank accounts', critical: true,
  schema: z.object({ ...base, sourceBankAccountId: id, targetBankAccountId: id, sourceExpectedUpdatedAt: iso, targetExpectedUpdatedAt: iso }).strict()
    .refine((value) => value.sourceBankAccountId !== value.targetBankAccountId, 'Bank accounts must differ'),
});
queued({
  actionId: 'book.cross-transfer.v1', domain: 'finance', label: 'Execute cross-book transfer', critical: true,
  schema: z.object({ ...base, destinationBookId: id, fromAccountId: id, toAccountId: id, amount: money, currency, date: z.string().date(), reference: z.string().trim().min(1).max(256) }).strict()
    .refine((value) => value.destinationBookId !== value.target.bookId, 'Destination book must differ'),
});
fixedCreate({
  actionId: 'user.create.v1', domain: 'administration', collection: 'users', label: 'Create user', critical: true,
  schema: z.object({ ...base, documentId: id.optional(), data: z.object({
    email: z.string().email(), displayName: z.string().trim().min(1).max(200),
    roleId: id, buildingIds: z.array(id).max(500), active: z.boolean().default(true),
  }).strict() }).strict(),
});
fixedUpdate({
  actionId: 'user.profile.update.v1', domain: 'administration', collection: 'users', label: 'Update user profile',
  schema: z.object({ ...base, documentId: id, expectedUpdatedAt: iso, displayName: z.string().trim().min(1).max(200), email: z.string().email() }).strict(),
  patch: (input) => ({ displayName: input.displayName, email: input.email }),
});
for (const [actionId, field, valueSchema, label] of [
  ['user.role.assign.v1', 'roleId', id, 'Assign user role'],
  ['user.building-scope.assign.v1', 'buildingIds', z.array(id).max(500), 'Assign user building scope'],
]) {
  fixedUpdate({
    actionId, domain: 'administration', collection: 'users', label, critical: true,
    schema: z.object({ ...base, documentId: id, expectedUpdatedAt: iso, value: valueSchema }).strict(),
    patch: (input) => ({ [field]: input.value }),
  });
}
fixedCreate({
  actionId: 'role.create.v1', domain: 'administration', collection: 'roles', label: 'Create role', critical: true,
  schema: z.object({ ...base, documentId: id.optional(), data: z.object({
    name: z.string().trim().min(1).max(100), permissions: z.array(id).max(200),
  }).strict() }).strict(),
});
fixedUpdate({
  actionId: 'role.update.v1', domain: 'administration', collection: 'roles', label: 'Update role', critical: true,
  schema: z.object({ ...base, documentId: id, expectedUpdatedAt: iso, name: z.string().trim().min(1).max(100), permissions: z.array(id).max(200) }).strict(),
  patch: (input) => ({ name: input.name, permissions: input.permissions }),
});
define({
  id: 'role.delete.v1', domain: 'administration', mutation: true, critical: true,
  schema: deleteInput, preview: preview('Soft-delete role', { checkpoint: true }),
  execute: async (tx, input, command) => {
    await tx.createCheckpoint(command.id, 'role.delete.v1', { roleId: input.documentId });
    return tx.setDocumentDeleted('roles', input.documentId, input.expectedUpdatedAt, true);
  },
});
for (const [actionId, status, label] of [
  ['license.suspend.v1', 'suspended', 'Suspend license'],
  ['license.resume.v1', 'active', 'Resume license'],
]) {
  fixedUpdate({
    actionId, domain: 'administration', collection: 'licenses', label, critical: true,
    schema: z.object({ ...base, documentId: id, expectedUpdatedAt: iso, reason: z.string().trim().min(1).max(1000) }).strict(),
    patch: (input) => ({ status, statusReason: input.reason }),
  });
}
fixedUpdate({
  actionId: 'license.config.update.v1', domain: 'administration', collection: 'licenses', label: 'Update license configuration', critical: true,
  schema: z.object({
    ...base, documentId: id, expectedUpdatedAt: iso,
    seats: z.number().int().min(1).max(10000), expiresAt: iso, features: z.array(id).max(200),
  }).strict(),
  patch: (input) => ({ seats: input.seats, expiresAt: input.expiresAt, features: input.features }),
});
fixedCreate({
  actionId: 'buyer-support.case.create.v1', domain: 'administration', collection: 'buyerSupportCases', label: 'Create buyer support case',
  schema: z.object({ ...base, documentId: id.optional(), data: z.object({
    buyerId: id, category: z.enum(['access', 'billing', 'data', 'deployment', 'other']),
    summary: z.string().trim().min(1).max(1000), priority: z.enum(['low', 'normal', 'high', 'urgent']),
  }).strict() }).strict(),
});
queued({
  actionId: 'buyer-support.operation.v1', domain: 'administration', label: 'Queue buyer support operation', critical: true,
  schema: z.object({
    ...base, buyerId: id, caseId: id,
    operation: z.enum(['reindex', 'rebuild-auth-index', 'rotate-integration', 'repair-deployment']),
    justification: z.string().trim().min(10).max(2000),
  }).strict(),
});
define({
  id: 'buyer.deployment.publish.v1', domain: 'administration', mutation: true, critical: true,
  centralInfrastructure: true,
  schema: z.object({
    ...base,
    buyerId: id,
    version: z.string().trim().min(1).max(128),
    artifactDigest: z.string().regex(/^[a-fA-F0-9]{64}$/),
    manifest: jsonObject,
  }).strict().refine((value) => value.target.adapter === 'buyer', 'Buyer deployment requires a buyer target'),
  preview: preview('Publish buyer deployment manifest', { sideEffects: ['Persists a deployment manifest', 'Creates a checkpointed deployment job'], rollback: 'Deploy a prior signed manifest as a new version', checkpoint: true }),
  execute: async (tx, input, command) => {
    const checkpoint = await tx.createCheckpoint(command.id, 'buyer.deployment.publish.v1', { buyerId: input.buyerId, version: input.version });
    const manifest = await tx.createBuyerDeploymentManifest(command.id, input);
    const job = await tx.enqueueJob(command.id, 'buyer.deployment.publish.v1', input.target, { manifestId: manifest.id }, checkpoint.id);
    return { manifest, job, checkpointId: checkpoint.id };
  },
});

const externalSchema = z.object({
  ...base,
  channel: z.enum(['email', 'sms', 'whatsapp', 'push', 'webhook', 'zatca', 'sadad', 'absher', 'ejar']),
  recipient: z.string().trim().min(1).max(500),
  payload: jsonObject,
}).strict();
for (const [actionId, critical = false] of [
  ['external.send.v1', false],
  ['notification.send.v1', false],
  ['reminder.send.v1', false],
  ['invoice.submit-zatca.v1', true],
  ['payment.send-sadad.v1', true],
  ['absher.submit.v1', true],
  ['ejar.submit.v1', true],
  ['sadad.submit.v1', true],
]) {
  define({
    id: actionId, domain: 'external effects', mutation: true, critical, schema: externalSchema,
    centralInfrastructure: true,
    preview: preview(`Queue ${actionId}`, { sideEffects: ['Queues an external effect in the outbox'], rollback: 'External delivery cannot be rolled back' }),
    execute: async (tx, input, command) =>
      tx.enqueueOutbox(command.id, actionId, `${actionId}:${input.target.tenantId}:${input.idempotencyKey}`, input),
  });
}
fixedCreate({
  actionId: 'reminder.create.v1', domain: 'operations', collection: 'reminders', label: 'Create reminder',
  schema: z.object({ ...base, documentId: id.optional(), data: z.object({
    dueAt: iso, kind: z.enum(['rent', 'contract', 'maintenance', 'license', 'custom']),
    targetId: id, message: z.string().trim().min(1).max(1000), channel: z.enum(['in-app', 'email', 'sms', 'whatsapp']),
  }).strict() }).strict(),
});
define({
  id: 'schedule.create.v1', domain: 'operations', mutation: true,
  schema: z.object({ ...base, scheduleId: uuid.optional(), actionId: id, actionInput: jsonObject, cron: z.string().trim().min(5).max(128), timezone: z.string().trim().min(1).max(64) }).strict(),
  preview: (input) => {
    const scheduledAction = getAction(input.actionId);
    if (!scheduledAction.mutation || scheduledAction.scheduleManagement || input.actionId.startsWith('schedule.')
      || input.actionId.startsWith('event-trigger.') || input.actionId.startsWith('automation.')) {
      throw Object.assign(new Error('Schedule management actions cannot be scheduled'), { code: 'ACTION_NOT_SCHEDULABLE' });
    }
    const scheduledInput = scheduledAction.schema.parse(input.actionInput);
    if ('actionId' in scheduledInput || 'actionInput' in scheduledInput) {
      throw Object.assign(new Error('Recursive scheduled actions are not allowed'), { code: 'ACTION_NOT_SCHEDULABLE' });
    }
    if (JSON.stringify(scheduledInput.target) !== JSON.stringify(input.target)) throw new Error('Scheduled action target must match schedule target');
    return preview('Create automation schedule', { sideEffects: [`Schedules allowlisted action ${input.actionId}`, 'Future executions still require worker policy enforcement'], rollback: 'Cancel the schedule' })(input);
  },
  execute: async (tx, input, command) => {
    const scheduledAction = getAction(input.actionId);
    if (!scheduledAction.mutation || scheduledAction.scheduleManagement || input.actionId.startsWith('schedule.')
      || input.actionId.startsWith('event-trigger.') || input.actionId.startsWith('automation.')) {
      throw Object.assign(new Error('Schedule management actions cannot be scheduled'), { code: 'ACTION_NOT_SCHEDULABLE' });
    }
    const scheduledInput = scheduledAction.schema.parse(input.actionInput);
    if ('actionId' in scheduledInput || 'actionInput' in scheduledInput) {
      throw Object.assign(new Error('Recursive scheduled actions are not allowed'), { code: 'ACTION_NOT_SCHEDULABLE' });
    }
    const nextRunAt = CronExpressionParser.parse(input.cron, { currentDate: new Date(), tz: input.timezone }).next().toDate();
    return tx.createSchedule(command.id, { ...input, nextRunAt });
  },
  scheduleManagement: true,
  centralInfrastructure: true,
});
define({
  id: 'schedule.cancel.v1', domain: 'operations', mutation: true, scheduleManagement: true,
  centralInfrastructure: true,
  schema: z.object({ ...base, scheduleId: uuid, expectedUpdatedAt: iso }).strict(),
  preview: preview('Cancel automation schedule'),
  execute: async (tx, input) => tx.cancelSchedule(input),
});

define({
  id: 'event-trigger.create.v1', domain: 'operations', mutation: true,
  scheduleManagement: true, centralInfrastructure: true,
  schema: z.object({ ...base, triggerId: uuid.optional(), eventType: id, actionId: id, actionInput: jsonObject }).strict(),
  preview: (input) => {
    const action = getAction(input.actionId);
    if (!action.mutation || action.scheduleManagement || input.actionId.startsWith('automation.')) {
      throw Object.assign(new Error('Management actions cannot be event triggers'), { code: 'ACTION_NOT_SCHEDULABLE' });
    }
    const parsed = action.schema.parse(input.actionInput);
    if (JSON.stringify(parsed.target) !== JSON.stringify(input.target)) throw new Error('Triggered action target must match');
    return preview('Create event trigger', { sideEffects: ['Events create awaiting-confirmation records only'] })(input);
  },
  execute: (tx, input, command) => tx.createEventTrigger(command.id, input),
});
define({
  id: 'event-trigger.cancel.v1', domain: 'operations', mutation: true,
  scheduleManagement: true, centralInfrastructure: true,
  schema: z.object({ ...base, triggerId: uuid, expectedUpdatedAt: iso }).strict(),
  preview: preview('Cancel event trigger'),
  execute: (tx, input) => tx.cancelEventTrigger(input),
});

for (const [actionId, operation, label] of [
  ['automation.emergency-disable.v1', 'disableEmergency', 'Emergency-disable automation'],
  ['automation.emergency-enable.v1', 'enableEmergency', 'Emergency-enable automation'],
  ['automation.worker-pause.v1', 'pauseWorker', 'Pause automation worker'],
  ['automation.worker-resume.v1', 'resumeWorker', 'Resume automation worker'],
]) {
  define({
    id: actionId, domain: 'operations', mutation: true, critical: true,
    scheduleManagement: true, centralInfrastructure: true,
    schema: z.object({ ...base, reason: z.string().trim().min(10).max(1000) }).strict(),
    preview: preview(label, { checkpoint: true }),
    execute: (tx, input, command) => tx[operation](command.id, input.reason),
  });
}

define({
  id: 'command.rollback.v1',
  domain: 'administration',
  mutation: true,
  critical: true,
  rollbackAction: true,
  schema: z.object({
    ...base,
    originalCommandId: uuid,
    reason: z.string().trim().min(1).max(1000),
  }).strict(),
  preview: preview('Rollback completed command', {
    sideEffects: ['Restores the exact audited before-state only if every current record still equals its audited after-state'],
    rollback: 'Rollback commands are not recursively reversible',
    checkpoint: true,
  }),
  execute: (tx, input, command) => tx.rollbackCommand(input, command),
});

export const ACTION_REGISTRY = new Map(definitions.map((item) => [item.id, item]));
if (ACTION_REGISTRY.size !== definitions.length) throw new Error('Duplicate action ID');

export function getAction(actionId) {
  const action = ACTION_REGISTRY.get(actionId);
  if (!action) throw Object.assign(new Error('Action is not allowlisted'), { code: 'ACTION_NOT_ALLOWED' });
  return action;
}

export function actionCatalog() {
  return definitions.map((action) => {
    const rollbackSupported = Boolean(action.mutation && !action.centralInfrastructure && !action.rollbackAction);
    return {
      actionId: action.id,
      domain: action.domain,
      mutation: action.mutation,
      critical: Boolean(action.critical),
      rollbackSupported,
      rollbackUnsupportedReason: rollbackSupported
        ? undefined
        : action.rollbackAction
          ? 'Rollback commands are not recursively reversible'
          : action.centralInfrastructure
            ? 'Central jobs, controls, external effects, reports, backups, migrations, and schedules are not generically rollbackable'
            : 'Action has no exact immutable operation audit',
      input: z.toJSONSchema(action.schema),
    };
  });
}
