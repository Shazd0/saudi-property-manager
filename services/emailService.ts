// Email Notification Service using EmailJS (free tier available)
// Configuration: Set up at https://www.emailjs.com/

const EMAILJS_SERVICE_ID = 'service_property_manager'; // Replace with your service ID
const EMAILJS_TEMPLATE_CUSTOMER = 'template_customer'; // Universal customer template
const EMAILJS_TEMPLATE_STAFF = 'template_staff'; // Staff report template
const EMAILJS_PUBLIC_KEY = 'ICEtQpgt7bzuyk166'; // Your public key
import { fmtDate } from '../utils/dateFormat';
import { getInstallmentStartDates } from '../utils/installmentSchedule';

export interface EmailParams {
  to_email: string;
  to_name: string;
  subject?: string;
  message?: string;
  [key: string]: any;
}

// Generic email sender using EmailJS
export const sendEmail = async (templateId: string, params: EmailParams): Promise<boolean> => {
  try {
    // Using EmailJS REST API
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: params,
      }),
    });
    
    if (response.ok) {
      console.log(`Email sent successfully to ${params.to_email}`);
      return true;
    } else {
      console.error('Email send failed:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('Email service error:', error);
    return false;
  }
};

// Send Rent Due Reminder
export const sendRentDueReminder = async (
  customerEmail: string,
  customerName: string,
  amount: number,
  dueDate: string,
  buildingName: string,
  unitName: string
): Promise<boolean> => {
  return sendEmail(EMAILJS_TEMPLATE_CUSTOMER, {
    to_email: customerEmail,
    to_name: customerName,
    email_type: 'RENT_DUE',
    title: '🔔 Rent Payment Reminder',
    subtitle: 'Your payment is due soon',
    amount: amount.toLocaleString(),
    building_name: buildingName,
    unit_name: unitName,
    date_label: 'Due Date',
    date_value: dueDate,
    message: 'Please ensure timely payment to avoid any late fees. If you have already made this payment, please disregard this reminder.',
    subject: `🔔 Rent Due Reminder - ${buildingName} Unit ${unitName}`
  });
};

// Send Payment Receipt
export const sendPaymentReceipt = async (
  customerEmail: string,
  customerName: string,
  amount: number,
  paymentDate: string,
  receiptNo: string,
  buildingName: string,
  unitName: string,
  paymentMethod: string
): Promise<boolean> => {
  return sendEmail(EMAILJS_TEMPLATE_CUSTOMER, {
    to_email: customerEmail,
    to_name: customerName,
    email_type: 'RECEIPT',
    title: '✅ Payment Received',
    subtitle: `Receipt #${receiptNo}`,
    amount: amount.toLocaleString(),
    building_name: buildingName,
    unit_name: unitName,
    date_label: 'Payment Date',
    date_value: paymentDate,
    extra_label: 'Payment Method',
    extra_value: paymentMethod,
    message: 'Thank you for your payment! This email serves as your official payment receipt. Please keep it for your records.',
    subject: `✅ Payment Receipt #${receiptNo} - ${buildingName}`
  });
};

// Send Contract Expiry Warning
export const sendContractExpiryWarning = async (
  customerEmail: string,
  customerName: string,
  contractNo: string,
  expiryDate: string,
  buildingName: string,
  unitName: string,
  daysRemaining: number
): Promise<boolean> => {
  return sendEmail(EMAILJS_TEMPLATE_CUSTOMER, {
    to_email: customerEmail,
    to_name: customerName,
    email_type: 'EXPIRY',
    title: '⚠️ Contract Expiring Soon',
    subtitle: `${daysRemaining} days remaining`,
    amount: daysRemaining.toString(),
    amount_label: 'DAYS LEFT',
    building_name: buildingName,
    unit_name: unitName,
    date_label: 'Expiry Date',
    date_value: expiryDate,
    extra_label: 'Contract #',
    extra_value: contractNo,
    message: 'Your rental contract is expiring soon. Please contact us to discuss renewal options and prepare required documents.',
    subject: `⚠️ Contract Expiring in ${daysRemaining} Days - Action Required`
  });
};

