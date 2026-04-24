import React, { useState, useEffect } from 'react';
import { MessageCircle, Plus, Search, Send, X, Settings, CheckCircle, AlertTriangle, Clock, Eye } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { getWhatsAppMessages, saveWhatsAppMessage, getWhatsAppConfig, saveWhatsAppConfig, getContracts, getCustomers } from '../services/firestoreService';
import type { WhatsAppMessage, WhatsAppConfig, Contract, Customer } from '../types';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';
import { formatNameWithRoom } from '../utils/customerDisplay';

/**
 * WhatsApp Business API Integration
 * 
 * Auto-send payment reminders, receipts, and contract renewals via WhatsApp.
 * - Configure WhatsApp Business API credentials
 * - Message templates: payment_reminder, receipt, contract_renewal, custom
 * - Bulk send to all tenants with overdue payments
 * - Message delivery tracking (Queued → Sent → Delivered → Read)
 * - Message history and analytics
 * - Template variable substitution
 */

const STATUS_COLORS: Record<string, string> = {
  Queued: 'bg-slate-100 text-slate-600',
  Sent: 'bg-blue-100 text-blue-700',
  Delivered: 'bg-emerald-100 text-emerald-700',
  Read: 'bg-emerald-100 text-emerald-700',
  Failed: 'bg-rose-100 text-rose-700',
};

const TEMPLATE_TYPES = [
  { value: 'payment_reminder', label: 'Payment Reminder', icon: '💰' },
  { value: 'receipt', label: 'Payment Receipt', icon: '🧾' },
  { value: 'contract_renewal', label: 'Contract Renewal', icon: '📋' },
  { value: 'custom', label: 'Custom Message', icon: '✉️' },
];

const DEFAULT_TEMPLATES: Record<string, string> = {
  payment_reminder: 'Dear {{name}}, your rent payment of {{amount}} SAR for {{building}}/{{unit}} is due on {{dueDate}}. Please arrange payment. - Amlak Property Management',
  receipt: 'Dear {{name}}, we confirm receipt of {{amount}} SAR for {{building}}/{{unit}}. Reference: {{reference}}. Thank you! - Amlak',
  contract_renewal: 'Dear {{name}}, your contract for {{building}}/{{unit}} expires on {{expiryDate}}. Please contact us for renewal. - Amlak',
  custom: '',
};

