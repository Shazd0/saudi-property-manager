export enum UserRole {
  ADMIN = 'ADMIN',
  ENGINEER = 'ENGINEER',
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  OWNER = 'OWNER'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  password?: string;
  email?: string;
  photoURL?: string; // Profile photo URL
  joinedDate?: string;
  status?: 'Active' | 'Inactive';
  baseSalary?: number;
  buildingId?: string; // legacy single-building assignment for compatibility
  buildingIds?: string[]; // allow assigning multiple buildings
  hasSystemAccess?: boolean; // NEW: Does this employee log in?
  iqamaNo?: string; // Iqama / Residence Permit number
  iqamaExpiry?: string; // Iqama expiry date (YYYY-MM-DD)
  // Owner-specific fields
  isOwner?: boolean; // Flag to identify property owners
  sharePercentage?: number; // Owner's profit share (0-100)
  ownerBuildingIds?: string[]; // Buildings this owner has stake in
  phone?: string; // Contact phone
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  INFO = 'INFO'
}

export enum ExpenseCategory {
  GENERAL = 'General Expense',
  HEAD = 'Head Office',
  SALARY = 'Salary',
  BORROWING = 'Borrowing',
  OWNER_EXPENSE = 'Owner Expense',
  MAINTENANCE = 'Maintenance',
  UTILITIES = 'Utilities',
  VENDOR_PAYMENT = 'Vendor Payment',
  PROPERTY_RENT = 'Property Rent',
  SERVICE_AGREEMENT = 'Service Agreement'
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK = 'BANK',
  CHEQUE = 'CHEQUE' // Added Cheque
}

export enum TransactionStatus {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED'
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  paymentMethod: PaymentMethod;
  bankName?: string;
  fromBankName?: string; // Source bank for BANK/CHEQUE transfers (treasury-linked)
  toBankName?: string;   // Destination bank for BANK/CHEQUE transfers (treasury-linked)
  originalPaymentMethod?: string; // User-chosen method when stored as 'TREASURY' internally
  chequeNo?: string; // Added
  chequeDueDate?: string; // Added
  
  // Income specific
  buildingId?: string;
  buildingName?: string;
  unitNumber?: string;
  contractId?: string;
  expectedAmount?: number; // For tracking debt
  vatAmount?: number;
  totalWithVat?: number;
  
  // VAT fields
  isVATApplicable?: boolean;
  vatInvoiceNumber?: string;
  amountExcludingVAT?: number;
  amountIncludingVAT?: number;
  vatRate?: number; // Typically 15% for KSA
  vendorVATNumber?: string;
  customerVATNumber?: string; // For income transactions
  zatcaQRCode?: string; // ZATCA QR code for invoice
  isCreditNote?: boolean; // True if this is a credit note (cancellation)
  originalInvoiceId?: string; // Reference to original invoice if credit note
  
  // Expense specific
  expenseCategory?: string;
  expenseSubCategory?: string;
  employeeId?: string; // For Salary
  employeeName?: string;
  ownerId?: string;
  ownerName?: string;
  bonusAmount?: number;
  deductionAmount?: number;
  borrowDeductionAmount?: number; // Borrow deduction from salary (separate from repayment tx)
  vendorId?: string;
  vendorName?: string;
  isRecurring?: boolean; // New feature
  salaryPeriod?: string;

  // Income sub-type
  incomeSubType?: 'RENTAL' | 'OTHER'; // RENTAL = building/unit income, OTHER = miscellaneous

  // Borrowing tracking
  borrowingType?: 'BORROW' | 'REPAYMENT' | 'OPENING_BALANCE'; // Sub-type when expenseCategory is Borrowing
  isExternalBorrower?: boolean; // True when borrower is not a company staff
  linkedBorrowingId?: string; // For repayments: links back to original borrowing tx
  
  // Owner opening balance (from previous system)
  isOwnerOpeningBalance?: boolean; // True if this is an owner opening balance entry

  // Service Agreement link
  serviceAgreementId?: string; // Links to ServiceAgreement for tracking payments
  serviceAgreementStartDate?: string; // Agreement period start
  serviceAgreementEndDate?: string; // Agreement period end
  serviceAgreementName?: string; // Agreement/vendor name for display
  installmentStartDate?: string; // Current installment period start
  installmentEndDate?: string; // Current installment period end
  installmentNumber?: number; // Current installment number