// Send Monthly Expiring Contracts Report to Staff
export const sendStaffMonthlyReport = async (
  staffEmail: string,
  staffName: string,
  buildingName: string,
  expiringContracts: Array<{
    contractNo: string;
    customerName: string;
    unitName: string;
    expiryDate: string;
    daysRemaining: number;
  }>
): Promise<boolean> => {
  const contractList = expiringContracts.map(c => 
    `• Contract #${c.contractNo} - ${c.customerName} (Unit ${c.unitName}) - Expires: ${c.expiryDate} (${c.daysRemaining} days)`
  ).join('\n');

  return sendEmail(EMAILJS_TEMPLATE_STAFF, {
    to_email: staffEmail,
    to_name: staffName,
    building_name: buildingName,
    contract_count: expiringContracts.length,
    contract_list: contractList,
    report_month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    subject: `📊 Monthly Report: ${expiringContracts.length} Contracts Expiring - ${buildingName}`
  });
};

// Queue notification for later sending (stored in Firestore)
export const queueNotification = async (
  type: 'RENT_DUE' | 'RECEIPT' | 'CONTRACT_EXPIRY' | 'STAFF_REPORT',
  recipientEmail: string,
  data: any,
  sendAt?: Date
): Promise<void> => {
  const { addDoc, collection } = await import('firebase/firestore');
  const { db } = await import('../firebase');
  
  const sanitize = (obj: any) => JSON.parse(JSON.stringify(obj));
  
  await addDoc(collection(db, 'notification_queue'), sanitize({
    type,
    recipientEmail,
    data,
    sendAt: sendAt?.toISOString() || new Date().toISOString(),
    status: 'PENDING',
    createdAt: Date.now(),
  }));
};

