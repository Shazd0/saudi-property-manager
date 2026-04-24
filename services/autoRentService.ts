/**
 * Auto Rent Payment Service
 * 
 * Checks active contracts and auto-generates rent payment transactions
 * on their due dates. Marks them as "Auto Payment" in transaction details.
 */

import { getContracts, getTransactions, saveTransaction } from './firestoreService';
import { TransactionType, PaymentMethod, TransactionStatus } from '../types';
import { dateToLocalStr } from '../utils/dateFormat';
import { getInstallmentStartDates } from '../utils/installmentSchedule';

const AUTO_RENT_KEY = 'autoRentEnabled';
const LAST_RUN_KEY = 'autoRentLastRun';
const AUTO_RENT_LOG_KEY = 'autoRentLog';

export const isAutoRentEnabled = (): boolean => {
  return localStorage.getItem(AUTO_RENT_KEY) === 'true';
};

export const setAutoRentEnabled = (enabled: boolean): void => {
  localStorage.setItem(AUTO_RENT_KEY, enabled ? 'true' : 'false');
};

export const getLastRunDate = (): string | null => {
  return localStorage.getItem(LAST_RUN_KEY);
};

export const getAutoRentLog = (): any[] => {
  try {
    const log = localStorage.getItem(AUTO_RENT_LOG_KEY);
    return log ? JSON.parse(log) : [];
  } catch {
    return [];
  }
};

const addToLog = (entry: any) => {
  const log = getAutoRentLog();
  log.unshift({ ...entry, timestamp: Date.now() });
  // Keep last 50 entries
  localStorage.setItem(AUTO_RENT_LOG_KEY, JSON.stringify(log.slice(0, 50)));
};

/**
 * Calculate installment due dates for a contract.
 * Returns an array of { date: string (YYYY-MM-DD), amount: number, installmentNo: number }
 */
const getInstallmentSchedule = (contract: any): Array<{ date: string; amount: number; installmentNo: number }> => {
  if (!contract.fromDate || !contract.installmentCount) return [];
  
  const schedule: Array<{ date: string; amount: number; installmentNo: number }> = [];
  const installmentCount = Math.max(1, Number(contract.installmentCount) || 1);
  const dueDates = getInstallmentStartDates({
    fromDate: contract.fromDate,
    toDate: contract.toDate,
    periodMonths: Number(contract.periodMonths) || 0,
    periodDays: Number(contract.periodDays) || 0,
    installmentCount,
  });
  
  for (let i = 0; i < installmentCount; i++) {
    const dueDate = dueDates[i] || new Date();
    
    const amount = i === 0 
      ? (contract.firstInstallment || contract.totalValue / installmentCount)
      : (contract.otherInstallment || contract.totalValue / installmentCount);
    
    schedule.push({
      date: dateToLocalStr(dueDate),
      amount,
      installmentNo: i + 1,
    });
  }
  
  return schedule;
};

/**
 * Check and process auto rent payments.
 * Should be called on app startup and periodically.
 * 
 * @returns number of new transactions generated
 */
export const processAutoRentPayments = async (userId: string, userName: string): Promise<number> => {
  if (!isAutoRentEnabled()) return 0;
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // Only run once per day
  const lastRun = getLastRunDate();
  if (lastRun === todayStr) return 0;
  
  try {
    const contracts = await getContracts();
    const activeContracts = (contracts || []).filter((c: any) => c.status === 'Active' && c.autoPayment === true);
    const transactions = await getTransactions({ role: 'ADMIN' });
    
    let generated = 0;
    
    for (const contract of activeContracts) {
      const schedule = getInstallmentSchedule(contract);
      
      for (const installment of schedule) {
        // Check if this installment is due today or past due (within last 7 days)
        const dueDate = new Date(installment.date + 'T00:00:00');
        const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Only process if due today or up to 30 days ago (catch-up for missed days when app was offline)
        if (daysDiff < 0 || daysDiff > 30) continue;
        
        // Check if we already generated a transaction for this installment
        const alreadyExists = transactions.some((tx: any) => 
          tx.contractId === contract.id &&
          tx.details?.includes('Auto Rent Payment') &&
          tx.details?.includes(`Installment #${installment.installmentNo}`) &&
          tx.date === installment.date
        );
        
        if (alreadyExists) continue;
        
        // Generate auto payment transaction
        const transaction = {
          id: `auto-rent-${contract.id}-${installment.installmentNo}-${installment.date}`,
          date: installment.date,
          type: TransactionType.INCOME,
          amount: installment.amount,
          paymentMethod: PaymentMethod.BANK,
          buildingId: contract.buildingId,
          buildingName: contract.buildingName || '',
          unitNumber: contract.unitName || '',
          contractId: contract.id,
          status: TransactionStatus.PENDING,
          details: `🏦 Auto Rent Payment - Contract #${contract.contractNo || contract.id?.slice(0, 8)} | Installment #${installment.installmentNo} of ${contract.installmentCount} | Customer: ${contract.customerName || 'N/A'} | Pending bank confirmation`,
          createdAt: Date.now(),
          createdBy: userId,
          createdByName: `${userName} (Auto)`,
          isAutoPayment: true,
          expectedAmount: installment.amount,
          incomeSubType: 'RENTAL' as const,
        };
        
        try {
          await saveTransaction(transaction);
          generated++;
          addToLog({
            contractId: contract.id,
            contractNo: contract.contractNo,
            customerName: contract.customerName,
            buildingName: contract.buildingName,
            unitName: contract.unitName,
            amount: installment.amount,
            installmentNo: installment.installmentNo,
            date: installment.date,
            status: 'success',
          });
        } catch (e: any) {
          addToLog({
            contractId: contract.id,
            contractNo: contract.contractNo,
            amount: installment.amount,
            date: installment.date,
            status: 'error',
            error: e?.message || 'Unknown error',
          });
        }
      }
    }
    
    localStorage.setItem(LAST_RUN_KEY, todayStr);
    
    if (generated > 0) {
      addToLog({
        type: 'summary',
        date: todayStr,
        generated,
        message: `${generated} auto payment transaction(s) generated`,
      });
    }
    
    return generated;
  } catch (e) {
    console.error('Auto rent payment processing failed:', e);
    return 0;
  }
};