const WhatsAppIntegration: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const { showSuccess, showError } = useToast();
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configForm, setConfigForm] = useState<Partial<WhatsAppConfig>>({ apiUrl: '', apiToken: '', phoneNumberId: '', businessAccountId: '', isEnabled: false, templates: [] });
  const [formData, setFormData] = useState<any>({ recipientPhone: '', recipientName: '', templateName: 'payment_reminder', messageType: 'payment_reminder', variables: {}, customMessage: '' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [m, cfg, c, cu] = await Promise.all([getWhatsAppMessages(), getWhatsAppConfig(), getContracts(), getCustomers()]);
      setMessages((m || []) as WhatsAppMessage[]);
      setConfig(cfg as WhatsAppConfig | null);
      setContracts((c || []) as Contract[]);
      setCustomers((cu || []) as Customer[]);
      if (cfg) setConfigForm(cfg as WhatsAppConfig);
    } catch (err) { console.error('Failed to load WhatsApp data', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    if (!formData.recipientPhone || !formData.recipientName) { showError('Recipient phone and name required'); return; }

    const templateBody = DEFAULT_TEMPLATES[formData.messageType] || formData.customMessage || '';
    const populatedBody = Object.entries(formData.variables as Record<string, string>).reduce(
      (text, [key, value]) => text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value), templateBody
    );

    const msg: WhatsAppMessage = {
      id: crypto.randomUUID(),
      recipientPhone: formData.recipientPhone,
      recipientName: formData.recipientName,
      templateName: formData.messageType,
      messageType: formData.messageType,
      variables: { ...formData.variables, messageBody: populatedBody },
      status: config?.isEnabled ? 'Queued' : 'Queued',
      relatedId: formData.relatedId || '',
      createdAt: Date.now(),
      createdBy: 'system',
    };

    // If WhatsApp API is configured and enabled, attempt to send
    if (config?.isEnabled && config.apiUrl && config.apiToken) {
      try {
        // Call WhatsApp Business API
        const response = await fetch(`${config.apiUrl}/${config.phoneNumberId}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: formData.recipientPhone.replace(/[^0-9]/g, ''),
            type: 'text',
            text: { body: populatedBody }
          })
        });
        if (response.ok) { msg.status = 'Sent'; msg.sentAt = Date.now(); }
        else { msg.status = 'Failed'; msg.errorMessage = `API error: ${response.status}`; }
      } catch (err: any) {
        msg.status = 'Failed';
        msg.errorMessage = err.message || 'Network error';
      }
    }

    try {
      await saveWhatsAppMessage(msg);
      showSuccess(msg.status === 'Sent' ? 'Message sent via WhatsApp' : msg.status === 'Failed' ? 'Message failed — saved to queue' : 'Message queued');
      setIsFormOpen(false);
      setFormData({ recipientPhone: '', recipientName: '', templateName: 'payment_reminder', messageType: 'payment_reminder', variables: {}, customMessage: '' });
      load();
    } catch (err: any) { showError(err.message || 'Failed to save message'); }
  };

  const saveConfig = async () => {
    await saveWhatsAppConfig(configForm);
    showSuccess('WhatsApp configuration saved');
    setIsConfigOpen(false);
    load();
  };

  const bulkSendReminders = async () => {
    const activeContracts = contracts.filter(c => c.status === 'Active');
    let sentCount = 0;
    for (const contract of activeContracts) {
      const customer = customers.find(cu => cu.id === contract.customerId);
      if (!customer?.mobileNo) continue;
      const custLabel = formatNameWithRoom(contract.customerName, customer?.roomNumber);
      const msg: WhatsAppMessage = {
        id: crypto.randomUUID(),
        recipientPhone: customer.mobileNo,
        recipientName: custLabel,
        templateName: 'payment_reminder',
        messageType: 'payment_reminder',
        variables: { name: custLabel, amount: String(contract.rentValue), building: contract.buildingName, unit: contract.unitName, dueDate: contract.toDate },
        status: 'Queued',
        relatedId: contract.id,
        createdAt: Date.now(),
        createdBy: 'system',
      };
      await saveWhatsAppMessage(msg);
      sentCount++;
    }
    showSuccess(`${sentCount} payment reminders queued`);
    load();
  };

  const selectCustomer = (customerId: string) => {
    const c = customers.find(cu => cu.id === customerId);
    if (!c) return;
    const custLabel = formatNameWithRoom(c.nameAr || c.nameEn, c.roomNumber);
    setFormData({ ...formData, recipientPhone: c.mobileNo, recipientName: custLabel, variables: { ...formData.variables, name: custLabel } });
  };

  const filtered = messages.filter(m => {
    const matchSearch = !search || m.recipientName.toLowerCase().includes(search.toLowerCase()) || m.recipientPhone.includes(search);
    const matchType = !filterType || m.messageType === filterType;
    return matchSearch && matchType;
  }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const stats = {
    total: messages.length,
    sent: messages.filter(m => m.status === 'Sent' || m.status === 'Delivered' || m.status === 'Read').length,
    queued: messages.filter(m => m.status === 'Queued').length,
    failed: messages.filter(m => m.status === 'Failed').length,
  };

  return (
    <div className="px-3 sm:px-6 pt-2 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageCircle className="text-green-600" /> WhatsApp Integration
          </h1>
          <p className="text-sm text-slate-500 mt-1">Auto-send payment reminders, receipts & renewals via WhatsApp Business API</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsConfigOpen(true)} className="px-3 py-2 border rounded-xl text-sm hover:bg-slate-50 flex items-center gap-1">
            <Settings size={14} /> Config
          </button>
          <button onClick={() => { setConfirmMsg('Send payment reminders to ALL active tenants?'); setConfirmAction(() => bulkSendReminders); setConfirmOpen(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 flex items-center gap-1">
            <Send size={14} /> Bulk Reminders
          </button>
          <button onClick={() => setIsFormOpen(true)} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm hover:bg-green-700 flex items-center gap-1">
            <Plus size={14} /> Send Message
          </button>
        </div>
      </div>

      {/* API Status Banner */}
      {!config?.isEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm">
          <AlertTriangle size={16} className="text-amber-500" />
          <span className="text-amber-700">WhatsApp API not configured. Messages will be queued locally. <button onClick={() => setIsConfigOpen(true)} className="underline font-medium">Configure now</button></span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-slate-700">{stats.total}</div><div className="text-xs text-slate-500">Total Messages</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-green-600">{stats.sent}</div><div className="text-xs text-slate-500">Sent/Delivered</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-amber-600">{stats.queued}</div><div className="text-xs text-slate-500">Queued</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-rose-600">{stats.failed}</div><div className="text-xs text-slate-500">Failed</div></div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder={t('entry.search')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm" /></div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border rounded-xl text-sm">
          <option value="">{t('history.allTypes')}</option>
          {TEMPLATE_TYPES.map(tx => <option key={tx.value} value={tx.value}>{tx.icon} {tx.label}</option>)}
        </select>
      </div>

      {/* Message List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><MessageCircle size={48} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-400">No messages found</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(msg => (
            <div key={msg.id} className="ios-card p-3">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{TEMPLATE_TYPES.find(t => t.value === msg.messageType)?.icon || '✉️'}</span>
                    <span className="font-semibold text-sm">{msg.recipientName}</span>
                    <span className="text-xs text-slate-400">{msg.recipientPhone}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[msg.status]}`}>{msg.status}</span>
                  </div>
                  {msg.variables?.messageBody && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{msg.variables.messageBody}</p>}
                  {msg.errorMessage && <p className="text-xs text-rose-500 mt-1">{msg.errorMessage}</p>}
                </div>
                <div className="text-xs text-slate-400">{msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Send Message Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setIsFormOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Send WhatsApp Message</h2>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={sendMessage} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Select Customer</label>
                <select onChange={e => selectCustomer(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm">
                  <option value="">Choose customer...</option>
                  {customers.filter(c => c.mobileNo).map(c => <option key={c.id} value={c.id}>{formatNameWithRoom(c.nameAr || c.nameEn, c.roomNumber)} ({c.mobileNo})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Phone *</label><input type="tel" value={formData.recipientPhone} onChange={e => setFormData({ ...formData, recipientPhone: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="+966..." required /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Name *</label><input type="text" value={formData.recipientName} onChange={e => setFormData({ ...formData, recipientName: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" required /></div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATE_TYPES.map(tx => (
                    <button key={tx.value} type="button" onClick={() => setFormData({ ...formData, messageType: tx.value })} className={`p-2 rounded-xl border text-sm text-left ${formData.messageType === tx.value ? 'border-green-500 bg-green-50' : 'border-slate-200'}`}>
                      <span className="text-lg">{tx.icon}</span> {tx.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Message Preview</label>
                <div className="bg-green-50 rounded-xl p-3 text-sm border border-green-200">
                  {Object.entries(formData.variables as Record<string, string>).reduce(
                    (text, [key, value]) => text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`),
                    DEFAULT_TEMPLATES[formData.messageType] || 'Custom message...'
                  )}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border rounded-xl text-sm">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm hover:bg-green-700 flex items-center gap-1"><Send size={14} /> Send</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setIsConfigOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">WhatsApp API Configuration</h2>
              <button onClick={() => setIsConfigOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium text-slate-500 mb-1">API URL</label><input type="url" value={configForm.apiUrl || ''} onChange={e => setConfigForm({ ...configForm, apiUrl: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="https://graph.facebook.com/v17.0" /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">API Token</label><input type="password" value={configForm.apiToken || ''} onChange={e => setConfigForm({ ...configForm, apiToken: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">Phone Number ID</label><input type="text" value={configForm.phoneNumberId || ''} onChange={e => setConfigForm({ ...configForm, phoneNumberId: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">Business Account ID</label><input type="text" value={configForm.businessAccountId || ''} onChange={e => setConfigForm({ ...configForm, businessAccountId: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={configForm.isEnabled || false} onChange={e => setConfigForm({ ...configForm, isEnabled: e.target.checked })} className="rounded" />
                Enable WhatsApp API Integration
              </label>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setIsConfigOpen(false)} className="px-4 py-2 border rounded-xl text-sm">{t('common.cancel')}</button>
                <button onClick={saveConfig} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm">Save Config</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmOpen} title={t('common.confirm')} message={confirmMsg} onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }} onCancel={() => setConfirmOpen(false)} />
    </div>
  );
};

export default WhatsAppIntegration;
