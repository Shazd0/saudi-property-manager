export const BANK_REFERENCE_FIELDS = ['bankName', 'fromBankName', 'toBankName'] as const;

export type BankReferenceField = typeof BANK_REFERENCE_FIELDS[number];

type BankReferencePatchOptions = {
  fields?: readonly BankReferenceField[];
  includeVatReportSnapshot?: boolean;
};

export function bankAccountKey(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function sourceKeySet(sourceBankNames: readonly string[]): Set<string> {
  return new Set(sourceBankNames.map(bankAccountKey).filter(Boolean));
}

export function recordTouchesBank(record: Record<string, any>, bankName: string, fields: readonly BankReferenceField[] = BANK_REFERENCE_FIELDS): boolean {
  const key = bankAccountKey(bankName);
  if (!key) return false;
  return fields.some(field => bankAccountKey(record?.[field]) === key);
}

export function countRecordsByBank(
  records: readonly Record<string, any>[],
  fields: readonly BankReferenceField[] = BANK_REFERENCE_FIELDS,
): Record<string, number> {
  const counts: Record<string, number> = {};
  records.forEach(record => {
    const touched = new Set<string>();
    fields.forEach(field => {
      const key = bankAccountKey(record?.[field]);
      if (key) touched.add(key);
    });
    touched.forEach(key => {
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return counts;
}

export function bankReferencePatch(
  record: Record<string, any>,
  sourceBankNames: readonly string[],
  targetBankName: string,
  options: BankReferencePatchOptions = {},
): Record<string, any> | null {
  const sources = sourceKeySet(sourceBankNames);
  const target = String(targetBankName || '').trim();
  if (!sources.size || !target) return null;

  const patch: Record<string, any> = {};
  const fields = options.fields || BANK_REFERENCE_FIELDS;
  fields.forEach(field => {
    if (sources.has(bankAccountKey(record?.[field]))) {
      patch[field] = target;
    }
  });

  if (options.includeVatReportSnapshot && record?.vatReportSnapshot && sources.has(bankAccountKey(record.vatReportSnapshot.bankName))) {
    patch.vatReportSnapshot = {
      ...record.vatReportSnapshot,
      bankName: target,
    };
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function rewriteBankReferences<T extends Record<string, any>>(
  record: T,
  sourceBankNames: readonly string[],
  targetBankName: string,
  options: BankReferencePatchOptions = {},
): T {
  const patch = bankReferencePatch(record, sourceBankNames, targetBankName, options);
  return patch ? { ...record, ...patch } : record;
}
