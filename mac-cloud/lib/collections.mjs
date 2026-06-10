export const BOOK_SCOPED_COLLECTIONS = new Set([
  'transactions',
  'buildings',
  'contracts',
  'customers',
  'vendors',
  'tasks',
  'stocks',
  'stock',
  'stock_entries',
  'transfers',
  'service_agreements',
  'approvals',
  'users',
  'notifications',
  'images',
  'registry',
  'stockItems',
  'stockTransfers',
  'sadad_bills',
  'ejar_contracts',
  'utility_readings',
  'security_deposits',
  'whatsapp_messages',
  'bank_statements',
  'reconciliation_records',
  'nafath_verifications',
  'municipality_licenses',
  'civil_defense_records',
  'absher_records',
  'amlakSheets',
]);

export const KNOWN_COLLECTIONS = [
  'transactions',
  'buildings',
  'contracts',
  'customers',
  'vendors',
  'users',
  'banks',
  'meta',
  'books',
  'tasks',
  'approvals',
  'transfers',
  'audit',
  'amlakSheets',
  'stocks',
  'stock',
  'stock_entries',
  'stockItems',
  'stockTransfers',
  'registry',
  'service_agreements',
  'borrowings',
  'sadad_bills',
  'ejar_contracts',
  'utility_readings',
  'security_deposits',
  'municipality_licenses',
  'civil_defense_records',
  'absher_records',
  'whatsapp_messages',
  'bank_statements',
  'reconciliation_records',
  'nafath_verifications',
  'chatRooms',
  'chatMessages',
  'chatPresence',
  'chatStatuses',
  'notifications',
  'notification_queue',
  'userTokens',
  'images',
  'backups',
];

export const MENU_PHASE_COLLECTIONS = new Set([
  'transactions',
  'contracts',
  'approvals',
  'buildings',
  'customers',
  'transfers',
  'meta',
  'tasks',
  'users',
  'vendors',
  'banks',
  'service_agreements',
  'amlakSheets',
]);

export function splitBookCollection(sourceCollection) {
  const match = /^book_([^_]+)_(.+)$/.exec(sourceCollection || '');
  if (!match) {
    return {
      bookId: 'default',
      collectionName: sourceCollection,
      sourceCollection,
    };
  }
  const [, bookId, collectionName] = match;
  return {
    bookId: bookId || 'default',
    collectionName,
    sourceCollection,
  };
}

export function rawBookCollection(bookId, collectionName) {
  if (!bookId || bookId === 'default' || !BOOK_SCOPED_COLLECTIONS.has(collectionName)) {
    return collectionName;
  }
  return `book_${bookId}_${collectionName}`;
}
