import type { User } from '../types';
import {
  getBuildings,
  getContracts,
  getCustomers,
  getTransactions,
  saveWhatsAppMessage,
} from './firestoreService';
import {
  buildOverdueRows,
  resolveBuilding,
  summarizeBuildingOutstanding,
  type OverdueTenantRow,
} from '../utils/collectionOverdue';

export type AiAction =
  | { type: 'whatsapp_preview'; rows: OverdueTenantRow[] }
  | { type: 'export_table'; title: string; headers: string[]; rows: string[][] };

export type AmlakAiContext = {
  facts: string;
  toolsRun: string[];
  actions: AiAction[];
  directAnswer?: string;
};

type LoadedData = {
  buildings: any[];
  contracts: any[];
  transactions: any[];
  customers: any[];
};

async function loadData(): Promise<LoadedData> {
  const [buildings, contracts, transactions, customers] = await Promise.all([
    getBuildings(),
    getContracts(),
    getTransactions({ role: 'ADMIN' }),
    getCustomers(),
  ]);
  return {
    buildings: buildings || [],
    contracts: contracts || [],
    transactions: transactions || [],
    customers: customers || [],
  };
}

function extractBuildingName(message: string): string | null {
  const patterns = [
    /(?:in|at|for)\s+([a-zA-Z0-9\u0600-\u06FF\s\-]+?)(?:\?|$|\.|,)/i,
    /(?:building|عمارة|مبنى)\s+([a-zA-Z0-9\u0600-\u06FF\s\-]+)/i,
    /outstanding\s+(.+?)(?:\?|$)/i,
  ];
  for (const p of patterns) {
    const m = message.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function detectIntents(message: string): string[] {
  const lower = message.toLowerCase();
  const intents: string[] = [];
  if (
    /outstanding|balance|owed|متبقي|مستحق/.test(lower) &&
    /building|عمارة|مبنى|in |at /.test(lower)
  ) {
    intents.push('outstanding_building');
  }
  if (/how much|total|كم|مبلغ/.test(lower) && !intents.includes('outstanding_building')) {
    if (extractBuildingName(message)) intents.push('outstanding_building');
  }
  if (/overdue|late|unpaid|متأخر|متأخرين/.test(lower)) intents.push('overdue_list');
  if (/send\s+remind|whatsapp|واتس|تذكير/.test(lower)) intents.push('send_reminders');
  if (/anomal|duplicate|unusual|مكرر|شاذ/.test(lower)) intents.push('anomalies');
  if (/table|report|قائمة|تقرير/.test(lower) && /overdue|متأخر/.test(lower)) {
    intents.push('mini_report');
  }
  return intents;
}

export type Anomaly = {
  kind: string;
  description: string;
  severity: 'warning' | 'critical';
};

export function detectAnomalies(
  transactions: any[],
  contracts: any[],
  buildings: any[],
  opts?: { buildingId?: string; days?: number },
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const days = opts?.days ?? 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let income = transactions.filter(
    (t) =>
      t.type === 'INCOME' &&
      t.status !== 'REJECTED' &&
      t.date >= cutoffStr &&
      (!opts?.buildingId || t.buildingId === opts.buildingId),
  );

  const dupMap = new Map<string, any[]>();
  for (const t of income) {
    const key = `${t.buildingId}|${t.unitNumber}|${t.amount}|${t.date}`;
    const arr = dupMap.get(key) || [];
    arr.push(t);
    dupMap.set(key, arr);
  }
  for (const [, arr] of dupMap) {
    if (arr.length > 1) {
      anomalies.push({
        kind: 'duplicate_income',
        description: `Duplicate income: ${arr[0].amount} SAR on ${arr[0].date} for unit ${arr[0].unitNumber || '—'} (${arr.length} entries)`,
        severity: 'warning',
      });
    }
  }

  const expenses = transactions.filter(
    (t) =>
      t.type === 'EXPENSE' &&
      t.status !== 'REJECTED' &&
      t.date >= cutoffStr &&
      (!opts?.buildingId || t.buildingId === opts.buildingId),
  );

  const byBuildingCat = new Map<string, number[]>();
  for (const t of expenses) {
    const cat = t.expenseCategory || 'General';
    const bid = t.buildingId || '_all';
    const key = `${bid}|${cat}`;
    const arr = byBuildingCat.get(key) || [];
    arr.push(Number(t.amount) || 0);
    byBuildingCat.set(key, arr);
  }

  for (const t of expenses) {
    const cat = t.expenseCategory || 'General';
    const bid = t.buildingId || '_all';
    const key = `${bid}|${cat}`;
    const amounts = byBuildingCat.get(key) || [];
    if (amounts.length < 3) continue;
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amt = Number(t.amount) || 0;
    if (avg > 0 && amt > avg * 3) {
      anomalies.push({
        kind: 'expense_spike',
        description: `Large expense: ${amt.toLocaleString()} SAR (${cat}) on ${t.date} — 3× category average`,
        severity: 'warning',
      });
      break;
    }
  }

  const pending = income.filter((t) => t.status === 'PENDING');
  const byBld = new Map<string, number>();
  for (const t of pending) {
    const bid = t.buildingId || '_';
    byBld.set(bid, (byBld.get(bid) || 0) + 1);
  }
  for (const [bid, count] of byBld) {
    if (count >= 5) {
      const name =
        buildings.find((b: any) => b.id === bid)?.name || bid;
      anomalies.push({
        kind: 'pending_backlog',
        description: `${count} pending income entries for ${name} — approval backlog`,
        severity: 'warning',
      });
    }
  }

  return anomalies.slice(0, 10);
}

export async function getOutstandingByBuilding(
  buildingNameOrId: string,
  data?: LoadedData,
): Promise<{ summary: ReturnType<typeof summarizeBuildingOutstanding> | null; facts: string }> {
  const d = data || (await loadData());
  const building = resolveBuilding(buildingNameOrId, d.buildings);
  if (!building) {
    return { summary: null, facts: `Building not found: "${buildingNameOrId}".` };
  }
  const summary = summarizeBuildingOutstanding(
    building,
    d.contracts,
    d.buildings,
    d.transactions,
  );
  const facts = [
    `Building: ${summary.buildingName}`,
    `Active contracts: ${summary.contractCount}`,
    `Total outstanding: ${summary.totalOutstanding.toLocaleString()} SAR`,
    `Overdue tenants: ${summary.overdueCount} (${summary.overdueAmount.toLocaleString()} SAR)`,
  ].join('\n');
  return { summary, facts };
}

export async function getOverdueTenants(opts?: {
  buildingId?: string;
  minDaysLate?: number;
  limit?: number;
  data?: LoadedData;
}): Promise<OverdueTenantRow[]> {
  const d = opts?.data || (await loadData());
  return buildOverdueRows({
    contracts: d.contracts,
    buildings: d.buildings,
    transactions: d.transactions,
    customers: d.customers,
    buildingId: opts?.buildingId,
    minDaysLate: opts?.minDaysLate ?? 1,
    limit: opts?.limit ?? 20,
  });
}

export async function queueWhatsAppReminders(
  rows: OverdueTenantRow[],
  userId: string,
): Promise<{ queued: number }> {
  let queued = 0;
  for (const row of rows) {
    if (!row.mobileNo || row.remaining < 1) continue;
    await saveWhatsAppMessage({
      id: crypto.randomUUID(),
      recipientPhone: row.mobileNo,
      recipientName: row.customerName,
      templateName: 'payment_reminder',
      messageType: 'payment_reminder',
      variables: {
        name: row.customerName,
        amount: String(row.remaining),
        building: row.buildingName,
        unit: row.unitName,
        dueDate: row.nextDueDate || '—',
      },
      status: 'Queued',
      relatedId: row.contractId,
      createdAt: Date.now(),
      createdBy: userId,
    });
    queued++;
  }
  return { queued };
}

export function buildMiniReportTable(rows: OverdueTenantRow[]): {
  title: string;
  headers: string[];
  tableRows: string[][];
} {
  return {
    title: 'Overdue tenants',
    headers: ['Tenant', 'Building', 'Unit', 'Days late', 'Outstanding (SAR)'],
    tableRows: rows.map((r) => [
      r.customerName,
      r.buildingName,
      r.unitName,
      String(r.daysLate),
      r.remaining.toLocaleString(),
    ]),
  };
}

export async function buildContextForMessage(
  message: string,
  user: User,
): Promise<AmlakAiContext> {
  const intents = detectIntents(message);
  const toolsRun: string[] = [];
  const actions: AiAction[] = [];
  const factLines: string[] = [];
  let directAnswer: string | undefined;

  if (intents.length === 0) {
    return { facts: '', toolsRun, actions };
  }

  const data = await loadData();

  if (intents.includes('outstanding_building')) {
    const name = extractBuildingName(message);
    if (name) {
      toolsRun.push('outstanding_building');
      const { facts } = await getOutstandingByBuilding(name, data);
      factLines.push(facts);
    }
  }

  if (intents.includes('overdue_list') || intents.includes('mini_report')) {
    toolsRun.push('overdue_list');
    const rows = await getOverdueTenants({ minDaysLate: 1, limit: 15, data });
    if (rows.length === 0) {
      factLines.push('No overdue tenants with outstanding balance.');
    } else {
      factLines.push(`Overdue tenants (${rows.length} shown):`);
      for (const r of rows) {
        factLines.push(
          `- ${r.customerName} | ${r.buildingName} / ${r.unitName} | ${r.remaining.toLocaleString()} SAR | ${r.daysLate} days late`,
        );
      }
      const total = rows.reduce((s, r) => s + r.remaining, 0);
      factLines.push(`Subtotal shown: ${total.toLocaleString()} SAR`);

      if (intents.includes('mini_report')) {
        const report = buildMiniReportTable(rows);
        actions.push({
          type: 'export_table',
          title: report.title,
          headers: report.headers,
          rows: report.tableRows,
        });
      }
    }
  }

  if (intents.includes('send_reminders')) {
    toolsRun.push('send_reminders');
    const rows = await getOverdueTenants({ minDaysLate: 1, limit: 10, data });
    const withMobile = rows.filter((r) => r.mobileNo);
    if (withMobile.length === 0) {
      factLines.push('No overdue tenants with mobile numbers for WhatsApp.');
    } else {
      factLines.push(
        `Ready to queue ${withMobile.length} payment reminder(s) via WhatsApp.`,
      );
      actions.push({ type: 'whatsapp_preview', rows: withMobile });
    }
  }

  if (intents.includes('anomalies')) {
    toolsRun.push('anomalies');
    const list = detectAnomalies(data.transactions, data.contracts, data.buildings);
    if (list.length === 0) {
      factLines.push('No anomalies detected in the last 90 days.');
    } else {
      factLines.push('Anomalies:');
      for (const a of list) factLines.push(`- [${a.severity}] ${a.description}`);
    }
  }

  if (
    intents.includes('overdue_list') &&
    !intents.includes('outstanding_building') &&
    /how many|count|total/.test(message.toLowerCase())
  ) {
    const rows = await getOverdueTenants({ minDaysLate: 1, limit: 500, data });
    const total = rows.reduce((s, r) => s + r.remaining, 0);
    directAnswer = `${rows.length} overdue tenant(s), total ${total.toLocaleString()} SAR outstanding.`;
  }

  return {
    facts: factLines.join('\n'),
    toolsRun,
    actions,
    directAnswer,
  };
}

/** Short summary for VoiceAssistant (no LLM). */
export async function answerDataQuestion(text: string): Promise<string | null> {
  const ctx = await buildContextForMessage(text, { id: '', name: '', role: 'ADMIN' } as User);
  if (ctx.directAnswer) return ctx.directAnswer;
  if (ctx.facts) return ctx.facts.split('\n').slice(0, 4).join('. ');
  return null;
}