  // Adjustments & Approval
  discountAmount?: number;
  extraAmount?: number;
  status?: TransactionStatus;
  isAutoPayment?: boolean; // True if auto-generated from contract auto-payment

  // VAT Report only — transactions imported from PDF that should ONLY appear in the VAT Report tab
  vatReportOnly?: boolean;

  details: string;
  createdAt: number;
  createdBy: string; // User ID
  createdByName: string;
  lastModifiedAt?: number;
  electricityMeter?: string;
}

export interface Customer {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nationality: string;
  workAddress: string;
  idNo: string;
  idSource: string;
  idType: string;
  mobileNo: string;
  email?: string; // NEW: Email for notifications
  emailNotifications?: boolean; // NEW: Opt-in for email notifications
  smsNotifications?: boolean; // NEW: Opt-in for SMS notifications
  vatNumber?: string; // Optional VAT Number
  isVatRegistered?: boolean; // VAT registered customer
  crNumber?: string; // Commercial Registration number
  nationalAddress?: {
    buildingNo?: string;
    streetName?: string;
    district?: string;
    city?: string;
    postalCode?: string;
    additionalNo?: string;
  };
  isBlacklisted: boolean;
  rating?: number;
  notes?: string;
  carPlates?: string[]; // NEW: Vehicle Registry
   roomNumber?: string;
}

export interface Contract {
  id: string;
  contractNo: string;
  contractDate: string;
  status: 'Active' | 'Expired' | 'Terminated' | (string & {});
  
  buildingId: string;
  buildingName: string;
  unitName: string;
  
  customerId: string;
  customerName: string;
  
  // Financials
  rentValue: number; // Yearly Total
  waterFee: number;
  internetFee: number;
  insuranceFee: number;
  serviceFee: number;
  officePercent: number; // e.g. 2.5
  officeFeeAmount: number; // Calculated
  otherDeduction: number;
  otherAmount: number;
  upfrontPaid?: number;
  
  totalValue: number;
  
  // Installments
  installmentCount: number;
  firstInstallment: number;
  otherInstallment: number;
  
  // Schedule
  periodMonths: number;
  periodDays?: number;
  fromDate: string;
  toDate: string;
  
  notes?: string;
  autoPayment?: boolean;
  createdBy: string;
  staffEditCount?: number;
  renewedFromId?: string; // Set on renewal contracts, points to the previous contract's id
  
  // NEW FIELDS
  parkingFee: number;
  managementFee: number;
  electricityMeter?: string;
}

export interface BuildingUnit {
    name: string;
    defaultRent: number;
    meterNumber?: string;
}

export interface BuildingLease {
    isLeased: boolean;
    leaseStartDate?: string; // YYYY-MM-DD
    leaseEndDate?: string;   // YYYY-MM-DD
    durationYears?: number;  // Lease duration in years
    yearlyRent?: number;     // Yearly rent amount
    monthlyRent?: number;    // Monthly rent amount
    totalRent?: number;      // Total contract rent (auto: yearlyRent × durationYears)
    givenAmount?: number;    // Deposit / advance paid (auto-calculated from transactions)
    landlordName?: string;   // Owner / landlord name
    installmentCount?: number; // Number of installments for payment schedule
    installmentGapMonths?: number; // Gap in months between installments
    notes?: string;
}

export interface Building {
    id: string;
    name: string;
    waterMeterNumber?: string;
    units: BuildingUnit[];
    bankName?: string; // Default bank account for building
    iban?: string; // IBAN for the building's bank account
    lease?: BuildingLease; // NEW: building lease tracking
    propertyType?: 'RESIDENTIAL' | 'NON_RESIDENTIAL'; // New: property type
    vatApplicable?: boolean; // New: VAT applicable for non-residential
}

export interface Bank {
    name: string;
    iban: string;
}

export interface Vendor {
    id: string;
    name: string;
    nameEn?: string; // English name
    serviceType: string;
  vatNo?: string;
    vatNumber?: string; // Alternative field for VAT number
    contactName?: string;
    mobileNo?: string;
    phone: string;
    email?: string;
    contractStartDate?: string;
    status?: 'Active' | 'Inactive';
    notes?: string;
    rating?: number;
}

