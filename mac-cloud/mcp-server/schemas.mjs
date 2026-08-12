import { z } from 'zod';

const id = z.string().trim().min(1).max(128).regex(/^[\w.:@/-]+$/);
const limit = z.number().int().min(1).max(100).default(25);
const date = z.string().date();

export const bookSchema = z.object({ bookId: id }).strict();
export const ownerSchemas = {
  'owner.list_buildings': bookSchema.extend({ limit }).strict(),
  'owner.expiring_contracts': bookSchema.extend({ days: z.number().int().min(1).max(365).default(90), limit }).strict(),
  'owner.search_transactions': bookSchema.extend({
    query: z.string().trim().max(100).optional(),
    buildingId: id.optional(),
    from: date.optional(),
    to: date.optional(),
    limit,
  }).strict().refine((v) => !v.from || !v.to || v.from <= v.to, 'from must not exceed to'),
  'owner.portfolio_summary': bookSchema,
};

export const buyerSchemas = {
  'buyer.list_properties': z.object({ limit }).strict(),
  'buyer.property_lookup': z.object({ propertyId: id }).strict(),
  'buyer.contract_expiry': z.object({ days: z.number().int().min(1).max(365).default(90), limit }).strict(),
  'buyer.rent_transaction_status': z.object({ limit }).strict(),
  'buyer.maintenance_status': z.object({ limit }).strict(),
  'buyer.vat_summary': z.object({ from: date.optional(), to: date.optional() }).strict()
    .refine((v) => !v.from || !v.to || v.from <= v.to, 'from must not exceed to'),
};

export const assistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  tool: z.enum(Object.keys(buyerSchemas)).optional(),
  arguments: z.record(z.string(), z.unknown()).default({}),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    text: z.string().trim().min(1).max(2000),
  }).strict()).max(20).default([]),
}).strict();

export function parseSchema(schema, input) {
  return schema.parse(input ?? {});
}