// Process pending notifications (call this from a scheduled function)
export const processPendingNotifications = async (): Promise<void> => {
  const { getDocs, collection, query, where, updateDoc, doc } = await import('firebase/firestore');
  const { db } = await import('../firebase');
  
  const q = query(
    collection(db, 'notification_queue'),
    where('status', '==', 'PENDING')
  );
  
  const snapshot = await getDocs(q);
  
  for (const docSnap of snapshot.docs) {
    const notification = docSnap.data();
    let success = false;
    
    try {
      switch (notification.type) {
        case 'RENT_DUE':
          success = await sendRentDueReminder(
            notification.recipientEmail,
            notification.data.customerName,
            notification.data.amount,
            notification.data.dueDate,
            notification.data.buildingName,
            notification.data.unitName
          );
          break;
        case 'RECEIPT':
          success = await sendPaymentReceipt(
            notification.recipientEmail,
            notification.data.customerName,
            notification.data.amount,
            notification.data.paymentDate,
            notification.data.receiptNo,
            notification.data.buildingName,
            notification.data.unitName,
            notification.data.paymentMethod
          );
          break;
        case 'CONTRACT_EXPIRY':
          success = await sendContractExpiryWarning(
            notification.recipientEmail,
            notification.data.customerName,
            notification.data.contractNo,
            notification.data.expiryDate,
            notification.data.buildingName,
            notification.data.unitName,
            notification.data.daysRemaining
          );
          break;
      }
      
      await updateDoc(doc(db, 'notification_queue', docSnap.id), {
        status: success ? 'SENT' : 'FAILED',
        processedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to process notification:', error);
      await updateDoc(doc(db, 'notification_queue', docSnap.id), {
        status: 'FAILED',
        error: String(error),
        processedAt: Date.now(),
      });
    }
  }
};

// Check and send rent due reminders (call daily)
export const checkAndSendRentReminders = async (): Promise<number> => {
  const { getContracts, getCustomers, getBuildings } = await import('../services/firestoreService');
  
  const contracts = await getContracts();
  const customers = await getCustomers();
  const buildings = await getBuildings();
  
  const today = new Date();
  let sentCount = 0;
  
  const getInstallmentDueDates = (contract: any): Date[] =>
    getInstallmentStartDates({
      fromDate: contract.fromDate,
      toDate: contract.toDate,
      periodMonths: Number(contract.periodMonths) || 0,
      periodDays: Number(contract.periodDays) || 0,
      installmentCount: Number(contract.installmentCount) || 1,
    });

  for (const contract of contracts.filter(c => c.status === 'Active')) {
    const customer = customers.find(c => c.id === contract.customerId);
    const building = buildings.find(b => b.id === contract.buildingId);
    
    if (!customer?.email || !customer.emailNotifications) continue;
    
    const installmentCount = contract.installmentCount || 1;
    const dueDates = getInstallmentDueDates(contract);
    const upfrontPaid = Number((contract as any).upfrontPaid || 0);
    const totalValueStored = Number(contract.totalValue || 0);

    // Reconstruct original installment amounts (before upfront reduction)
    const other = Number(contract.otherInstallment || 0);
    let first = Number(contract.firstInstallment || 0) + upfrontPaid;
    const effectiveTotal = totalValueStored + upfrontPaid;
    const sumInstallments = first + (other * Math.max(0, installmentCount - 1));
    if (effectiveTotal > 0 && Math.abs(sumInstallments - effectiveTotal) > Math.max(5, installmentCount)) {
      first = Math.max(0, effectiveTotal - (other * Math.max(0, installmentCount - 1)));
    }
    
    for (let i = 0; i < installmentCount; i++) {
      const dueDate = dueDates[i] || new Date();
      
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Send reminder 7 days before and 1 day before
      if (daysUntilDue === 7 || daysUntilDue === 1) {
        const installmentAmount = i === 0 ? first : other;
        if (installmentAmount <= 0) continue;
        
        await queueNotification('RENT_DUE', customer.email, {
          customerName: customer.nameEn || customer.nameAr,
          amount: installmentAmount,
          dueDate: fmtDate(dueDate),
          buildingName: building?.name || contract.buildingName,
          unitName: contract.unitName,
        });
        
        sentCount++;
      }
    }
  }
  
  return sentCount;
};

// Send monthly expiring contracts report to building staff
export const sendMonthlyExpiryReports = async (): Promise<number> => {
  const { getContracts, getBuildings, getUsers } = await import('../services/firestoreService');
  
  const contracts = await getContracts();
  const buildings = await getBuildings();
  const users = await getUsers();
  
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  let reportsSent = 0;
  
  // Group expiring contracts by building
  const expiringByBuilding: Record<string, typeof contracts> = {};
  
  for (const contract of contracts.filter(c => c.status === 'Active')) {
    const expiryDate = new Date(contract.toDate);
    if (expiryDate <= endOfMonth) {
      const buildingId = contract.buildingId;
      if (!expiringByBuilding[buildingId]) expiringByBuilding[buildingId] = [];
      expiringByBuilding[buildingId].push(contract);
    }
  }
  
  // Send report to staff assigned to each building
  for (const [buildingId, expiringContracts] of Object.entries(expiringByBuilding)) {
    const building = buildings.find(b => b.id === buildingId);
    const assignedStaff = users.filter(u => u.buildingId === buildingId && u.email);
    
    for (const staff of assignedStaff) {
      if (!staff.email) continue;
      
      const contractData = expiringContracts.map(c => ({
        contractNo: c.contractNo,
        customerName: c.customerName,
        unitName: c.unitName,
        expiryDate: fmtDate(c.toDate),
        daysRemaining: Math.ceil((new Date(c.toDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      }));
      
      await sendStaffMonthlyReport(
        staff.email,
        staff.name,
        building?.name || 'Unknown Building',
        contractData
      );
      
      reportsSent++;
    }
  }
  
  return reportsSent;
};
