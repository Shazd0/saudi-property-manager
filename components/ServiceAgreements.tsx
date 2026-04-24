import React, { useState, useEffect } from 'react';
import { ServiceAgreement, TransactionType, TransactionStatus, PaymentMethod } from '../types';
import { getServiceAgreements, saveServiceAgreement, deleteServiceAgreement, getVendors, getBuildings, saveTransaction } from '../services/firestoreService';
import { FileText, Plus, Trash2, Search, Edit2, Calendar, AlertTriangle, Printer, DollarSign, X } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import SoundService from '../services/soundService';
import { fmtDate, fmtDateTime } from '../utils/dateFormat';
import { useLanguage } from '../i18n';

const AGREEMENT_TYPES = [
  'Lift Maintenance',
  'Fire Safety',
  'Cleaning Service',
  'Security Service',
  'HVAC Maintenance',
  'Pest Control',
  'Water Tank Cleaning',
  'Electrical Maintenance',
  'Plumbing Service',
  'Garbage Collection',
  'Internet/WiFi',
  'Other'
];

const PAYMENT_FREQUENCIES = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'One-Time'];

const ServiceAgreements: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const { showError, showSuccess } = useToast();
  const [agreements, setAgreements] = useState<ServiceAgreement[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAgreement, setPaymentAgreement] = useState<ServiceAgreement | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRenewalMode, setIsRenewalMode] = useState(false);
  const [formData, setFormData] = useState<ServiceAgreement>({
    id: '',
    name: '',
    vendorName: '',
    vendorId: '',
    agreementType: '',
    buildingId: '',
    buildingName: '',
    startDate: '',
    endDate: '',
    durationMonths: 12,
    amount: 0,
    paymentFrequency: 'Yearly',
    contactPerson: '',
    contactPhone: '',
    status: 'Active',
    notes: ''
  });
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('Confirm');
  const [confirmDanger, setConfirmDanger] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);

  const openConfirm = (message: string, onConfirm: () => void, opts?: { title?: string; danger?: boolean }) => {
    setConfirmTitle(opts?.title || 'Confirm');
    setConfirmDanger(!!opts?.danger);
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setConfirmOpen(true);
  };
  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmMessage('');
    setConfirmAction(null);
  };

  const getFullAgreementHistory = (agreement: ServiceAgreement): ServiceAgreement[] => {
    const history: ServiceAgreement[] = [agreement];
    const allAgreements = agreements;
    let currentAgreement = agreement;
    
    // Follow the chain backwards to get all previous renewals
    while (currentAgreement.previousAgreementId) {
      const prevAgreement = allAgreements.find(a => a.id === currentAgreement.previousAgreementId);
      if (prevAgreement) {
        history.unshift(prevAgreement);
        currentAgreement = prevAgreement;
      } else {
        break;
      }
    }
    
    return history;
  };

  const getAggregatedPayments = (agreementHistory: ServiceAgreement[]): Array<{date: string; amount: number; notes?: string}> => {
    const aggregated: Array<{date: string; amount: number; notes?: string}> = [];
    for (const agr of agreementHistory) {
      if (agr.payments) {
        aggregated.push(...agr.payments);
      }
    }
    return aggregated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const handleOpenPaymentModal = async (agreement: ServiceAgreement) => {
    setPaymentAgreement(agreement);
    setPaymentModalOpen(true);
  };

  useEffect(() => {
    const load = async () => {
      const [agr, vnd, bld] = await Promise.all([
        getServiceAgreements(),
        getVendors(),
        getBuildings()
      ]);
      setAgreements(agr || []);
      setVendors(vnd || []);
      setBuildings(bld || []);
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    
    if (!formData.name.trim()) {
      showError('Agreement name is required');
      return;
    }
    if (!formData.vendorName.trim()) {
      showError('Vendor/Company name is required');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      showError('Start date and end date are required');
      return;
    }
    
    const isNewAgreement = !formData.id;
    const isRenewal = !isNewAgreement && formData.startDate !== (agreements.find(a => a.id === formData.id)?.startDate || '');
    
    let renewalHistory: string[] = formData.renewalHistory || [];
    let previousAgreementId = formData.previousAgreementId;
    
    // If this is a renewal of an existing agreement, track the history
    if (isRenewal) {
      if (!renewalHistory.includes(formData.id!)) {
        renewalHistory = [formData.id!, ...renewalHistory];
      }
      previousAgreementId = formData.id;
    }
    
    const newAgreement: ServiceAgreement = {
      ...formData,
      id: isNewAgreement ? crypto.randomUUID() : formData.id,
      previousAgreementId: isRenewal ? previousAgreementId : undefined,
      renewalHistory: isRenewal ? renewalHistory : undefined,
      createdAt: formData.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    
    await saveServiceAgreement(newAgreement);
    setAgreements(await getServiceAgreements());
    setIsFormOpen(false);
    resetForm();
    showSuccess(`Service agreement ${isRenewal ? 'renewed' : 'saved'}.`);
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      vendorName: '',
      vendorId: '',
      agreementType: '',
      buildingId: '',
      buildingName: '',
      startDate: '',
      endDate: '',
      durationMonths: 12,
      amount: 0,
      paymentFrequency: 'Yearly',
      contactPerson: '',
      contactPhone: '',
      status: 'Active',
      notes: ''
    });
    setIsRenewalMode(false);
  };

  const handleEdit = (agreement: ServiceAgreement) => {
    setFormData(agreement);
    setIsRenewalMode(true);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    const agreement = agreements.find(a => a.id === id);
    
    // Check if agreement has payments
    if (agreement?.payments && agreement.payments.length > 0) {
      showError(`Cannot delete contract with ${agreement.payments.length} installment payment(s).`);
      return;
    }
    
    openConfirm('Delete this service agreement? This action cannot be undone.', async () => {
      try {
        await deleteServiceAgreement(id);
        setAgreements(await getServiceAgreements());
        showSuccess('Agreement deleted.');
      } catch (error) {
        console.error('Delete error:', error);
        showError('Failed to delete agreement.');
      }
      closeConfirm();
    }, { title: 'Delete Agreement', danger: true });
  };

  const handleRevertToPrevious = async (id: string) => {
    const currentAgreement = agreements.find(a => a.id === id);
    if (!currentAgreement || !currentAgreement.previousAgreementId) {
      showError('No previous agreement to revert to.');
      return;
    }

    const previousAgreement = agreements.find(a => a.id === currentAgreement.previousAgreementId);
    if (!previousAgreement) {
      showError('Previous agreement not found.');
      return;
    }

    openConfirm(
      `Revert to the previous agreement "${previousAgreement.name}" (${previousAgreement.startDate} - ${previousAgreement.endDate})? The current renewed agreement will be marked as cancelled.`,
      async () => {
        try {
          // Mark current (renewed) agreement as cancelled
          const cancelledAgreement: ServiceAgreement = {
            ...currentAgreement,
            status: 'Cancelled',
            updatedAt: Date.now()
          };
          
          // Restore previous agreement as active
          const revertedAgreement: ServiceAgreement = {
            ...previousAgreement,
            status: previousAgreement.status === 'Cancelled' ? 'Active' : previousAgreement.status,
            previousAgreementId: undefined,
            renewalHistory: undefined,
            updatedAt: Date.now()
          };

          await Promise.all([
            saveServiceAgreement(cancelledAgreement),
            saveServiceAgreement(revertedAgreement)
          ]);
          
          setAgreements(await getServiceAgreements());
          showSuccess(`Reverted to previous agreement "${previousAgreement.name}".`);
        } catch (error) {
          console.error('Revert error:', error);
          showError('Failed to revert to previous agreement.');
        }
        closeConfirm();
      },
      { title: 'Revert to Previous Agreement', danger: true }
    );
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const filteredAgreements = agreements.filter(a => {
    const matchSearch = !searchTerm || 
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.buildingName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = !filterType || a.agreementType === filterType;
    const matchStatus = !filterStatus || a.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  }).sort((a, b) => {
    const daysA = getDaysRemaining(a.endDate);
    const daysB = getDaysRemaining(b.endDate);
    return daysA - daysB;
  });

  const handleExportPDF = () => {
    const title = 'Service Agreements Report';
    const rowsHtml = filteredAgreements.map(a => {
      const daysRemaining = getDaysRemaining(a.endDate);
      const statusStyle = daysRemaining < 0 ? 'color:#dc2626;font-weight:bold' : daysRemaining <= 30 ? 'color:#d97706' : '';
      return `<tr>
        <td style="padding:10px;border:1px solid #e6e6e6">${a.name}</td>
        <td style="padding:10px;border:1px solid #e6e6e6">${a.vendorName}</td>
        <td style="padding:10px;border:1px solid #e6e6e6">${a.agreementType}</td>
        <td style="padding:10px;border:1px solid #e6e6e6">${a.buildingName || 'All'}</td>
        <td style="padding:10px;border:1px solid #e6e6e6">${fmtDate(a.startDate)}</td>
        <td style="padding:10px;border:1px solid #e6e6e6">${fmtDate(a.endDate)}</td>
        <td style="padding:10px;border:1px solid #e6e6e6;text-align:right;font-weight:bold">${Number(a.amount).toLocaleString()} SAR</td>
        <td style="padding:10px;border:1px solid #e6e6e6">${a.paymentFrequency}</td>
        <td style="padding:10px;border:1px solid #e6e6e6">${a.status}</td>
        <td style="padding:10px;border:1px solid #e6e6e6;${statusStyle}">${daysRemaining < 0 ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days left`}</td>
      </tr>`;
    }).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
      <style>
        body{font-family:Inter, Arial, sans-serif;color:#0f172a;padding:24px;font-size:14px}
        table{width:100%;border-collapse:collapse}
        th{background:#f8fafc;padding:10px;border:1px solid #e6e6e6;text-align:left;font-size:14px}
        td{padding:10px;border:1px solid #eef2f7;font-size:14px}
      </style>
    </head><body>
      <h2>${title}</h2>
      <div>Generated: ${fmtDateTime(new Date())}</div>
      <table>
        <thead><tr><th>Agreement</th><th>${t('entry.vendor')}</th><th>${t('history.type')}</th><th>${t('entry.building')}</th><th>Start</th><th>End</th><th style="text-align:right">${t('common.amount')}</th><th>Frequency</th><th>${t('common.status')}</th><th>${t('contract.days')}</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <script>window.onload = () => setTimeout(()=>window.print(),300);</script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  // Calculate expiring soon count
  const expiringSoon = agreements.filter(a => {
    const days = getDaysRemaining(a.endDate);
    return days >= 0 && days <= 30 && a.status === 'Active';
  }).length;

  const expired = agreements.filter(a => getDaysRemaining(a.endDate) < 0 && a.status === 'Active').length;

  return (
    <div className="px-3 sm:px-6 pt-2 animate-fade-in">
      <div className="premium-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="text-emerald-600" /> {t('service.title')}
            </h2>
            <p className="text-sm text-slate-500 mt-1">{t('service.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            {filteredAgreements.length > 0 && (
              <button onClick={handleExportPDF} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl flex items-center gap-2 hover:bg-slate-200">
                <Printer size={18} />{t('history.exportPdf')}</button>
            )}
            <button onClick={() => { resetForm(); setIsFormOpen(true); }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl flex items-center gap-2 hover:bg-emerald-700">
              <Plus size={18} /> {t('service.addAgreement')}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="ios-card p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{agreements.filter(a => a.status === 'Active').length}</div>
            <div className="text-sm text-slate-500">{t('common.active')}</div>
          </div>
          <div className="ios-card p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{expiringSoon}</div>
            <div className="text-sm text-slate-500">{t('owner.contractsExpiring')}</div>
          </div>
          <div className="ios-card p-4 text-center">
            <div className="text-2xl font-bold text-rose-600">{expired}</div>
            <div className="text-sm text-slate-500">{t('contract.statusExpired')}</div>
          </div>
          <div className="ios-card p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{agreements.reduce((sum, a) => sum + (a.status === 'Active' ? Number(a.amount) : 0), 0).toLocaleString()}</div>
            <div className="text-sm text-slate-500">{t('service.totalValue')}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={t('service.searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm"
            />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border rounded-xl text-sm">
            <option value="">{t('history.allTypes')}</option>
            {AGREEMENT_TYPES.map(tx => <option key={tx} value={tx}>{tx}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-xl text-sm">
            <option value="">{t('history.allStatus')}</option>
            <option value="Active">{t('common.active')}</option>
            <option value="Expired">{t('contract.statusExpired')}</option>
            <option value="Cancelled">{t('service.cancelled')}</option>
          </select>
        </div>

        {/* Agreements List */}
        {filteredAgreements.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FileText size={48} className="mx-auto mb-4 opacity-30" />
            <p>{t('service.noAgreements')}</p>
            <button onClick={() => { resetForm(); setIsFormOpen(true); }} className="mt-4 text-emerald-600 hover:underline">{t('service.addFirst')}</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAgreements.map(a => {
              const daysRemaining = getDaysRemaining(a.endDate);
              const isExpired = daysRemaining < 0;
              const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 30;
              
              return (
                <div key={a.id} className={`ios-card p-4 ${isExpired ? 'border-l-4 border-l-rose-500' : isExpiringSoon ? 'border-l-4 border-l-amber-500' : ''}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800">{a.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${a.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : a.status === 'Expired' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                          {a.status}
                        </span>
                        {isExpired && <span className="px-2 py-0.5 text-xs rounded-full bg-rose-100 text-rose-700">{t('service.contractEnded')}</span>}
                        {isExpiringSoon && <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><AlertTriangle size={12} />{t('owner.contractsExpiring')}</span>}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        <span className="font-medium">{a.vendorName}</span> • {a.agreementType} {a.buildingName && `• ${a.buildingName}`}
                      </div>
                      <div className="text-sm text-slate-400 mt-1 flex flex-wrap gap-4">
                        <span><Calendar size={14} className="inline mr-1" /> {fmtDate(a.startDate)} - {fmtDate(a.endDate)}</span>
                        <span className={`font-medium ${isExpired ? 'text-rose-600' : isExpiringSoon ? 'text-amber-600' : 'text-slate-600'}`}>
                          {isExpired ? `${Math.abs(daysRemaining)} ${t('service.daysOverdue')}` : `${daysRemaining} ${t('service.daysRemaining')}`}
                        </span>
                      </div>
                      {a.contactPerson && <div className="text-xs text-slate-400 mt-1">Contact: {a.contactPerson} {a.contactPhone && `• ${a.contactPhone}`}</div>}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xl font-bold text-emerald-600">{Number(a.amount).toLocaleString()} <span className="text-sm">{t('common.sar')}</span></div>
                        <div className="text-xs text-slate-400">{a.paymentFrequency}</div>
                        {(() => {
                          const totalPaid = (a.payments || []).reduce((sum, p) => sum + p.amount, 0);
                          const remaining = a.amount - totalPaid;
                          if (totalPaid > 0) {
                            return (
                              <div className="text-xs mt-1">
                                <span className="text-emerald-600">Paid: {totalPaid.toLocaleString()}</span>
                                {remaining > 0 && <span className="text-amber-600 ml-2">Due: {remaining.toLocaleString()}</span>}
                                {remaining <= 0 && <span className="text-emerald-600 ml-1">✓</span>}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            // Calculate installment amount based on frequency
                            const getInstallmentCount = (freq: string) => {
                              switch(freq) {
                                case 'Monthly': return 12;
                                case 'Quarterly': return 4;
                                case 'Half-Yearly': return 2;
                                case 'Yearly': return 1;
                                case 'One-Time': return 1;
                                default: return 1;
                              }
                            };
                            const installmentCount = getInstallmentCount(a.paymentFrequency);
                            const installmentAmount = Math.round(a.amount / installmentCount);
                            const totalPaid = (a.payments || []).reduce((sum, p) => sum + p.amount, 0);
                            
                            // Calculate current installment balance
                            const paidInstallments = Math.floor(totalPaid / installmentAmount);
                            const paidInCurrentInstallment = totalPaid - (paidInstallments * installmentAmount);
                            const currentInstallmentBalance = installmentAmount - paidInCurrentInstallment;
                            
                            // Default to current installment balance
                            const defaultAmount = currentInstallmentBalance > 0 ? currentInstallmentBalance : installmentAmount;
                            
                            setPaymentAgreement(a);
                            setPaymentDate(new Date().toISOString().split('T')[0]);
                            setPaymentAmount(defaultAmount);
                            setPaymentNotes('');
                            setPaymentModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                          title={t('contract.recordPayment')}
                        >
                          <DollarSign size={18} />
                        </button>
                        <button onClick={() => handleEdit(a)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title={t('common.edit')}>
                          <Edit2 size={18} />
                        </button>
                        {a.previousAgreementId && (
                          <button 
                            onClick={() => handleRevertToPrevious(a.id)} 
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" 
                            title="Revert to Previous Agreement"
                          >
                            <X size={18} />
                          </button>
                        )}
                        {(!a.payments || a.payments.length === 0) && (
                          <button 
                            onClick={() => handleDelete(a.id)} 
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            title={t('common.delete')}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                        {a.payments && a.payments.length > 0 && (
                          <button 
                            disabled
                            className="p-2 text-slate-200 cursor-not-allowed rounded-lg"
                            title={`Cannot delete - has ${a.payments.length} payment(s)`}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-6">{formData.id ? t('service.editTitle') : t('service.newTitle')}</h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('service.agreementName')} *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g., Lift Maintenance 2026"
                      className="w-full px-3 py-2 border rounded-xl"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('service.agreementType')}</label>
                    <select
                      value={formData.agreementType}
                      onChange={e => setFormData({...formData, agreementType: e.target.value})}
                      className="w-full px-3 py-2 border rounded-xl"
                    >
                      <option value="">Select Type</option>
                      {AGREEMENT_TYPES.map(tx => <option key={tx} value={tx}>{tx}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('service.vendorCompany')} *</label>
                    <input
                      type="text"
                      value={formData.vendorName}
                      onChange={e => setFormData({...formData, vendorName: e.target.value})}
                      placeholder="Company name"
                      className="w-full px-3 py-2 border rounded-xl"
                      list="vendor-list"
                      required
                    />
                    <datalist id="vendor-list">
                      {vendors.map(v => <option key={v.id} value={v.name} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('service.buildingOptional')}</label>
                    <select
                      value={formData.buildingId}
                      onChange={e => {
                        const bld = buildings.find(b => b.id === e.target.value);
                        setFormData({...formData, buildingId: e.target.value, buildingName: bld?.name || ''});
                      }}
                      className="w-full px-3 py-2 border rounded-xl"
                    >
                      <option value="">{t('history.allBuildings')}</option>
                      {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('contract.startDate')} *</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={e => {
                        const startDate = e.target.value;
                        // Auto-calculate end date if duration is set (end = start + months - 1 day)
                        if (startDate && formData.durationMonths) {
                          const end = new Date(startDate);
                          end.setMonth(end.getMonth() + formData.durationMonths);
                          end.setDate(end.getDate() - 1); // Day before anniversary
                          setFormData({...formData, startDate, endDate: end.toISOString().split('T')[0]});
                        } else {
                          setFormData({...formData, startDate});
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-xl"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('service.durationMonths')}</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.durationMonths || ''}
                      onChange={e => {
                        const durationMonths = Number(e.target.value);
                        if (formData.startDate && durationMonths > 0) {
                          const end = new Date(formData.startDate);
                          end.setMonth(end.getMonth() + durationMonths);
                          end.setDate(end.getDate() - 1); // Day before anniversary
                          setFormData({...formData, durationMonths, endDate: end.toISOString().split('T')[0]});
                        } else {
                          setFormData({...formData, durationMonths});
                        }
                      }}
                      placeholder="12"
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('contract.endDate')} *</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={e => setFormData({...formData, endDate: e.target.value})}
                      className="w-full px-3 py-2 border rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('service.totalAmount')}</label>
                    <input
                      type="number"
                      value={formData.amount || ''}
                      onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                      placeholder="0"
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('service.paymentFrequency')}</label>
                    <select
                      value={formData.paymentFrequency}
                      onChange={e => setFormData({...formData, paymentFrequency: e.target.value as any})}
                      className="w-full px-3 py-2 border rounded-xl"
                    >
                      {PAYMENT_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {!isRenewalMode && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('service.contactPerson')}</label>
                        <input
                          type="text"
                          value={formData.contactPerson || ''}
                          onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                          placeholder={t('common.name')}
                          className="w-full px-3 py-2 border rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('service.contactPhone')}</label>
                        <input
                          type="text"
                          value={formData.contactPhone || ''}
                          onChange={e => setFormData({...formData, contactPhone: e.target.value})}
                          placeholder="Phone number"
                          className="w-full px-3 py-2 border rounded-xl"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('common.status')}</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as any})}
                      className="w-full px-3 py-2 border rounded-xl"
                    >
                      <option value="Active">{t('common.active')}</option>
                      <option value="Expired">{t('contract.statusExpired')}</option>
                      <option value="Cancelled">{t('service.cancelled')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('common.notes')}</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    placeholder="Additional notes..."
                    rows={3}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => { setIsFormOpen(false); resetForm(); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">{t('common.cancel')}</button>
                  <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700">
                    {formData.id ? t('service.updateAgreement') : t('service.saveAgreement')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModalOpen && paymentAgreement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-lg">
            <div className="p-2">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-base font-bold">{paymentAgreement.name}</h3>
                <button onClick={() => setPaymentModalOpen(false)} className="p-1 hover:bg-slate-100 rounded">
                  <X size={18} />
                </button>
              </div>
              <div className="text-xs text-slate-500 mb-1.5">{paymentAgreement.vendorName}</div>
              <div className="space-y-1.5">
                {(() => {
                  // Get full agreement history
                  const agreementHistory = getFullAgreementHistory(paymentAgreement);
                  
                  // Helper functions
                  const getInstallmentCount = (freq: string) => {
                    switch(freq) {
                      case 'Monthly': return 12;
                      case 'Quarterly': return 4;
                      case 'Half-Yearly': return 2;
                      case 'Yearly': return 1;
                      case 'One-Time': return 1;
                      default: return 1;
                    }
                  };
                  const getInstallmentMonths = (freq: string) => {
                    switch(freq) {
                      case 'Monthly': return 1;
                      case 'Quarterly': return 3;
                      case 'Half-Yearly': return 6;
                      case 'Yearly': return 12;
                      case 'One-Time': return 12;
                      default: return 12;
                    }
                  };
                  const formatDate = (d: Date) => d.toISOString().split('T')[0];
                  
                  // Build complete installment list across all renewals
                  let installmentIndex = 0;
                  const allInstallments: any[] = [];
                  
                  for (const agr of agreementHistory) {
                    const count = getInstallmentCount(agr.paymentFrequency);
                    const months = getInstallmentMonths(agr.paymentFrequency);
                    const amount = Math.round(agr.amount / count);
                    const contractStart = new Date(agr.startDate);
                    
                    for (let i = 1; i <= count; i++) {
                      const instStart = new Date(contractStart);
                      instStart.setMonth(contractStart.getMonth() + (i - 1) * months);
                      const instEnd = new Date(instStart);
                      instEnd.setMonth(instStart.getMonth() + months);
                      instEnd.setDate(instEnd.getDate() - 1);
                      
                      installmentIndex++;
                      allInstallments.push({
                        number: installmentIndex,
                        agreementId: agr.id,
                        startDate: formatDate(instStart),
                        endDate: formatDate(instEnd),
                        amount,
                        period: `${formatDate(instStart)} to ${formatDate(instEnd)}`
                      });
                    }
                  }
                  
                  // Get aggregated payments
                  const aggregatedPayments = getAggregatedPayments(agreementHistory);
                  const totalPaid = aggregatedPayments.reduce((sum, p) => sum + p.amount, 0);
                  const totalAmount = agreementHistory.reduce((sum, agr) => sum + agr.amount, 0);
                  const totalRemaining = totalAmount - totalPaid;
                  
                  // Find current installment
                  let currentInstallmentNo = 1;
                  let currentInstallmentBalance = allInstallments[0]?.amount || 0;
                  let paidSoFar = 0;
                  
                  for (const inst of allInstallments) {
                    if (paidSoFar + inst.amount <= totalPaid) {
                      paidSoFar += inst.amount;
                      currentInstallmentNo = inst.number + 1;
                      currentInstallmentBalance = inst.amount;
                    } else {
                      currentInstallmentBalance = inst.amount - (totalPaid - paidSoFar);
                      break;
                    }
                  }
                  
                  const firstAgreement = agreementHistory[0];
                  const lastAgreement = agreementHistory[agreementHistory.length - 1];
                  
                  return (
                    <>
                      {/* Contract Period Summary */}
                      <div className="p-2 bg-gradient-to-r from-purple-50 to-purple-100 rounded border border-purple-200">
                        <div className="text-xs text-slate-600 font-semibold mb-1">{t('service.contractPeriod').toUpperCase()}</div>
                        <div className="text-sm font-bold text-purple-700">{firstAgreement.startDate} → {lastAgreement.endDate}</div>
                        {agreementHistory.length > 1 && (
                          <div className="text-xs text-purple-600 mt-0.5">({agreementHistory.length} renewal{agreementHistory.length > 1 ? 's' : ''})</div>
                        )}
                      </div>

                      {/* All Installments Grid */}
                      <div className="p-2 bg-slate-50 rounded border border-slate-200">
                        <div className="text-xs text-slate-600 font-semibold mb-2">{t('service.allInstallments').toUpperCase()} ({allInstallments.length} Total)</div>
                        <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                          {allInstallments.map((inst) => (
                            <div 
                              key={inst.number} 
                              className={`p-1.5 rounded text-xs border ${
                                inst.number === currentInstallmentNo 
                                  ? 'bg-blue-100 border-blue-300 font-bold text-blue-700' 
                                  : inst.number < currentInstallmentNo 
                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-700' 
                                    : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              <div className="font-bold">#{inst.number}</div>
                              <div className="text-xs opacity-75">{inst.amount.toLocaleString()} SAR</div>
                              <div className="text-xs opacity-60">{inst.startDate}</div>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-slate-600 mt-2 flex justify-between gap-2">
                          <span>{t('history.totalShort')}<b>{totalAmount.toLocaleString()} SAR</b></span>
                          <span>{t('service.remaining')}: <b className="text-amber-600">{totalRemaining.toLocaleString()} SAR</b></span>
                        </div>
                      </div>

                      {/* Payment History */}
                      {aggregatedPayments.length > 0 && (
                        <div className="border rounded-lg p-2">
                          <div className="text-xs font-bold text-slate-600 mb-1.5">{t('service.paymentHistory').toUpperCase()} ({aggregatedPayments.length})</div>
                          <div className="space-y-1 max-h-28 overflow-y-auto">
                            {aggregatedPayments.map((p, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs p-1.5 bg-slate-50 rounded">
                                <span className="text-slate-600">{fmtDate(p.date)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-emerald-600">{p.amount.toLocaleString()} SAR</span>
                                  <button
                                    onClick={async () => {
                                      openConfirm(`Remove this payment of ${p.amount.toLocaleString()} SAR?`, async () => {
                                        const updatedPayments = aggregatedPayments.filter((_, i) => i !== idx);
                                        // Update the current agreement
                                        await saveServiceAgreement({
                                          ...paymentAgreement,
                                          payments: updatedPayments.filter(pay => 
                                            paymentAgreement.payments?.some(p2 => p2.date === pay.date && p2.amount === pay.amount)
                                          ),
                                          updatedAt: Date.now()
                                        });
                                        setAgreements(await getServiceAgreements());
                                        setPaymentAgreement({
                                          ...paymentAgreement,
                                          payments: updatedPayments.filter(pay => 
                                            paymentAgreement.payments?.some(p2 => p2.date === pay.date && p2.amount === pay.amount)
                                          )
                                        });
                                        showSuccess('Payment removed');
                                        closeConfirm();
                                      });
                                    }}
                                    className="text-red-500 hover:text-red-700 p-0.5"
                                    title="Remove payment"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">{t('common.amount')}</label>
                  <input
                    type="number"
                    value={paymentAmount || ''}
                    onChange={e => setPaymentAmount(Number(e.target.value))}
                    className="w-full px-1.5 py-1 border rounded text-xs"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">{t('common.date')}</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full px-1.5 py-1 border rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">{t('common.notes')}</label>
                  <textarea
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    placeholder="Ref, cheque #"
                    rows={1}
                    className="w-full px-1.5 py-1 border rounded text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded text-xs font-medium"
                >{t('common.cancel')}</button>
                <button
                  onClick={async () => {
                    if (!paymentAmount || paymentAmount <= 0) {
                      showError('Please enter a valid amount');
                      return;
                    }
                    
                    // Calculate installment dates for the transaction
                    const getInstallmentCount = (freq: string) => {
                      switch(freq) {
                        case 'Monthly': return 12;
                        case 'Quarterly': return 4;
                        case 'Half-Yearly': return 2;
                        case 'Yearly': return 1;
                        case 'One-Time': return 1;
                        default: return 1;
                      }
                    };
                    const getInstallmentMonths = (freq: string) => {
                      switch(freq) {
                        case 'Monthly': return 1;
                        case 'Quarterly': return 3;
                        case 'Half-Yearly': return 6;
                        case 'Yearly': return 12;
                        case 'One-Time': return 12;
                        default: return 12;
                      }
                    };
                    const installmentCount = getInstallmentCount(paymentAgreement.paymentFrequency);
                    const installmentMonths = getInstallmentMonths(paymentAgreement.paymentFrequency);
                    const installmentAmount = Math.round(paymentAgreement.amount / installmentCount);
                    const totalPaid = (paymentAgreement.payments || []).reduce((sum, p) => sum + p.amount, 0);
                    const paidInstallments = Math.floor(totalPaid / installmentAmount);
                    const currentInstallmentNo = paidInstallments + 1;
                    
                    const contractStart = new Date(paymentAgreement.startDate);
                    const installmentStartDate = new Date(contractStart);
                    installmentStartDate.setMonth(contractStart.getMonth() + (currentInstallmentNo - 1) * installmentMonths);
                    const installmentEndDate = new Date(installmentStartDate);
                    installmentEndDate.setMonth(installmentStartDate.getMonth() + installmentMonths);
                    installmentEndDate.setDate(installmentEndDate.getDate() - 1);
                    const formatDate = (d: Date) => d.toISOString().split('T')[0];
                    
                    // Create expense transaction
                    const expenseTransaction = {
                      id: crypto.randomUUID(),
                      type: TransactionType.EXPENSE,
                      amount: paymentAmount,
                      date: paymentDate,
                      paymentMethod: PaymentMethod.BANK,
                      expenseCategory: 'Service Agreement',
                      details: `${paymentAgreement.name} - ${paymentAgreement.vendorName}${paymentNotes ? ' (' + paymentNotes + ')' : ''}`,
                      buildingId: paymentAgreement.buildingId || '',
                      buildingName: paymentAgreement.buildingName || '',
                      serviceAgreementId: paymentAgreement.id,
                      serviceAgreementStartDate: paymentAgreement.startDate,
                      serviceAgreementEndDate: paymentAgreement.endDate,
                      serviceAgreementName: `${paymentAgreement.name} - ${paymentAgreement.vendorName}`,
                      installmentStartDate: formatDate(installmentStartDate),
                      installmentEndDate: formatDate(installmentEndDate),
                      installmentNumber: currentInstallmentNo,
                      status: TransactionStatus.APPROVED,
                      createdAt: Date.now(),
                      updatedAt: Date.now()
                    };
                    await saveTransaction(expenseTransaction as any);
                    
                    // Add to payments array
                    const newPayment = { date: paymentDate, amount: paymentAmount, notes: paymentNotes };
                    const updatedPayments = [...(paymentAgreement.payments || []), newPayment];
                    
                    // Update agreement
                    await saveServiceAgreement({
                      ...paymentAgreement,
                      payments: updatedPayments,
                      updatedAt: Date.now()
                    });
                    setAgreements(await getServiceAgreements());
                    setPaymentModalOpen(false);
                    showSuccess('Payment recorded & added to expenses');
                  }}
                  className="px-4 py-1 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium"
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        onConfirm={() => { if (confirmAction) confirmAction(); }}
        onCancel={closeConfirm}
        confirmLabel="Delete"
        danger={confirmDanger}
      />
    </div>
  );
};

export default ServiceAgreements;