export interface ServiceAgreement {
    id: string;
    name: string;
    vendorName: string;
    vendorId?: string;
    agreementType: string; // e.g., 'Lift Maintenance', 'Fire Safety', 'Cleaning', 'Security', etc.
    buildingId?: string;
    buildingName?: string;
    startDate: string;
    endDate: string;
    durationMonths?: number; // Contract duration in months
    amount: number;
    paymentFrequency: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | 'One-Time';
    contactPerson?: string;
    contactPhone?: string;
    payments?: { date: string; amount: number; notes?: string }[]; // Installment payments
    status: 'Active' | 'Expired' | 'Cancelled';
    notes?: string;
    attachments?: string[];
    previousAgreementId?: string; // Link to previous agreement if this is a renewal
    renewalHistory?: string[]; // Array of all previous agreement IDs in renewal chain
    createdAt?: number;
    updatedAt?: number;
}

export enum TaskStatus {
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    DONE = 'DONE'
}

export interface Task {
    id: string;
    userId: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';
    createdAt: number;
    dueDate?: string;
}

export interface SystemSettings {
    companyName: string;
    currency: string;
    darkMode: boolean;
    compactMode: boolean;
    expenseBudgetLimit: number;
    openingCashBalance?: number;
    openingBankBalance?: number;
    openingBalancesByBuilding?: Record<string, { cash: number; bank: number; date?: string }>;
    lastBackupDate?: string;
    whatsappTemplate?: string;
}

export interface AuditLog {
    id: string;
    action: string;
    details: string;
    userId: string;
    timestamp: number;
}

// ---- SADAD Bill Presentment ----
export interface SadadBill {
    id: string;
    billNumber: string;
    billerId: string;        // SADAD Biller ID
    contractId?: string;
    customerId: string;
    customerName: string;
    buildingId?: string;
    buildingName?: string;
    unitName?: string;
    amount: number;
    vatAmount?: number;
    totalAmount: number;
    dueDate: string;
    status: 'Pending' | 'Paid' | 'Overdue' | 'Cancelled';
    sadadReferenceNo?: string;
    paymentDate?: string;
    description: string;
    createdAt: number;
    createdBy: string;
}

// ---- Ejar Platform Integration ----
export interface EjarContract {
    id: string;
    contractId: string;       // Local contract ID
    ejarNumber: string;       // Ejar platform contract number
    registrationDate: string;
    status: 'Draft' | 'Registered' | 'Active' | 'Expired' | 'Terminated' | 'Pending';
    tenantIdNo: string;
    tenantName: string;
    landlordIdNo: string;
    landlordName: string;
    buildingId?: string;
    buildingName?: string;
    unitName?: string;
    rentAmount: number;
    startDate: string;
    endDate: string;
    paymentFrequency: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
    notes?: string;
    lastSyncDate?: string;
    createdAt: number;
}

// ---- Utilities Consumption Tracking ----
export type UtilityType = 'Electricity' | 'Water' | 'Gas';
export interface UtilityReading {
    id: string;
    buildingId: string;
    buildingName: string;
    unitName: string;
    utilityType: UtilityType;
    meterNumber?: string;
    previousReading: number;
    currentReading: number;
    consumption: number;     // currentReading - previousReading
    readingDate: string;
    previousReadingDate?: string;
    ratePerUnit?: number;
    totalCost?: number;
    isPaid?: boolean;
    notes?: string;
    createdAt: number;
    createdBy: string;
}

// ---- Security Deposit Management ----
export interface SecurityDeposit {
    id: string;
    contractId: string;
    contractNo?: string;
    customerId: string;
    customerName: string;
    buildingId: string;
    buildingName: string;
    unitName: string;
    depositAmount: number;
    depositDate: string;
    paymentMethod: PaymentMethod;
    status: 'Held' | 'Partially Refunded' | 'Fully Refunded' | 'Forfeited';
    deductions: SecurityDepositDeduction[];
    refundedAmount: number;
    refundDate?: string;
    refundMethod?: PaymentMethod;
    notes?: string;
    createdAt: number;
    createdBy: string;
}
export interface SecurityDepositDeduction {
    id: string;
    reason: string;
    amount: number;
    date: string;
    description?: string;
}

