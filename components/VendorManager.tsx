import React, { useState, useEffect, useRef } from 'react';
import { Vendor } from '../types';
import { getVendors, saveVendor, deleteVendor } from '../services/firestoreService';
import { Briefcase, Plus, Phone, Trash2, Search, FileSpreadsheet, Upload, X, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';
import * as XLSX from 'xlsx';

const VendorManager: React.FC = () => {
  const { t, isRTL, language } = useLanguage();
  const { showError, showSuccess } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Vendor>({
      id: '',
      name: '',
      serviceType: '',
      phone: '',
      notes: '',
      vatNo: ''
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmTitle, setConfirmTitle] = useState<string>('');
  const [confirmDanger, setConfirmDanger] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);

  // Excel import wizard
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<any[][]>([]);
  const [colMap, setColMap] = useState<Record<string, number | ''>>({
    name: '', serviceType: '', phone: '', email: '', vatNo: '', contactName: '', notes: '',
  });
  const [importLoading, setImportLoading] = useState(false);
  const [importDone, setImportDone] = useState<{ success: number; skipped: number } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const openConfirm = (message: string, onConfirm: () => void, opts?: { title?: string; danger?: boolean }) => {
    setConfirmTitle(opts?.title || t('common.confirm'));
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

    useEffect(() => {
      const load = async () => setVendors(await getVendors());
      load();
    }, []);

    useEffect(() => {
      const fromEntry = (location.state as any)?.fromEntry;
      if (fromEntry) setIsFormOpen(true);
    }, [location.state]);

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      SoundService.play('submit');
      
      // Check for duplicate vendor name (only if not editing the same vendor)
      const duplicateName = vendors.find(v => 
        v.name.toLowerCase() === formData.name.toLowerCase() && v.id !== formData.id
      );
      if (duplicateName) {
        showError(t('vendor.database') + ': ' + formData.name);
        return;
      }
      
      // Check for duplicate phone number (only if not editing the same vendor)
      if (formData.phone && formData.phone.trim()) {
        const duplicatePhone = vendors.find(v => 
          v.phone === formData.phone.trim() && v.id !== formData.id
        );
        if (duplicatePhone) {
          showError(t('vendor.phone') + ': ' + formData.phone);
          return;
        }
      }
      
      const newVendor = {
          ...formData,
          id: formData.id || crypto.randomUUID()
      };
    await saveVendor(newVendor);
    setVendors(await getVendors());
      setIsFormOpen(false);
      setFormData({ id: '', name: '', serviceType: '', phone: '', notes: '' });
      showSuccess(t('vendor.saved'));

      const returnTo = (location.state as any)?.returnTo;
      if (returnTo) {
        navigate(returnTo, { state: { vendorId: newVendor.id } });
      }
  };

  const handleDelete = async (id: string) => {
      openConfirm(t('vendor.deleteConfirm'), async () => {
        await deleteVendor(id);
        setVendors(await getVendors());
        showSuccess(t('vendor.deleted'));
        closeConfirm();
      }, { danger: true, title: t('vendor.deleteTitle') });
  };

  // ── Excel import helpers ──────────────────────────────────────────────────

  const VENDOR_FIELDS = [
    { key: 'name',        label: t('vendor.name'),        required: true  },
    { key: 'serviceType', label: t('vendor.serviceType'), required: true  },
    { key: 'phone',       label: t('vendor.phone'),       required: false },
    { key: 'email',       label: t('vendor.email'),       required: false },
    { key: 'vatNo',       label: t('vendor.vatNo'),       required: false },
    { key: 'contactName', label: t('vendor.contact'),     required: false },
    { key: 'notes',       label: t('vendor.notes'),       required: false },
  ];

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 1) return;
      const headers = rows[0].map((h: any) => String(h ?? ''));
      const dataRows = rows.slice(1).filter(r => r.some((c: any) => c !== null && c !== undefined && c !== ''));
      setImportHeaders(headers);
      setImportRows(dataRows);

      // Auto-detect columns by common header names
      const auto: Record<string, number | ''> = { name: '', serviceType: '', phone: '', email: '', vatNo: '', contactName: '', notes: '' };
      headers.forEach((h, i) => {
        const l = h.toLowerCase();
        if (auto.name        === '' && (l.includes('name') || l.includes('vendor') || l.includes('اسم')))       auto.name = i;
        else if (auto.serviceType === '' && (l.includes('service') || l.includes('type') || l.includes('خدمة')))  auto.serviceType = i;
        else if (auto.phone       === '' && (l.includes('phone') || l.includes('mobile') || l.includes('هاتف') || l.includes('جوال'))) auto.phone = i;
        else if (auto.email       === '' && (l.includes('email') || l.includes('mail') || l.includes('بريد')))   auto.email = i;
        else if (auto.vatNo       === '' && (l.includes('vat') || l.includes('tax') || l.includes('ضريبة')))     auto.vatNo = i;
        else if (auto.contactName === '' && (l.includes('contact') || l.includes(' المسؤول')))                     auto.contactName = i;
        else if (auto.notes       === '' && (l.includes('note') || l.includes('remark') || l.includes('ملاحظ'))) auto.notes = i;
      });
      setColMap(auto);
      setImportStep(2);
    };
    reader.readAsBinaryString(file);
  };

  const getMappedRows = (limit?: number) => {
    const rows = limit !== undefined ? importRows.slice(0, limit) : importRows;
    return rows.map(row => ({
      name:        colMap.name        !== '' ? String(row[colMap.name        as number] ?? '').trim() : '',
      serviceType: colMap.serviceType !== '' ? String(row[colMap.serviceType as number] ?? '').trim() : '',
      phone:       colMap.phone       !== '' ? String(row[colMap.phone       as number] ?? '').trim() : '',
      email:       colMap.email       !== '' ? String(row[colMap.email       as number] ?? '').trim() : '',
      vatNo:       colMap.vatNo       !== '' ? String(row[colMap.vatNo       as number] ?? '').trim() : '',
      contactName: colMap.contactName !== '' ? String(row[colMap.contactName as number] ?? '').trim() : '',
      notes:       colMap.notes       !== '' ? String(row[colMap.notes       as number] ?? '').trim() : '',
    }));
  };

  const handleRunImport = async () => {
    setImportLoading(true);
    let success = 0;
    let skipped = 0;
    const allMapped = getMappedRows();
    for (const row of allMapped) {
      if (!row.name) { skipped++; continue; }
      const dup = vendors.find(v => v.name.toLowerCase() === row.name.toLowerCase());
      if (dup) { skipped++; continue; }
      const vendor: Vendor = {
        id: crypto.randomUUID(),
        name: row.name,
        serviceType: row.serviceType || 'General',
        phone: row.phone || '',
        email:       row.email       || undefined,
        vatNo:       row.vatNo       || undefined,
        contactName: row.contactName || undefined,
        notes:       row.notes       || undefined,
      };
      await saveVendor(vendor);
      success++;
    }
    setVendors(await getVendors());
    setImportDone({ success, skipped });
    setImportLoading(false);
    setImportStep(3);
  };

  const resetImport = () => {
    setImportOpen(false);
    setImportStep(1);
    setImportHeaders([]);
    setImportRows([]);
    setColMap({ name: '', serviceType: '', phone: '', email: '', vatNo: '', contactName: '', notes: '' });
    setImportDone(null);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const filtered = vendors.filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()) || v.serviceType.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="premium-card min-h-[600px] animate-fade-in">
       <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
        <div>
            <h2 className="text-base sm:text-xl font-black text-slate-800 flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                <Briefcase className="text-white" size={24} /> 
            </div>
            {t('vendor.database')}
            </h2>
            <p className="text-slate-500 text-sm mt-1 ml-14">{t('vendor.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setImportOpen(true); setImportStep(1); }}
            className="pm-btn pm-btn-secondary flex items-center gap-2"
          >
            <FileSpreadsheet size={18} /><span className="hidden sm:inline">{t('vendor.importExcel')}</span><span className="sm:hidden">Excel</span>
          </button>
          <button 
              onClick={() => setIsFormOpen(true)}
              className="pm-btn pm-btn-primary flex items-center gap-2"
          >
              <Plus size={18} />{t('vendor.addNew')}</button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
                    <div className="mb-6 relative form-with-icon max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                                type="text" 
                                placeholder={t('vendor.searchPlaceholder')} 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(v => (
                  <div key={v.id} className="premium-card premium-card-interactive p-4 group relative">
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setFormData(v); setIsFormOpen(true); }} className="text-slate-300 hover:text-blue-500 mr-2" title={t('common.edit')}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536M9 11l6.586-6.586a2 2 0 112.828 2.828L11.828 13.828a2 2 0 01-.707.464l-4 1a1 1 0 01-1.213-1.213l1-4a2 2 0 01.464-.707z"></path></svg>
                          </button>
                          <button onClick={() => handleDelete(v.id)} className="text-slate-300 hover:text-red-500" title={t('common.delete')}>
                            <Trash2 size={16} />
                          </button>
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                             {(v.serviceType || '').toLowerCase().includes('plumb') ? '🔧' : (v.serviceType || '').toLowerCase().includes('elect') ? '⚡' : '🛠️'}
                          </div>
                          <div>
                              <h4 className="font-bold text-slate-800">{v.name}</h4>
                              <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">{v.serviceType}</p>
                          </div>
                      </div>
                      <div className="text-sm text-slate-600 flex items-center gap-2 bg-slate-50 p-2 rounded-lg mb-2">
                          <Phone size={14} className="text-slate-400" /> {v.phone}
                      </div>
                      {v.vatNo && <div className="text-xs text-slate-500 mb-2">{t('vendor.vatLabel')} <span className="font-bold text-slate-700">{v.vatNo}</span></div>}
                      {v.notes && <p className="text-xs text-slate-400 italic">{v.notes}</p>}
                  </div>
              ))}
          </div>
      </div>

      {/* ── Add / Edit Vendor Modal ───────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden mt-16">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-lg">
                <div className="p-1.5 bg-indigo-600 rounded-lg">
                  <Briefcase size={18} className="text-white" />
                </div>
                {t('vendor.addEditTitle')}
              </h3>
              <button
                type="button"
                onClick={() => { setIsFormOpen(false); setFormData({ id: '', name: '', serviceType: '', phone: '', notes: '', vatNo: '' }); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleSave} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('vendor.name')} <span className="text-red-500">*</span></label>
                <input
                  type="text" required
                  placeholder={t('vendor.namePlaceholder')}
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('vendor.serviceType')} <span className="text-red-500">*</span></label>
                <input
                  type="text" required
                  placeholder={t('vendor.serviceTypePlaceholder')}
                  value={formData.serviceType}
                  onChange={e => setFormData({...formData, serviceType: e.target.value})}
                  className="p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('vendor.phone')}</label>
                <input
                  type="text"
                  placeholder={t('vendor.phonePlaceholder')}
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('vendor.vatNo')}</label>
                <input
                  type="text"
                  placeholder={t('vendor.vatOptional')}
                  value={formData.vatNo}
                  onChange={e => setFormData({...formData, vatNo: e.target.value})}
                  className="p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('vendor.notes')}</label>
                <input
                  type="text"
                  placeholder={t('vendor.notesOptional')}
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
              <div className="sm:col-span-2 flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsFormOpen(false); setFormData({ id: '', name: '', serviceType: '', phone: '', notes: '', vatNo: '' }); }}
                  className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-7 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Excel Import Wizard Modal ─────────────────────────────────── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden mt-16">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-lg">
                <FileSpreadsheet size={22} className="text-indigo-600" />
                {t('vendor.importExcel')}
              </h3>
              <div className="flex items-center gap-1 text-sm font-semibold text-slate-500">
                {([1, 2, 3] as const).map(s => (
                  <React.Fragment key={s}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${importStep === s ? 'bg-indigo-600 text-white' : importStep > s ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{s}</span>
                    {s < 3 && <ChevronRight size={14} className="text-slate-300" />}
                  </React.Fragment>
                ))}
              </div>
              <button onClick={resetImport} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            {/* Step 1 – Upload file */}
            {importStep === 1 && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-5">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <Upload size={32} className="text-indigo-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-700 text-lg mb-1">{t('vendor.importStep1Title')}</p>
                  <p className="text-slate-500 text-sm">{t('vendor.importStep1Hint')}</p>
                </div>
                <label className="cursor-pointer px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2">
                  <FileSpreadsheet size={18} />
                  {t('vendor.chooseFile')}
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleImportFileChange}
                  />
                </label>
              </div>
            )}

            {/* Step 2 – Map columns */}
            {importStep === 2 && (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                <div>
                  <p className="font-bold text-slate-700 mb-1">{t('vendor.importStep2Title')}</p>
                  <p className="text-slate-500 text-sm">{importRows.length} {t('vendor.importRowsFound')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {VENDOR_FIELDS.map(field => (
                    <div key={field.key} className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                        {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <select
                        value={colMap[field.key]}
                        onChange={e => setColMap(prev => ({ ...prev, [field.key]: e.target.value === '' ? '' : Number(e.target.value) }))}
                        className="p-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="">{t('vendor.noColumn')}</option>
                        {importHeaders.map((h, i) => (
                          <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {importRows.length > 0 && colMap.name !== '' && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{t('vendor.importPreview')}</p>
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold">
                          <tr>
                            <th className="px-3 py-2 text-left">{t('vendor.name')}</th>
                            <th className="px-3 py-2 text-left">{t('vendor.serviceType')}</th>
                            <th className="px-3 py-2 text-left">{t('vendor.phone')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getMappedRows(3).map((row, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-medium text-slate-800">{row.name || '—'}</td>
                              <td className="px-3 py-2 text-slate-600">{row.serviceType || '—'}</td>
                              <td className="px-3 py-2 text-slate-600">{row.phone || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <button onClick={() => setImportStep(1)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg text-sm">{t('common.back')}</button>
                  <button
                    onClick={() => setImportStep(3)}
                    disabled={colMap.name === ''}
                    className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    {t('vendor.importPreviewBtn')} ({importRows.length})
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 – Preview full data & confirm */}
            {importStep === 3 && !importDone && (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                <div>
                  <p className="font-bold text-slate-700 mb-1">{t('vendor.importStep3Title')}</p>
                  <p className="text-slate-500 text-sm">{importRows.length} {t('vendor.importRowsFound')}</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-100 max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        {VENDOR_FIELDS.filter(f => colMap[f.key] !== '').map(f => (
                          <th key={f.key} className="px-3 py-2 text-left">{f.label.replace(' *', '')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {getMappedRows().map((row, i) => (
                        <tr key={i} className={`border-t border-slate-100 ${!row.name ? 'opacity-40 bg-red-50' : ''}`}>
                          <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                          {VENDOR_FIELDS.filter(f => colMap[f.key] !== '').map(f => (
                            <td key={f.key} className="px-3 py-2 text-slate-700">{(row as any)[f.key] || '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <button onClick={() => setImportStep(2)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg text-sm">{t('common.back')}</button>
                  <button
                    onClick={handleRunImport}
                    disabled={importLoading}
                    className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-40 text-sm flex items-center gap-2"
                  >
                    {importLoading ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />{t('vendor.importing')}</>
                    ) : (
                      <><Upload size={16} />{t('vendor.importConfirm')}</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Done screen */}
            {importDone && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-5">
                <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
                  <CheckCircle size={36} className="text-green-500" />
                </div>
                <div className="text-center">
                  <p className="font-black text-slate-800 text-xl mb-2">{t('vendor.importDoneTitle')}</p>
                  <p className="text-green-600 font-bold text-lg">{importDone.success} {t('vendor.importDoneSuccess')}</p>
                  {importDone.skipped > 0 && (
                    <p className="text-amber-500 text-sm mt-1 flex items-center justify-center gap-1">
                      <AlertTriangle size={14} /> {importDone.skipped} {t('vendor.importDoneSkipped')}
                    </p>
                  )}
                </div>
                <button onClick={resetImport} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">
                  {t('common.done')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        title={confirmTitle}
        message={confirmMessage}
        danger={confirmDanger}
        onConfirm={() => confirmAction && confirmAction()}
        onCancel={closeConfirm}
      />
    </div>
  );
};

export default VendorManager;