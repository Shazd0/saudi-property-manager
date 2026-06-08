import { ExpenseCategory } from '../types';

export const DEFAULT_INCOME_CATEGORIES = [
  'Service Fee',
  'Penalty',
  'Commission',
  'Deposit',
  'Insurance Claim',
  'Parking',
  'Late Fee',
  'Utility Recharge',
  'Miscellaneous',
].sort((a, b) => a.localeCompare(b));

export const EXPENSE_SUBCATEGORIES: Record<string, string[]> = {
  'General Expense': ['Office Supplies', 'Travel & Transport', 'Printing & Stationery', 'Bank Charges', 'Cleaning', 'Advertisement', 'Miscellaneous'],
  'Head Office': ['Rent', 'Admin Costs', 'IT Equipment', 'Communications', 'Furniture & Fixtures'],
  Salary: ['Basic Salary', 'Housing Allowance', 'Transport Allowance', 'Overtime', 'GOSI Contribution', 'End of Service', 'Bonus'],
  Borrowing: ['Personal Loan', 'Business Loan', 'Repayment', 'Opening Balance'],
  'Owner Expense': ['Personal Drawings', 'Owner Investment', 'Owner Settlement'],
  Maintenance: ['Plumbing', 'Electrical', 'AC / HVAC', 'Painting', 'Civil Works', 'Pest Control', 'Elevator', 'General Repairs'],
  Utilities: ['Electricity', 'Water', 'Internet / Fiber', 'Gas', 'Telephone / Mobile'],
  'Vendor Payment': ['Materials Supply', 'Labor', 'Equipment Rental', 'Subcontractor', 'Services'],
  'Property Rent': ['Monthly Rent', 'Annual Rent', 'Security Deposit', 'Advance Rent'],
  'Service Agreement': ['Annual Contract', 'Quarterly Installment', 'Monthly Installment', 'AMC'],
};

export function mergeExpenseCategories(custom: string[] = []): string[] {
  return Array.from(new Set([...Object.values(ExpenseCategory), ...custom].filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function mergeIncomeCategories(custom: string[] = []): string[] {
  return Array.from(new Set([...DEFAULT_INCOME_CATEGORIES, ...custom].filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function getExpenseSubcategories(category: string, customMap: Record<string, string[]> = {}): string[] {
  return Array.from(new Set([...(EXPENSE_SUBCATEGORIES[category] || []), ...(customMap[category] || [])].filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function readLocalExpenseSubcategories(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem('qeExpenseSubCategories');
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
