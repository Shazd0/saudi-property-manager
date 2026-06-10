import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://amlak:amlak_local_password@localhost:5432/amlak',
  max: Number(process.env.PG_POOL_MAX || 10),
});

export async function closePool() {
  await pool.end();
}

export async function healthcheck() {
  const result = await pool.query('select now() as now');
  return result.rows[0];
}

export async function upsertDocument(client, {
  bookId = 'default',
  collectionName,
  docId,
  data,
  deleted = false,
  sourceCollection,
  sourcePath,
}) {
  const payload = data && typeof data === 'object' ? data : {};
  const result = await client.query(
    `
      insert into documents (
        book_id,
        collection_name,
        doc_id,
        data,
        deleted,
        source_collection,
        source_path
      )
      values ($1, $2, $3, $4::jsonb, $5, $6, $7)
      on conflict (book_id, collection_name, doc_id)
      do update set
        data = excluded.data,
        deleted = excluded.deleted,
        source_collection = excluded.source_collection,
        source_path = excluded.source_path
      returning data
    `,
    [
      bookId || 'default',
      collectionName,
      docId,
      JSON.stringify(payload),
      Boolean(deleted || payload.deleted),
      sourceCollection || collectionName,
      sourcePath || `${sourceCollection || collectionName}/${docId}`,
    ],
  );
  return result.rows[0]?.data;
}

export async function listDocuments({
  bookId = 'default',
  collectionName,
  includeDeleted = false,
  orderField,
  orderDirection = 'desc',
  filters = {},
}) {
  const values = [bookId || 'default', collectionName];
  const where = ['book_id = $1', 'collection_name = $2'];

  if (!includeDeleted) where.push('deleted = false');

  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null || value === '') continue;
    values.push(key);
    values.push(String(value));
    where.push(`data->>$${values.length - 1} = $${values.length}`);
  }

  const direction = String(orderDirection).toLowerCase() === 'asc' ? 'asc' : 'desc';
  const orderSql = orderField
    ? `order by data->>$${values.push(orderField)} ${direction}, updated_at ${direction}`
    : 'order by updated_at desc';

  const result = await pool.query(
    `
      select data, doc_id
      from documents
      where ${where.join(' and ')}
      ${orderSql}
    `,
    values,
  );

  return result.rows.map((row) => ({
    ...(row.data || {}),
    id: row.doc_id,
  }));
}

export async function getDocument({ bookId = 'default', collectionName, docId, includeDeleted = false }) {
  const result = await pool.query(
    `
      select data, doc_id
      from documents
      where book_id = $1
        and collection_name = $2
        and doc_id = $3
        and ($4::boolean = true or deleted = false)
      limit 1
    `,
    [bookId || 'default', collectionName, docId, includeDeleted],
  );
  const row = result.rows[0];
  return row ? { ...(row.data || {}), id: row.doc_id } : null;
}

export async function saveDocument({ bookId = 'default', collectionName, docId, data, actor }) {
  const id = docId || data?.id || crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const before = await client.query(
      'select data from documents where book_id = $1 and collection_name = $2 and doc_id = $3',
      [bookId || 'default', collectionName, id],
    );
    const payload = { ...(data || {}), id };
    const saved = await upsertDocument(client, {
      bookId,
      collectionName,
      docId: id,
      data: payload,
      deleted: Boolean(payload.deleted),
    });
    await client.query(
      `
        insert into api_audit_log (action, book_id, collection_name, doc_id, before_data, after_data, actor)
        values ('save', $1, $2, $3, $4::jsonb, $5::jsonb, $6)
      `,
      [
        bookId || 'default',
        collectionName,
        id,
        JSON.stringify(before.rows[0]?.data || null),
        JSON.stringify(saved),
        actor || null,
      ],
    );
    await client.query('commit');
    return { ...(saved || payload), id };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteDocument({ bookId = 'default', collectionName, docId, actor }) {
  const existing = await getDocument({ bookId, collectionName, docId, includeDeleted: true });
  const payload = {
    ...(existing || { id: docId }),
    deleted: true,
    deletedAt: new Date().toISOString(),
  };
  return saveDocument({ bookId, collectionName, docId, data: payload, actor });
}

export async function createMigrationRun(options) {
  const result = await pool.query(
    'insert into migration_runs (mode, options) values ($1, $2::jsonb) returning id',
    [options?.mode || 'all', JSON.stringify(options || {})],
  );
  return result.rows[0].id;
}

export async function finishMigrationRun(id, { status, collections, totalRead, totalWritten, errors }) {
  await pool.query(
    `
      update migration_runs
      set status = $2,
          collections = $3::jsonb,
          total_read = $4,
          total_written = $5,
          errors = $6::jsonb,
          finished_at = now()
      where id = $1
    `,
    [
      id,
      status,
      JSON.stringify(collections || {}),
      totalRead || 0,
      totalWritten || 0,
      JSON.stringify(errors || []),
    ],
  );
}
