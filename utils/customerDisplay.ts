import type { Customer } from '../types';

/**
 * Formats a customer name with their room number prefix when available.
 * Example: "A-101 - John Doe" or just "John Doe" if no room number.
 */
export const formatNameWithRoom = (name?: string | null, roomNumber?: string | null): string => {
  const safeName = (name || '').toString().trim();
  const safeRoom = (roomNumber || '').toString().trim();
  if (!safeRoom) return safeName;
  if (!safeName) return safeRoom;
  // Avoid double-prefixing if the name already starts with the room number.
  const alreadyPrefixed = new RegExp(`^${safeRoom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-\\s*`).test(safeName);
  if (alreadyPrefixed) return safeName;
  return `${safeRoom} - ${safeName}`;
};

/**
 * Builds a lookup map from customerId -> roomNumber for quick enrichment
 * of transaction-style records that only carry customerName + customerId.
 */
export const buildCustomerRoomMap = (customers: Array<Pick<Customer, 'id' | 'roomNumber'>> = []): Record<string, string> => {
  const map: Record<string, string> = {};
  customers.forEach(c => {
    if (c && c.id && c.roomNumber) {
      map[c.id] = c.roomNumber;
    }
  });
  return map;
};

/**
 * Convenience helper that formats a transaction / entry style record's
 * customerName using a pre-built room map keyed by customerId.
 */
export const formatCustomerFromMap = (
  customerName: string | undefined | null,
  customerId: string | undefined | null,
  roomMap: Record<string, string>
): string => {
  const room = customerId ? roomMap[customerId] : undefined;
  return formatNameWithRoom(customerName || '', room);
};
