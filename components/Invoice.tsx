import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Transaction, Customer, TransactionType } from '../types';
import { getTransactions, getCustomers, getSettings, getContracts } from '../services/firestoreService';
import { FileText, Printer, CheckCircle } from 'lucide-react';
import { useToast } from './Toast';
import { fmtDate } from '../utils/dateFormat';
import { formatNameWithRoom } from '../utils/customerDisplay';
import { useLanguage } from '../i18n';


// Centralized Company Constants (Fallbacks if Firestore settings are missing)
const DEFAULT_CO_NAME_AR = 'شركة ارار ميلينيوم المحدودة';
const DEFAULT_CO_NAME_EN = 'RR MILLENNIUM CO. LTD';
const DEFAULT_CO_VAT = '312610089400003';
const DEFAULT_CO_ADDR = 'Dammam, Saudi Arabia';

const Invoice: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { showError } = useToast();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const location = useLocation();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);

  // Load settings once
  useEffect(() => { getSettings().then(s => setInvoiceSettings(s || null)).catch(() => {}); }, []);

  useEffect(() => { loadInvoiceData(); }, [invoiceId]);

  useEffect(() => {
    if (location.search?.includes('pdf=1')) {
      setTimeout(() => window.print(), 500);
    }
  }, [location.search]);

  const loadInvoiceData = async () => {
    try {
      const txs = await getTransactions();
      const tx = txs.find(t => t.vatInvoiceNumber === invoiceId || t.id === invoiceId);
      if (tx) {
        setTransaction(tx);
        
        // Fetch customer info correctly
        const allCustomers = await getCustomers();
        if (tx.contractId) {
          // If transaction is linked to a contract, we might need to find the customer associated with that contract
          const allContracts = await getContracts();
          const contract = allContracts.find(c => c.id === tx.contractId);
          if (contract) {
            setCustomer(allCustomers.find(c => c.id === contract.customerId || (c.nameEn || c.nameAr) === contract.customerName) || null);
          }
        } else if (tx.customerVATNumber) {
          setCustomer(allCustomers.find(c => c.vatNumber === tx.customerVATNumber) || null);
        } else if (tx.customerId) {
          setCustomer(allCustomers.find(c => c.id === tx.customerId) || null);
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    if (!transaction) return;
    const printWindow = window.open('', 'INVOICE_PRINT', 'height=1200,width=900');
    if (!printWindow) { showError('Please allow popups to print.'); return; }

    const isExpense = transaction.type === TransactionType.EXPENSE;
    const isCredit = !!transaction.isCreditNote;

    const coNameAr  = invoiceSettings?.companyNameAr || invoiceSettings?.companyName || DEFAULT_CO_NAME_AR;
    const coNameEn  = invoiceSettings?.companyName || DEFAULT_CO_NAME_EN;
    const coVAT     = invoiceSettings?.companyVatNumber || DEFAULT_CO_VAT;
    const coAddr    = invoiceSettings?.address || DEFAULT_CO_ADDR;

    // Seller / Buyer - reverse for expense
    const sellerName    = isExpense ? (transaction.vendorName || 'Supplier') : coNameEn;
    const sellerNameAr  = isExpense ? '' : coNameAr;
    const sellerVAT     = isExpense ? (transaction.vendorVATNumber || '-') : coVAT;
    const sellerAddr    = isExpense ? '-' : coAddr;
    const buyerName     = isExpense ? coNameEn : (formatNameWithRoom(customer?.nameEn || customer?.nameAr || transaction.unitNumber || 'Tenant', customer?.roomNumber));
    const buyerVAT      = isExpense ? coVAT : (transaction.customerVATNumber || '-');
    const buyerAddr     = isExpense ? coAddr : '-';

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${transaction.vatInvoiceNumber}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;background:#fff;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{max-width:210mm;margin:0 auto;padding:14mm 16mm;position:relative;min-height:297mm}
    .cb{position:absolute;width:56px;height:56px;border-style:solid;border-color:#d1fae5}
    .cb-tl{top:6mm;left:6mm;border-width:2px 0 0 2px;border-radius:8px 0 0 0}
    .cb-tr{top:6mm;right:6mm;border-width:2px 2px 0 0;border-radius:0 8px 0 0}
    .cb-bl{bottom:6mm;left:6mm;border-width:0 0 2px 2px;border-radius:0 0 0 8px}
    .cb-br{bottom:6mm;right:6mm;border-width:0 2px 2px 0;border-radius:0 0 8px 0}
    .hdr{display:flex;justify-content:space-between;align-items:start;margin-bottom:28px;padding-top:6px}
    .hdr-co{display:flex;align-items:center;gap:18px}
    .hdr-logo{width:70px;height:70px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:10px}
    .hdr-logo img{max-width:100%;max-height:100%;object-fit:contain}
    .co-ar{font-family:'Tajawal',sans-serif;font-size:18px;font-weight:900;color:#064e3b;direction:rtl}
    .co-en{font-size:11px;font-weight:700;color:#047857;letter-spacing:.5px;margin-top:2px}
    .co-tag{font-size:10px;color:#6b7280;margin-top:3px}
    .badge{text-align:right}
    .badge-type{font-size:22px;font-weight:900;color:${isCredit ? '#dc2626' : '#064e3b'};letter-spacing:1.5px;text-transform:uppercase}
    .badge-cn{font-size:9px;color:#6b7280;margin-top:4px;letter-spacing:1.5px;text-transform:uppercase}
    .pills{display:flex;gap:10px;margin-bottom:20px}
    .pill{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;text-align:center}
    .pill.green{background:#f0fdf4;border-color:#bbf7d0}
    .pill-lbl{font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
    .pill-val{font-size:13px;font-weight:800;color:#0f172a}
    .party-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}
    .party-card{border-radius:10px;padding:14px;background:#fafffe;border:1px solid #d1fae5}
    .party-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#047857;margin-bottom:8px;padding-bottom:6px;border-bottom:1.5px solid #d1fae5}
    .party-name{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:2px}
    .party-ar{font-family:'Tajawal',sans-serif;font-size:13px;font-weight:700;color:#065f46;margin-bottom:4px;direction:rtl}
    .party-sub{font-size:11px;color:#64748b;margin-top:2px}
    .tbl{width:100%;border-collapse:collapse;margin-bottom:18px}
    .tbl thead tr{background:#f0fdf4}
    .tbl th{padding:11px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#047857;text-align:left;border-bottom:2px solid #bbf7d0}
    .tbl th:last-child{text-align:right}
    .tbl td{padding:16px 14px;font-size:13px;border-bottom:1px solid #f1f5f9;vertical-align:top}
    .tbl td:last-child{text-align:right;font-weight:700;color:#0f172a}
    .tbl-num{font-weight:700;color:#10b981;font-size:14px}
    .tbl-sub{font-size:10px;color:#94a3b8;margin-top:3px}
    .tots{display:flex;justify-content:flex-end;margin-top:6px}
    .tot-card{width:260px;background:#fafffe;border:2px solid #d1fae5;border-radius:12px;padding:16px}
    .tot-row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px;color:#64748b}
    .tot-row span:last-child{font-weight:700;color:#0f172a}
    .tot-total{display:flex;justify-content:space-between;border-top:1.5px solid #d1fae5;padding-top:10px;margin-top:10px;font-size:16px;font-weight:900;color:#064e3b}
    .tot-sar{font-size:10px;font-weight:600;opacity:.6;margin-left:2px}
    .ftr{display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;padding-top:18px;border-top:1px dashed #e2e8f0}
    .ftr-notes{font-size:10px;color:#94a3b8;line-height:1.7;max-width:55%}
    .ftr-notes b{color:#64748b}
    .qr-box{text-align:center}
    .qr-img{width:180px;height:180px;border:1.5px solid #d1fae5;padding:5px;border-radius:10px;background:#fff}
    .qr-lbl{font-size:8px;color:#047857;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px}
    @page{margin:0;size:A4}
  </style>
</head>
<body>
  <div class="page">
    <div class="hdr">
      <div class="hdr-co">
        <div class="hdr-logo"><img src="${window.location.origin}/images/cologo.png" onerror="this.style.display='none'"/></div>
        <div>
          <div class="co-ar">${coNameAr}</div>
          <div class="co-en">${coNameEn}</div>
          <div class="co-tag">${coAddr}${coVAT ? ' &nbsp;|&nbsp; VAT ' + coVAT : ''}</div>
        </div>
      </div>
      <div class="badge">
        <div class="badge-type">${isCredit ? 'Credit Note' : isExpense ? 'Purchase Invoice' : 'Tax Invoice'}</div>
        <div class="badge-cn">ZATCA Compliant</div>
      </div>
    </div>

    <div class="pills">
      <div class="pill green">
        <div class="pill-lbl">Invoice No.</div>
        <div class="pill-val">${transaction.vatInvoiceNumber || '-'}</div>
      </div>
      <div class="pill">
        <div class="pill-lbl">Issue Date</div>
        <div class="pill-val">${fmtDate(transaction.date)}</div>
      </div>
      <div class="pill">
        <div class="pill-lbl">Payment</div>
        <div class="pill-val">${transaction.paymentMethod || '-'}</div>
      </div>
    </div>

    <div class="party-grid">
      <div class="party-card">
        <div class="party-title">Supplier / Seller</div>
        ${sellerNameAr ? `<div class="party-ar">${sellerNameAr}</div>` : ''}
        <div class="party-name">${sellerName}</div>
        <div class="party-sub">VAT: ${sellerVAT}</div>
        <div class="party-sub">${sellerAddr}</div>
      </div>
      <div class="party-card">
        <div class="party-title">Customer / Buyer</div>
        <div class="party-name">${buyerName}</div>
        <div class="party-sub">VAT: ${buyerVAT}</div>
        <div class="party-sub">${buyerAddr}</div>
      </div>
    </div>

    <table class="tbl">
      <thead><tr><th>#</th><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        <tr>
          <td><span class="tbl-num">01</span></td>
          <td>
            <div style="font-weight:600">${transaction.details || (isExpense ? 'Purchase / Expense' : 'Property Rental Services')}</div>
            <div class="tbl-sub">${isExpense ? 'Expense' : 'Rental Income'}</div>
          </td>
          <td>${(transaction.amountExcludingVAT || transaction.amount || 0).toLocaleString()} SAR</td>
        </tr>
      </tbody>
    </table>

    <div class="tots">
      <div class="tot-card">
        <div class="tot-row"><span>Subtotal (Excl. VAT)</span><span>${(transaction.amountExcludingVAT || transaction.amount || 0).toLocaleString()}</span></div>
        <div class="tot-row"><span>VAT (${transaction.vatRate || 15}%)</span><span>${(transaction.vatAmount || 0).toLocaleString()}</span></div>
        <div class="tot-total"><span>Total (Incl. VAT)</span><span>${(transaction.amountIncludingVAT || transaction.totalWithVat || 0).toLocaleString()} <span class="tot-sar">SAR</span></span></div>
      </div>
    </div>

    <div class="ftr">
      <div class="ftr-notes">
        <div><b>Payment:</b> ${transaction.paymentMethod || 'Cash'}</div>
        <div style="margin-top:6px">Computer-generated document. No signature required.</div>
      </div>
      ${transaction.zatcaQRCode ? `
      <div class="qr-box">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=600x600&ecc=H&data=${encodeURIComponent(transaction.zatcaQRCode)}" class="qr-img"/>
        <div class="qr-lbl">ZATCA QR Code</div>
      </div>` : ''}
    </div>
  </div>
  <script>window.onload=function(){window.print()}</script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-pulse text-slate-400">Loading invoice...</div></div>;
  if (!transaction) return <div className="p-8 text-center text-slate-400">Invoice not found</div>;

  const isCredit = !!transaction.isCreditNote;
  const isExpense = transaction.type === TransactionType.EXPENSE;

  const coNameAr2  = invoiceSettings?.companyNameAr || invoiceSettings?.companyName || DEFAULT_CO_NAME_AR;
  const coNameEn2  = invoiceSettings?.companyName || DEFAULT_CO_NAME_EN;
  const coVAT2     = invoiceSettings?.companyVatNumber || DEFAULT_CO_VAT;
  const companyAddress = invoiceSettings?.address || DEFAULT_CO_ADDR;

  const sellerName   = isExpense ? (transaction.vendorName || 'Supplier') : coNameEn2;
  const sellerVAT    = isExpense ? (transaction.vendorVATNumber || '-') : coVAT2;
  const buyerName    = isExpense ? coNameEn2 : (formatNameWithRoom(customer?.nameEn || customer?.nameAr || transaction.unitNumber || 'Tenant', customer?.roomNumber));
  const buyerVAT     = isExpense ? coVAT2 : (transaction.customerVATNumber || '-');

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden relative">
          <div className="relative z-10 bg-gradient-to-r from-emerald-600 to-teal-500 p-6 flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl border border-white/30 flex items-center justify-center">
                <img src="/images/cologo.png" alt="Company Logo" className="w-11 h-11 object-contain" onError={e => (e.currentTarget.style.display='none')} />
              </div>
              <div>
                <div className="text-white font-black text-lg" dir="rtl" lang="ar" style={{fontFamily:"'Tajawal',sans-serif"}}>{coNameAr2}</div>
                <div className="text-emerald-100 text-xs font-semibold">{coNameEn2}</div>
                <div className="text-emerald-200/70 text-[10px] mt-1">{invoiceSettings?.address || companyAddress}{coVAT2 ? ' | VAT ' + coVAT2 : ''}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-black ${isCredit ? 'text-red-200' : 'text-white'}`}>
                {isCredit ? 'CREDIT NOTE' : isExpense ? 'PURCHASE INV.' : 'TAX INVOICE'}
              </div>
              <div className="text-[10px] text-emerald-100 tracking-widest mt-1">ZATCA COMPLIANT</div>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-slate-50 border-b border-slate-100 font-inter">
            <div className="rounded-xl p-3 text-center bg-emerald-50 border border-emerald-200">
               <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Invoice No.</div>
               <div className="text-sm font-black mt-1 text-emerald-800">{transaction.vatInvoiceNumber || '-'}</div>
            </div>
            <div className="rounded-xl p-3 text-center bg-white border border-slate-200">
               <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Date</div>
               <div className="text-sm font-black mt-1 text-slate-700">{fmtDate(transaction.date)}</div>
            </div>
            <div className="rounded-xl p-3 text-center bg-white border border-slate-200">
               <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Payment</div>
               <div className="text-sm font-black mt-1 text-slate-700">{transaction.paymentMethod || '-'}</div>
            </div>
            {transaction.buildingName && (
              <div className="rounded-xl p-3 text-center bg-white border border-slate-200">
                 <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Property</div>
                 <div className="text-sm font-black mt-1 text-slate-700">{transaction.buildingName}{transaction.unitNumber ? ' | ' + transaction.unitNumber : ''}</div>
              </div>
            )}
          </div>

          <div className="relative z-10 p-5 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`rounded-xl p-4 border ${isExpense ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className={`text-[9px] font-bold uppercase tracking-wider mb-3 pb-2 border-b ${isExpense ? 'text-amber-700 border-amber-200' : 'text-emerald-700 border-emerald-200'}`}>
                  Supplier / Seller
                </div>
                <div className="font-bold text-slate-800">{sellerName}</div>
                {!isExpense && <div className="text-sm text-slate-600 mt-0.5" dir="rtl" lang="ar" style={{fontFamily:"'Tajawal',sans-serif"}}>{coNameAr2}</div>}
                <div className="text-xs text-slate-500 mt-1">VAT: {sellerVAT}</div>
                {!isExpense && <div className="text-xs text-slate-500">{invoiceSettings?.address || companyAddress}</div>}
              </div>
              <div className="rounded-xl p-4 border bg-sky-50 border-sky-200">
                <div className="text-[9px] font-bold uppercase tracking-wider text-sky-700 mb-3 pb-2 border-b border-sky-200">
                  Customer / Buyer
                </div>
                <div className="font-bold text-slate-800">{buyerName}</div>
                {isExpense && <div className="text-sm text-slate-600 mt-0.5" dir="rtl" lang="ar" style={{fontFamily:"'Tajawal',sans-serif"}}>{coNameAr2}</div>}
                <div className="text-xs text-slate-500 mt-1">VAT: {buyerVAT}</div>
                {transaction.electricityMeter && <div className="text-[10px] text-emerald-600 font-bold mt-2 pt-2 border-t border-emerald-100 flex items-center gap-1">⚡ Meter: {transaction.electricityMeter}</div>}
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200">
              <div className="grid grid-cols-[auto_1fr_auto] text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200 py-3 px-4 gap-4">
                <span>#</span><span>Description</span><span className="text-right">Amount</span>
              </div>
              <div className="grid grid-cols-[auto_1fr_auto] gap-4 py-4 px-4">
                <span className="text-emerald-500 font-bold text-lg">01</span>
                <div>
                  <div className="font-semibold text-slate-700">{transaction.details || (isExpense ? 'Purchase / Expense' : 'Property Rental Services')}</div>
                </div>
                <div className="text-right font-bold text-slate-700">{(transaction.amountExcludingVAT || transaction.amount || 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-xs border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex justify-between px-4 py-3 text-sm text-slate-500 bg-white border-b border-slate-100">
                  <span>Subtotal (Excl. VAT)</span>
                  <span className="font-semibold text-slate-700">{(transaction.amountExcludingVAT || transaction.amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between px-4 py-3 text-sm text-slate-500 bg-white border-b border-slate-100">
                  <span>VAT ({transaction.vatRate || 15}%)</span>
                  <span className="font-semibold text-slate-700">{(transaction.vatAmount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between px-4 py-4 bg-emerald-600 text-white font-black text-lg font-inter">
                  <span>Total</span>
                  <span>{(transaction.amountIncludingVAT || transaction.totalWithVat || 0).toLocaleString()} <span className="text-sm font-normal opacity-70">SAR</span></span>
                </div>
              </div>
            </div>

            {transaction.zatcaQRCode && (
              <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&ecc=H&data=${encodeURIComponent(transaction.zatcaQRCode)}`} className="w-28 h-28 rounded-lg border border-emerald-200" alt="ZATCA QR" />
                <div>
                  <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-1">ZATCA QR Code</div>
                  <div className="text-xs text-slate-500">Verified and Reported to ZATCA</div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-400">Computer-generated document. No signature required.</div>
              <div className="flex items-center gap-2 opacity-40">
                <img src="/images/logo.png" className="h-4" alt="Amlak" onError={e => (e.currentTarget.style.display='none')} />
                <span className="text-[9px] text-slate-400 uppercase tracking-wider">Powered by Amlak</span>
              </div>
            </div>
          </div>
        </div>

        {/* Print action */}
        <div className="mt-4 flex flex-col items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
          >
            <Printer size={18}/> Print Official Invoice
          </button>
          {transaction.isVATApplicable && !transaction.zatcaQRCode && (
            <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
              <FileText size={15}/>
              Go to <strong className="mx-1">{t('nav.vatReport')}</strong> tab and click "Send to ZATCA" to report this invoice.
            </div>
          )}
          {transaction.zatcaQRCode && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
              <CheckCircle size={14}/> Reported to ZATCA Production
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Invoice;
