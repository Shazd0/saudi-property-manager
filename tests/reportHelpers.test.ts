import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as svc from '../services/firestoreService';

const sampleTxs = [
  { id: 't1', date: '2026-01-01', type: 'INCOME', amount: 1000, buildingId: 'b1' },
  { id: 't2', date: '2026-01-05', type: 'EXPENSE', amount: 200, expenseCategory: 'Maintenance', buildingId: 'b1' },
  { id: 't3', date: '2026-01-10', type: 'EXPENSE', amount: 500, expenseCategory: 'Salary', employeeId: 'e1', employeeName: 'Alice' },
  { id: 't4', date: '2026-02-01', type: 'INCOME', amount: 1500, buildingId: 'b2' },
  { id: 't5', date: '2026-02-15', type: 'EXPENSE', amount: 300, expenseCategory: 'Maintenance', buildingId: 'b2' }
];

describe('report helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(svc, 'getTransactions').mockResolvedValue(sampleTxs as any);
  });

  it('calculates income and expense summary', async () => {
    const res = await svc.getIncomeExpenseSummary('2026-01-01', '2026-01-31');
    expect(res.income).toBe(1000);
    expect(res.expense).toBe(700);
    expect(res.net).toBe(300);
  });

  it('groups by monthly period', async () => {
    const res = await svc.getIncomeExpenseByPeriod('monthly', '2026-01-01', '2026-02-28');
    const jan = res.find(r => r.period === '2026-01');
    const feb = res.find(r => r.period === '2026-02');
    expect(jan).toBeDefined();
    expect(feb).toBeDefined();
    expect(jan.income).toBe(1000);
    expect(jan.expense).toBe(700);
    expect(feb.income).toBe(1500);
  });

  it('produces salary report grouped by employee', async () => {
    const res = await svc.getSalaryReport('2026-01-01', '2026-12-31');
    const alice = res.find((r: any) => r.employeeId === 'e1');
    expect(alice).toBeDefined();
    expect(alice.total).toBe(500);
  });

  it('returns maintenance report total', async () => {
    const res = await svc.getMaintenanceReport('2026-01-01', '2026-12-31');
    expect(res.total).toBe(500);
    expect(res.items.length).toBe(2);
  });
});