// ---- WhatsApp Business API Integration ----
export interface WhatsAppMessage {
    id: string;
    recipientPhone: string;
    recipientName: string;
    templateName: string;    // payment_reminder, receipt, contract_renewal, etc.
    messageType: 'payment_reminder' | 'receipt' | 'contract_renewal' | 'custom';
    variables: Record<string, string>; // Template variables
    status: 'Queued' | 'Sent' | 'Delivered' | 'Read' | 'Failed';
    errorMessage?: string;
    relatedId?: string;      // Contract or Transaction ID
    sentAt?: number;
    createdAt: number;
    createdBy: string;
}

export interface WhatsAppConfig {
    apiUrl: string;
    apiToken: string;
    phoneNumberId: string;
    businessAccountId: string;
    isEnabled: boolean;
    templates: WhatsAppTemplate[];
}

export interface WhatsAppTemplate {
    name: string;
    language: string;
    category: string;
    bodyText: string;
    variables: string[];
}

// ---- Bank Reconciliation ----
export interface BankStatement {
    id: string;
    bankName: string;
    accountNumber?: string;
    iban?: string;
    statementDate: string;
    transactionDate: string;
    description: string;
    referenceNo?: string;
    debit: number;
    credit: number;
    balance?: number;
    importBatchId?: string;
    createdAt: number;
}

export interface ReconciliationRecord {
    id: string;
    bankStatementId: string;
    transactionId?: string;    // Matched system transaction
    status: 'Matched' | 'Unmatched' | 'Disputed' | 'Ignored';
    matchType?: 'Auto' | 'Manual';
    matchConfidence?: number;  // 0-100 for auto-match
    notes?: string;
    reconciledBy?: string;
    reconciledAt?: number;
    createdAt: number;
}

// ---- Nafath Identity Verification ----
export interface NafathVerification {
    id: string;
    customerId: string;
    customerName: string;
    nationalId: string;
    requestId?: string;       // Nafath request ID
    verificationCode?: string;
    status: 'Pending' | 'Verified' | 'Rejected' | 'Expired';
    verifiedAt?: number;
    expiresAt?: number;
    responseData?: string;    // Nafath response (JSON string)
    createdAt: number;
    createdBy: string;
}

// ---- Municipality License (Baladiya) Tracking ----
export interface MunicipalityLicense {
    id: string;
    buildingId: string;
    buildingName: string;
    licenseNumber: string;
    licenseType: 'Building Permit' | 'Commercial License' | 'Safety Certificate' | 'Operating License' | 'Other';
    issueDate: string;
    expiryDate: string;
    issuingAuthority: string; // e.g. أمانة الرياض
    status: 'Active' | 'Expired' | 'Renewal Pending' | 'Suspended';
    renewalCost?: number;
    attachmentUrl?: string;
    notes?: string;
    reminderDays?: number;    // Days before expiry to alert
    createdAt: number;
    createdBy: string;
}

// ---- Civil Defense Compliance ----
export interface CivilDefenseRecord {
    id: string;
    buildingId: string;
    buildingName: string;
    certificateNumber?: string;
    inspectionType: 'Fire Safety' | 'Emergency Exits' | 'Fire Extinguishers' | 'Alarm System' | 'Sprinkler System' | 'Full Inspection' | 'Other';
    inspectionDate: string;
    nextInspectionDate?: string;
    expiryDate: string;
    status: 'Compliant' | 'Non-Compliant' | 'Pending Inspection' | 'Expired';
    inspector?: string;
    findings?: string;
    correctiveActions?: string;
    attachmentUrl?: string;
    notes?: string;
    reminderDays?: number;
    createdAt: number;
    createdBy: string;
}

// ---- Absher Notification Integration ----
export interface AbsherRecord {
    id: string;
    customerId: string;
    customerName: string;
    nationalId: string;
    iqamaNo?: string;
    buildingId?: string;
    buildingName?: string;
    unitName?: string;
    registrationType: 'Address Registration' | 'Address Update' | 'Tenant Departure';
    status: 'Pending' | 'Submitted' | 'Confirmed' | 'Rejected' | 'Expired';
    absherReferenceNo?: string;
    submissionDate?: string;
    confirmationDate?: string;
    expiryDate?: string;
    notes?: string;
    createdAt: number;
    createdBy: string;
}

export interface BugReport {
  id: string;
  userId: string;
  userName?: string;
  email?: string;
  description: string;
  pageUrl: string;
  elementSelector?: string;
  screenshotUrl?: string;
  createdAt: string;
  status: 'open' | 'resolved';
  adminNote?: string;
}
