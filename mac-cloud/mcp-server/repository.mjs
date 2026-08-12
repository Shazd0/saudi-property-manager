import pg from 'pg';

const { Pool } = pg;
const COLLECTIONS = new Set(['buildings', 'contracts', 'transactions', 'tasks', 'customers']);

export function createRepository({ connectionString, timeoutMs = 5000, pool } = {}) {
  const db = pool || new Pool({
    connectionString,
    max: Number(process.env.MCP_PG_POOL_MAX || 5),
    statement_timeout: timeoutMs,
    query_timeout: timeoutMs,
  });

  async function documents(bookId, collection, limit = 100) {
    if (!COLLECTIONS.has(collection)) throw new Error('Collection is not allowlisted');
    const bounded = Math.min(Math.max(Number(limit) || 1, 1), 250);
    const result = await db.query(
      `select doc_id, data
         from documents
        where book_id = $1 and collection_name = $2 and deleted = false
        order by updated_at desc
        limit $3`,
      [bookId, collection, bounded],
    );
    return result.rows.map((row) => ({ ...(row.data || {}), id: row.doc_id }));
  }

  async function audit(entry) {
    await db.query(
      `insert into mcp_audit_log
       (actor_type, actor_id, buyer_id, book_id, tool_name, outcome, request_metadata)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        entry.actorType, entry.actorId, entry.buyerId || null, entry.bookId,
        entry.tool, entry.outcome, JSON.stringify(entry.metadata || {}),
      ],
    );
  }

  return { documents, audit, close: () => db.end() };
}
