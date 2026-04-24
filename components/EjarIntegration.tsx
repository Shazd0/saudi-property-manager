import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSignature, Plus, Search, Edit2, Trash2, X, RefreshCw, AlertTriangle,
  Copy, Download, Upload, ArrowRightLeft, Link2, SlidersHorizontal,
  CheckCircle2, Clock, Building2, User, Calendar, ChevronDown,
} from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import {
  getEjarContracts, saveEjarContract, deleteEjarContract,
  getContracts, getBuildings, getCustomers, saveContract,
} from '../services/firestoreService';
import type { EjarContract, Contract, Customer, Building } from '../types';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';
import { buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';

/**
 * Ejar Platform Integration
 *
 * Lifecycle (simplified, no "Draft"):
 *   Pending     — prepared in Amlak, not yet registered on Ejar portal (no Ejar # yet)
 *   Registered  — submitted to Ejar and has an Ejar number
 *   Active      — currently running (between start and end date, Ejar # present)
 *   Expired     — end date passed
 *   Terminated  — ended early (manual)
 *
 * Status is auto-computed from data when possible, but can be overridden by the user.
 */

type EjarStatus = 'Pending' | 'Registered' | 'Active' | 'Expired' | 'Terminated';
const ALL_STATUSES: EjarStatus[] = ['Pending', 'Registered', 'Active', 'Expired', 'Terminated'];

const STATUS_STYLES: Record<EjarStatus, { chip: string; dot: string; stripe: string; label: string }> = {
  Pending:    { chip: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-500',   stripe: 'from-amber-400 to-amber-300',     label: 'Pending' },
  Registered: { chip: 'bg-blue-50 text-blue-700 border-blue-200',         dot: 'bg-blue-500',    stripe: 'from-blue-400 to-blue-300',       label: 'Registered' },
  Active:     { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', stripe: 'from-emerald-400 to-emerald-300', label: 'Active' },
  Expired:    { chip: 'bg-rose-50 text-rose-700 border-rose-200',         dot: 'bg-rose-500',    stripe: 'from-rose-400 to-rose-300',       label: 'Expired' },
  Terminated: { chip: 'bg-red-50 text-red-700 border-red-200',           dot: 'bg-red-500',     stripe: 'from-red-400 to-red-300',         label: 'Terminated' },
};

const unitCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const textOrEmpty = (v?: string) => String(v || '').trim();

const isPastDate = (iso: string) => !!iso && !isNaN(Date.parse(iso)) && Date.parse(iso) < Date.now();
const isFutureOrToday = (iso: string) => !!iso && !isNaN(Date.parse(iso)) && Date.parse(iso) >= Date.now() - 24 * 60 * 60 * 1000;

/**
 * Normalize any legacy "Draft" records and auto-derive the correct status from data.
 * Keeps manual "Terminated" intact; upgrades/downgrades everything else to match data.
 */
const deriveStatus = (e: Partial<EjarContract>): EjarStatus => {
  const manual = (e.status as string) || '';
  if (manual === 'Terminated') return 'Terminated';
  const hasEjarNo = !!textOrEmpty(e.ejarNumber);
  const endPassed = isPastDate(textOrEmpty(e.endDate));
  if (endPassed) return 'Expired';
  if (!hasEjarNo) return 'Pending';
  const startOk = !e.startDate || isFutureOrToday(textOrEmpty(e.startDate)) || isPastDate(textOrEmpty(e.startDate));
  if (hasEjarNo && startOk && !endPassed) {
    // If start date has passed, consider it Active; otherwise Registered (future start)
    return isPastDate(textOrEmpty(e.startDate)) ? 'Active' : 'Registered';
  }
  return 'Registered';
};

const statusPriority: Record<EjarStatus, number> = {
  Pending: 0, Registered: 1, Active: 2, Expired: 3, Terminated: 4,
};

const duplicateKeyFor = (item: EjarContract) => {
  if (item.ejarNumber) return `ejar:${String(item.ejarNumber).toLowerCase()}`;
  if (item.contractId) return `contract:${item.contractId}`;
  return `row:${item.id}`;
};

const emptyForm: Omit<EjarContract, 'id' | 'createdAt'> = {
  contractId: '',
  ejarNumber: '',
  registrationDate: new Date().toISOString().slice(0, 10),
  status: 'Pending',
  tenantIdNo: '',
  tenantName: '',
  landlordIdNo: '',
  landlordName: '',
  buildingId: '',
  buildingName: '',
  unitName: '',
  rentAmount: 0,
  startDate: '',
  endDate: '',
  paymentFrequency: 'Yearly',
  notes: '',
};

const EjarIntegration: React.FC = () => {
  const { t } = useLanguage();
  const { showSuccess, showError, showWarning } = useToast();

  // ── Data ──
  const [ejarContracts, setEjarContracts] = useState<EjarContract[]>([]);
  const [localContracts, setLocalContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);

  // ── UI State ──
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | EjarStatus>('');
  const [filterBuildingId, setFilterBuildingId] = useState('');
  const [filterFrequency, setFilterFrequency] = useState('');
  const [filterLink, setFilterLink] = useState<'ALL' | 'LINKED' | 'UNLINKED'>('ALL');
  const [sortBy, setSortBy] = useState<'UNIT_ASC' | 'UNIT_DESC' | 'TENANT_ASC' | 'LATEST_SYNC' | 'RENT_DESC'>('UNIT_ASC');
  const [showFilters, setShowFilters] = useState(true);
  const [bulkStatus, setBulkStatus] = useState<'' | EjarStatus>('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDupModalOpen, setIsDupModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ ...emptyForm });
  const [importData, setImportData] = useState<any>({
    ejarNumber: '', tenantName: '', tenantIdNo: '',
    landlordName: '', landlordIdNo: '', buildingId: '',
    unitName: '', rentAmount: 0, startDate: '', endDate: '',
    paymentFrequency: 'Yearly', installmentCount: 2, notes: '',
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');

  // ── Load ──
  const load = async () => {
    setLoading(true);
    try {
      const [ej, lc, cu, bl] = await Promise.all([
        getEjarContracts(), getContracts(), getCustomers(), getBuildings(),
      ]);
      setEjarContracts((ej || []) as EjarContract[]);
      setLocalContracts((lc || []) as Contract[]);
      setCustomers((cu || []) as Customer[]);
      setBuildings((bl || []) as Building[]);
    } catch (err) {
      console.error('Failed to load Ejar data', err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // ── Normalization & dedupe ──
  const normalizedEjarContracts = useMemo<EjarContract[]>(() => {
    return (ejarContracts || []).map((e) => {
      const base: EjarContract = {
        ...e,
        ejarNumber: textOrEmpty(e.ejarNumber),
        tenantName: textOrEmpty(e.tenantName),
        tenantIdNo: textOrEmpty(e.tenantIdNo),
        landlordName: textOrEmpty(e.landlordName),
        landlordIdNo: textOrEmpty(e.landlordIdNo),
        buildingId: textOrEmpty(e.buildingId),
        buildingName: textOrEmpty(e.buildingName),
        unitName: textOrEmpty(e.unitName),
        paymentFrequency: (textOrEmpty(e.paymentFrequency) || 'Yearly') as EjarContract['paymentFrequency'],
        startDate: textOrEmpty(e.startDate),
        endDate: textOrEmpty(e.endDate),
        registrationDate: textOrEmpty(e.registrationDate),
        notes: textOrEmpty(e.notes),
      };
      // Auto-derive status (also collapses legacy "Draft" → "Pending")
      base.status = deriveStatus(base);
      return base;
    });
  }, [ejarContracts]);

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, EjarContract[]>();
    for (const item of normalizedEjarContracts) {
      const key = duplicateKeyFor(item);
      const arr = groups.get(key) || [];
      arr.push(item);
      groups.set(key, arr);
    }
    return Array.from(groups.entries())
      .map(([key, rows]) => ({ key, rows }))
      .filter(g => g.rows.length > 1)
      .map(g => ({
        ...g,
        rows: g.rows.slice().sort((a, b) => {
          const aScore = Math.max(a.createdAt || 0, Date.parse(a.lastSyncDate || '') || 0);
          const bScore = Math.max(b.createdAt || 0, Date.parse(b.lastSyncDate || '') || 0);
          return bScore - aScore;
        }),
      }));
  }, [normalizedEjarContracts]);

  const dedupedEjarContracts = useMemo(() => {
    const byKey = new Map<string, EjarContract>();
    for (const item of normalizedEjarContracts) {
      const key = duplicateKeyFor(item);
      const current = byKey.get(key);
      if (!current) { byKey.set(key, item); continue; }
      const currentScore = Math.max(current.createdAt || 0, Date.parse(current.lastSyncDate || '') || 0);
      const nextScore = Math.max(item.createdAt || 0, Date.parse(item.lastSyncDate || '') || 0);
      if (nextScore >= currentScore) byKey.set(key, item);
    }
    return Array.from(byKey.values());
  }, [normalizedEjarContracts]);

  const linkedContractIds = useMemo(
    () => new Set(dedupedEjarContracts.map(e => e.contractId).filter(Boolean)),
    [dedupedEjarContracts]
  );

  const unregisteredContracts = useMemo(
    () => localContracts.filter(c => c.status === 'Active' && !linkedContractIds.has(c.id)),
    [localContracts, linkedContractIds]
  );

  const customerRoomMap = useMemo(() => buildCustomerRoomMap(customers), [customers]);

  // ── Filtering & sorting ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = dedupedEjarContracts.filter(e => {
      const linked = !!e.contractId && localContracts.some(c => c.id === e.contractId);
      const matchSearch = !q || [e.tenantName, e.ejarNumber, e.buildingName, e.unitName, e.tenantIdNo]
        .join(' ').toLowerCase().includes(q);
      const matchStatus = !filterStatus || e.status === filterStatus;
      const matchBuilding = !filterBuildingId || e.buildingId === filterBuildingId;
      const matchFrequency = !filterFrequency || e.paymentFrequency === filterFrequency;
      const matchLink = filterLink === 'ALL' || (filterLink === 'LINKED' ? linked : !linked);
      return matchSearch && matchStatus && matchBuilding && matchFrequency && matchLink;
    });

    rows.sort((a, b) => {
      if (sortBy === 'UNIT_ASC') {
        const byUnit = unitCollator.compare(a.unitName || '', b.unitName || '');
        if (byUnit !== 0) return byUnit;
        return unitCollator.compare(a.tenantName || '', b.tenantName || '');
      }
      if (sortBy === 'UNIT_DESC') {
        const byUnit = unitCollator.compare(b.unitName || '', a.unitName || '');
        if (byUnit !== 0) return byUnit;
        return unitCollator.compare(a.tenantName || '', b.tenantName || '');
      }
      if (sortBy === 'TENANT_ASC') return unitCollator.compare(a.tenantName || '', b.tenantName || '');
      if (sortBy === 'RENT_DESC') return (Number(b.rentAmount) || 0) - (Number(a.rentAmount) || 0);
      const aSync = Date.parse(a.lastSyncDate || '') || 0;
      const bSync = Date.parse(b.lastSyncDate || '') || 0;
      return bSync - aSync;
    });
    return rows;
  }, [dedupedEjarContracts, search, localContracts, filterStatus, filterBuildingId, filterFrequency, filterLink, sortBy]);

  const filteredRentTotal = useMemo(
    () => filtered.reduce((sum, r) => sum + (Number(r.rentAmount) || 0), 0),
    [filtered]
  );

  // ── Stats ──
  const stats = useMemo(() => ({
    total:       dedupedEjarContracts.length,
    active:      dedupedEjarContracts.filter(e => e.status === 'Active').length,
    pending:     dedupedEjarContracts.filter(e => e.status === 'Pending').length,
    registered:  dedupedEjarContracts.filter(e => e.status === 'Registered').length,
    expired:     dedupedEjarContracts.filter(e => e.status === 'Expired').length,
    unregistered: unregisteredContracts.length,
  }), [dedupedEjarContracts, unregisteredContracts]);

  const duplicateCollapsedCount = Math.max(0, normalizedEjarContracts.length - dedupedEjarContracts.length);

  // ── Save / Edit / Delete ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    if (!formData.tenantName.trim()) { showError('Tenant name is required'); return; }

    const normalizedEjarNo = textOrEmpty(formData.ejarNumber).toLowerCase();
    const duplicateEjarNo = normalizedEjarNo
      ? ejarContracts.find(x => x.id !== editId && textOrEmpty(x.ejarNumber).toLowerCase() === normalizedEjarNo)
      : null;
    if (duplicateEjarNo) { showError(`Ejar number "${formData.ejarNumber}" already exists`); return; }

    if (formData.contractId) {
      const duplicateContractLink = ejarContracts.find(x => x.id !== editId && x.contractId === formData.contractId);
      if (duplicateContractLink) { showError('This local contract is already linked to another Ejar record'); return; }
    }

    const next: EjarContract = {
      ...formData,
      id: editId || crypto.randomUUID(),
      rentAmount: Number(formData.rentAmount) || 0,
      createdAt: formData.createdAt || Date.now(),
      lastSyncDate: new Date().toISOString(),
    };
    // Auto-derive status unless user picked Terminated manually
    next.status = formData.status === 'Terminated' ? 'Terminated' : deriveStatus(next);

    try {
      await saveEjarContract(next);
      showSuccess(editId ? 'Ejar record updated' : 'Ejar registration created');
      setIsFormOpen(false);
      setEditId(null);
      setFormData({ ...emptyForm });
      load();
    } catch (err: any) {
      showError(err?.message || 'Failed to save Ejar record');
    }
  };

  const handleEdit = (e: EjarContract) => { setFormData(e); setEditId(e.id); setIsFormOpen(true); };

  const handleDelete = (id: string) => {
    setConfirmMsg('Delete this Ejar registration record?');
    setConfirmAction(() => async () => { await deleteEjarContract(id); showSuccess('Record deleted'); load(); });
    setConfirmOpen(true);
  };

  // ── Link local contract → auto-fill form ──
  const linkContract = (contractId: string) => {
    const c = localContracts.find(ct => ct.id === contractId);
    if (!c) return;
    const customer = customers.find(cu => cu.id === c.customerId);
    setFormData((prev: any) => ({
      ...prev,
      contractId: c.id,
      tenantName: c.customerName,
      tenantIdNo: customer?.idNo || '',
      buildingId: c.buildingId,
      buildingName: c.buildingName,
      unitName: c.unitName,
      rentAmount: c.rentValue,
      startDate: c.fromDate,
      endDate: c.toDate,
    }));
  };

  // ── Copy details for Ejar portal ──
  const copyToClipboard = (ej: EjarContract) => {
    const linkedContract = localContracts.find(c => c.id === ej.contractId);
    const customer = linkedContract ? customers.find(cu => cu.id === linkedContract.customerId) : null;
    const text = [
      `=== Contract Details for Ejar Registration ===`,
      `Tenant Name: ${ej.tenantName}`,
      `Tenant ID: ${ej.tenantIdNo}`,
      customer?.mobileNo ? `Tenant Mobile: ${customer.mobileNo}` : '',
      customer?.nationality ? `Nationality: ${customer.nationality}` : '',
      `Landlord Name: ${ej.landlordName}`,
      `Landlord ID: ${ej.landlordIdNo}`,
      ``,
      `Building: ${ej.buildingName}`,
      `Unit: ${ej.unitName}`,
      `Annual Rent: ${Number(ej.rentAmount).toLocaleString()} SAR`,
      `Payment Frequency: ${ej.paymentFrequency}`,
      `Start Date: ${ej.startDate}`,
      `End Date: ${ej.endDate}`,
      linkedContract ? `Contract No: ${linkedContract.contractNo}` : '',
      linkedContract ? `Installments: ${linkedContract.installmentCount}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    showSuccess('Contract details copied — paste into Ejar portal');
  };

  // ── Bulk create Pending records for unregistered contracts ──
  const registerAllUnregistered = async () => {
    if (unregisteredContracts.length === 0) { showWarning('All active contracts already have Ejar records'); return; }
    let count = 0;
    for (const c of unregisteredContracts) {
      const customer = customers.find(cu => cu.id === c.customerId);
      await saveEjarContract({
        id: crypto.randomUUID(),
        contractId: c.id,
        ejarNumber: '',
        registrationDate: new Date().toISOString().slice(0, 10),
        status: 'Pending',
        tenantIdNo: customer?.idNo || '',
        tenantName: c.customerName,
        landlordIdNo: '',
        landlordName: '',
        buildingId: c.buildingId,
        buildingName: c.buildingName,
        unitName: c.unitName,
        rentAmount: c.rentValue,
        startDate: c.fromDate,
        endDate: c.toDate,
        paymentFrequency: 'Yearly',
        notes: 'Auto-created — register on Ejar portal and update Ejar number',
        lastSyncDate: new Date().toISOString(),
        createdAt: Date.now(),
      });
      count++;
    }
    showSuccess(`Created ${count} pending Ejar record(s) — open each to copy details to Ejar portal`);
    load();
  };

  // ── Import from Ejar → creates local contract + Ejar record ──
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    if (!importData.ejarNumber.trim()) { showError('Ejar contract number is required'); return; }
    if (!importData.tenantName.trim()) { showError('Tenant name is required'); return; }
    if (!importData.buildingId) { showError('Building is required'); return; }
    if (!importData.startDate || !importData.endDate) { showError('Start and end dates are required'); return; }

    const duplicateEjar = ejarContracts.find(x =>
      textOrEmpty(x.ejarNumber).toLowerCase() === textOrEmpty(importData.ejarNumber).toLowerCase()
    );
    if (duplicateEjar) { showError(`Ejar number "${importData.ejarNumber}" already exists`); return; }

    const building = buildings.find(b => b.id === importData.buildingId);
    const customer = customers.find(c => c.idNo === importData.tenantIdNo);

    const start = new Date(importData.startDate);
    const end = new Date(importData.endDate);
    const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    const rentAmount = Number(importData.rentAmount) || 0;
    const installmentCount = Number(importData.installmentCount) || 2;
    const perInstallment = installmentCount > 0 ? Math.round(rentAmount / installmentCount) : rentAmount;

    const existingNos = localContracts.map(c => parseInt(c.contractNo || '0', 10)).filter(n => !isNaN(n));
    const nextNo = existingNos.length > 0 ? String(Math.max(...existingNos) + 1) : '1';

    const newContract: Contract = {
      id: crypto.randomUUID(),
      contractNo: nextNo,
      contractDate: new Date().toISOString().slice(0, 10),
      status: 'Active',
      buildingId: importData.buildingId,
      buildingName: building?.name || '',
      unitName: importData.unitName || '',
      customerId: customer?.id || '',
      customerName: importData.tenantName,
      rentValue: rentAmount,
      waterFee: 0, internetFee: 0, insuranceFee: 0, serviceFee: 0,
      officePercent: 2.5,
      officeFeeAmount: Math.round(rentAmount * 0.025),
      otherDeduction: 0, otherAmount: 0,
      totalValue: rentAmount,
      installmentCount,
      firstInstallment: perInstallment,
      otherInstallment: perInstallment,
      periodMonths: monthsDiff || 12,
      fromDate: importData.startDate,
      toDate: importData.endDate,
      notes: `Imported from Ejar #${importData.ejarNumber}`,
      createdBy: 'ejar-import',
    } as Contract;

    try {
      await saveContract(newContract);
      const ejarDraft: EjarContract = {
        id: crypto.randomUUID(),
        contractId: newContract.id,
        ejarNumber: importData.ejarNumber,
        registrationDate: new Date().toISOString().slice(0, 10),
        status: 'Registered',
        tenantIdNo: importData.tenantIdNo || '',
        tenantName: importData.tenantName,
        landlordIdNo: importData.landlordIdNo || '',
        landlordName: importData.landlordName || '',
        buildingId: importData.buildingId,
        buildingName: building?.name || '',
        unitName: importData.unitName || '',
        rentAmount,
        startDate: importData.startDate,
        endDate: importData.endDate,
        paymentFrequency: importData.paymentFrequency || 'Yearly',
        notes: importData.notes || '',
        lastSyncDate: new Date().toISOString(),
        createdAt: Date.now(),
      };
      ejarDraft.status = deriveStatus(ejarDraft);
      await saveEjarContract(ejarDraft);
      showSuccess(`Imported! Local contract #${nextNo} created & linked to Ejar #${importData.ejarNumber}`);
      setIsImportOpen(false);
      setImportData({
        ejarNumber: '', tenantName: '', tenantIdNo: '',
        landlordName: '', landlordIdNo: '', buildingId: '',
        unitName: '', rentAmount: 0, startDate: '', endDate: '',
        paymentFrequency: 'Yearly', installmentCount: 2, notes: '',
      });
      load();
    } catch (err: any) {
      showError(err?.message || 'Failed to import Ejar contract');
    }
  };

  // ── Sync from local ──
  const syncFromLocal = async (ej: EjarContract) => {
    const c = localContracts.find(ct => ct.id === ej.contractId);
    if (!c) { showError('No linked local contract found'); return; }
    const customer = customers.find(cu => cu.id === c.customerId);
    const next: EjarContract = {
      ...ej,
      tenantName: c.customerName,
      tenantIdNo: customer?.idNo || ej.tenantIdNo,
      buildingName: c.buildingName,
      unitName: c.unitName,
      rentAmount: c.rentValue,
      startDate: c.fromDate,
      endDate: c.toDate,
      lastSyncDate: new Date().toISOString(),
    };
    next.status = ej.status === 'Terminated' ? 'Terminated' : deriveStatus(next);
    await saveEjarContract(next);
    showSuccess('Ejar record synced with local contract data');
    load();
  };

  // ── Merge duplicates ──
  const mergeDuplicateGroup = async (groupRows: EjarContract[]) => {
    const [primary, ...duplicates] = groupRows;
    const merged: EjarContract = { ...primary };
    for (const d of duplicates) {
      merged.contractId = merged.contractId || d.contractId;
      merged.ejarNumber = merged.ejarNumber || d.ejarNumber;
      merged.tenantName = merged.tenantName || d.tenantName;
      merged.tenantIdNo = merged.tenantIdNo || d.tenantIdNo;
      merged.landlordName = merged.landlordName || d.landlordName;
      merged.landlordIdNo = merged.landlordIdNo || d.landlordIdNo;
      merged.buildingId = merged.buildingId || d.buildingId;
      merged.buildingName = merged.buildingName || d.buildingName;
      merged.unitName = merged.unitName || d.unitName;
      merged.startDate = merged.startDate || d.startDate;
      merged.endDate = merged.endDate || d.endDate;
      merged.registrationDate = merged.registrationDate || d.registrationDate;
      merged.paymentFrequency = merged.paymentFrequency || d.paymentFrequency;
      merged.notes = merged.notes || d.notes;
      if (!merged.rentAmount && d.rentAmount) merged.rentAmount = d.rentAmount;
      const a = statusPriority[(merged.status || 'Pending') as EjarStatus] ?? 0;
      const b = statusPriority[(d.status || 'Pending') as EjarStatus] ?? 0;
      if (b > a) merged.status = d.status;
    }
    merged.lastSyncDate = new Date().toISOString();
    merged.status = merged.status === 'Terminated' ? 'Terminated' : deriveStatus(merged);
    await saveEjarContract(merged);
    await Promise.all(duplicates.map(d => deleteEjarContract(d.id)));
  };

  const handleMergeAllDuplicates = async () => {
    if (duplicateGroups.length === 0) { showWarning('No duplicates found'); return; }
    try {
      let removed = 0;
      for (const g of duplicateGroups) { removed += g.rows.length - 1; await mergeDuplicateGroup(g.rows); }
      showSuccess(`Merged duplicate groups. Removed ${removed} duplicate record(s).`);
      setIsDupModalOpen(false);
      await load();
    } catch (err: any) {
      showError(err?.message || 'Failed to merge duplicates');
    }
  };

  // ── Bulk status update ──
  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus) { showWarning('Select a status first'); return; }
    if (filtered.length === 0) { showWarning('No rows match current filters'); return; }
    try {
      await Promise.all(filtered.map(row =>
        saveEjarContract({ ...row, status: bulkStatus, lastSyncDate: new Date().toISOString() })
      ));
      showSuccess(`Updated ${filtered.length} record(s) to ${bulkStatus}`);
      await load();
    } catch (err: any) {
      showError(err?.message || 'Failed bulk status update');
    }
  };

  // ── CSV Export ──
  const handleExportFilteredCsv = () => {
    if (filtered.length === 0) { showWarning('No records to export'); return; }
    const headers = ['EjarNumber', 'Status', 'Tenant', 'TenantID', 'Building', 'Unit', 'RentAmount', 'StartDate', 'EndDate', 'Frequency', 'LinkedContractId'];
    const rows = filtered.map(r => [
      r.ejarNumber || '',
      r.status || '',
      r.tenantName || '',
      r.tenantIdNo || '',
      r.buildingName || '',
      r.unitName || '',
      String(Number(r.rentAmount || 0)),
      r.startDate || '',
      r.endDate || '',
      r.paymentFrequency || '',
      r.contractId || '',
    ]);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ejar_filtered_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Filtered Ejar list exported');
  };

  const resetFilters = () => {
    setSearch(''); setFilterStatus(''); setFilterBuildingId('');
    setFilterFrequency(''); setFilterLink('ALL'); setSortBy('UNIT_ASC');
  };

  // ── Render ──
  return (
    <div className="px-3 sm:px-6 pt-2 pb-8 animate-fade-in">
      {/* ───────────── Hero Header ───────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white p-6 sm:p-8 mb-6 shadow-xl shadow-emerald-600/20">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-white/5 rounded-full blur-3xl" />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
              <FileSignature size={28} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Ejar Integration</h1>
                <span className="text-sm font-medium text-white/70">إيجار</span>
              </div>
              <p className="text-sm text-white/80 mt-1">Manage Saudi rental registrations, link local contracts, and stay compliant.</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExportFilteredCsv}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={() => setIsImportOpen(true)}
              className="px-3 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/25 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all"
            >
              <ArrowRightLeft size={14} /> Import from Ejar
            </button>
            <button
              onClick={() => { setFormData({ ...emptyForm }); setEditId(null); setIsFormOpen(true); }}
              className="px-4 py-2 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-900/20 transition-all"
            >
              <Plus size={16} /> Register Contract
            </button>
          </div>
        </div>
      </div>

      {/* ───────────── KPIs ───────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <KpiCard label="Total Records" value={stats.total} icon={<FileSignature size={18} />} tone="slate" />
        <KpiCard label="Active" value={stats.active} icon={<CheckCircle2 size={18} />} tone="emerald" />
        <KpiCard label="Registered" value={stats.registered} icon={<Link2 size={18} />} tone="blue" />
        <KpiCard label="Pending" value={stats.pending} icon={<Clock size={18} />} tone="amber" />
        <KpiCard label="Unregistered" value={stats.unregistered} icon={<AlertTriangle size={18} />} tone="rose" />
      </div>

      {/* ───────────── Alerts ───────────── */}
      {stats.unregistered > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-amber-500 text-white rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-amber-900">{stats.unregistered} active contract(s) not registered on Ejar</p>
              <p className="text-sm text-amber-700 mt-0.5">Saudi law requires all rental contracts to be registered on the Ejar platform.</p>
              <div className="mt-2 space-y-0.5">
                {unregisteredContracts.slice(0, 3).map(c => (
                  <p key={c.id} className="text-xs text-amber-800">
                    • #{c.contractNo} — {formatCustomerFromMap(c.customerName, c.customerId, customerRoomMap)} ({c.buildingName}/{c.unitName})
                  </p>
                ))}
                {unregisteredContracts.length > 3 && (
                  <p className="text-xs text-amber-600">... and {unregisteredContracts.length - 3} more</p>
                )}
              </div>
              <button
                onClick={registerAllUnregistered}
                className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Upload size={12} /> Create Pending Records for All ({stats.unregistered})
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicateCollapsedCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 mb-4 text-xs text-rose-800 flex items-center justify-between gap-3 shadow-sm">
          <span className="font-medium">
            Detected {duplicateCollapsedCount} duplicate Ejar record(s) — displayed once in the list.
          </span>
          <button
            type="button"
            onClick={() => setIsDupModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-all"
          >
            Review & Merge
          </button>
        </div>
      )}

      {/* ───────────── Filters Card ───────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm">
        {/* Status Segmented Chips */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <button
            onClick={() => setFilterStatus('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filterStatus === '' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All <span className="ml-1 opacity-70">{stats.total}</span>
          </button>
          {ALL_STATUSES.map(s => {
            const count = dedupedEjarContracts.filter(e => e.status === s).length;
            const isActive = filterStatus === s;
            const style = STATUS_STYLES[s];
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(isActive ? '' : s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  isActive ? `${style.chip} ring-2 ring-offset-1 ring-current/30` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                {style.label} <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
          <div className="flex-1" />
          <button
            onClick={() => setShowFilters(v => !v)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 flex items-center gap-1.5"
          >
            <SlidersHorizontal size={12} /> Filters <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Search always visible */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by tenant, Ejar number, building or unit..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 outline-none transition-all"
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Building">
              <select value={filterBuildingId} onChange={e => setFilterBuildingId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-200 outline-none">
                <option value="">All Buildings</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Frequency">
              <select value={filterFrequency} onChange={e => setFilterFrequency(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-200 outline-none">
                <option value="">All Frequencies</option>
                {['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Link">
              <select value={filterLink} onChange={e => setFilterLink(e.target.value as any)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-200 outline-none">
                <option value="ALL">All Links</option>
                <option value="LINKED">Linked to Local Contract</option>
                <option value="UNLINKED">Unlinked</option>
              </select>
            </Field>
            <Field label="Sort">
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-200 outline-none">
                <option value="UNIT_ASC">Room/Unit A-Z</option>
                <option value="UNIT_DESC">Room/Unit Z-A</option>
                <option value="TENANT_ASC">Tenant A-Z</option>
                <option value="RENT_DESC">Rent (High → Low)</option>
                <option value="LATEST_SYNC">Latest Sync First</option>
              </select>
            </Field>
          </div>
        )}

        {/* Summary + Bulk Actions */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
          >
            Reset Filters
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <span className="text-xs text-slate-600">
            Showing <b className="text-slate-900">{filtered.length}</b> of <b className="text-slate-900">{stats.total}</b>
            <span className="mx-2 text-slate-300">|</span>
            Total Rent: <b className="text-emerald-700">{filteredRentTotal.toLocaleString()} SAR</b>
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as any)} className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold">
              <option value="">Bulk status...</option>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_STYLES[s].label}</option>)}
            </select>
            <button
              type="button"
              onClick={handleBulkStatusUpdate}
              disabled={!bulkStatus || filtered.length === 0}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Apply to {filtered.length}
            </button>
          </div>
        </div>
      </div>

      {/* ───────────── List ───────────── */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <FileSignature size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold">No Ejar records match your filters</p>
          <button onClick={resetFilters} className="mt-3 text-xs font-bold text-emerald-600 hover:text-emerald-700">Reset filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(ej => {
            const linkedContract = localContracts.find(c => c.id === ej.contractId);
            const style = STATUS_STYLES[ej.status as EjarStatus] || STATUS_STYLES.Pending;
            return (
              <div
                key={ej.id}
                className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                {/* Top accent stripe */}
                <div className={`h-1 w-full bg-gradient-to-r ${style.stripe}`} />

                <div className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${style.chip} flex items-center gap-1`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {style.label}
                      </span>
                      {ej.ejarNumber ? (
                        <span className="font-mono text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                          #{ej.ejarNumber}
                        </span>
                      ) : (
                        <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
                          No Ejar # yet
                        </span>
                      )}
                      {linkedContract && (
                        <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Link2 size={10} /> Contract #{linkedContract.contractNo}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-slate-900">
                        {Number(ej.rentAmount || 0).toLocaleString()} <span className="text-[10px] font-bold text-slate-400 uppercase">SAR/yr</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">{ej.paymentFrequency}</div>
                    </div>
                  </div>

                  {/* Main body */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                      <User size={18} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{ej.tenantName || 'Unnamed Tenant'}</h3>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Building2 size={12} />
                        <span className="truncate">{ej.buildingName || 'No Building'} {ej.unitName ? `· ${ej.unitName}` : ''}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1 font-mono">
                        <Calendar size={11} />
                        {ej.startDate || '—'} → {ej.endDate || '—'}
                      </div>
                      {ej.tenantIdNo && (
                        <div className="text-[11px] text-slate-400 mt-0.5 font-mono">ID: {ej.tenantIdNo}</div>
                      )}
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[10px] text-slate-400">
                      {ej.lastSyncDate ? <>Synced: {ej.lastSyncDate.slice(0, 10)}</> : 'Not synced yet'}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => copyToClipboard(ej)} title="Copy details for Ejar portal" className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"><Copy size={14} /></button>
                      {linkedContract && (
                        <button onClick={() => syncFromLocal(ej)} title="Sync from local contract" className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><RefreshCw size={14} /></button>
                      )}
                      <button onClick={() => handleEdit(ej)} title="Edit" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(ej.id)} title="Delete" className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───────────── Modal: Register / Edit ───────────── */}
      {isFormOpen && (
        <Modal onClose={() => setIsFormOpen(false)} title={editId ? 'Edit Ejar Registration' : 'New Ejar Registration'} icon={<FileSignature size={18} />}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1.5">Link to Local Contract (auto-fills fields)</label>
              <select
                value={formData.contractId || ''}
                onChange={e => linkContract(e.target.value)}
                className="w-full border border-emerald-300 rounded-xl px-3 py-2 text-sm bg-white font-semibold"
              >
                <option value="">Select Contract</option>
                {localContracts.filter(c => c.status === 'Active').map(c => (
                  <option key={c.id} value={c.id}>
                    #{c.contractNo} — {formatCustomerFromMap(c.customerName, c.customerId, customerRoomMap)} ({c.buildingName}/{c.unitName})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Ejar Number">
                <input type="text" value={formData.ejarNumber} onChange={e => setFormData({ ...formData, ejarNumber: e.target.value })} className="modal-input" placeholder="EJ-12345678" />
              </Field>
              <Field label="Status">
                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="modal-input">
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_STYLES[s].label}</option>)}
                </select>
              </Field>
              <Field label="Tenant Name *">
                <input type="text" value={formData.tenantName} onChange={e => setFormData({ ...formData, tenantName: e.target.value })} className="modal-input" required />
              </Field>
              <Field label="Tenant ID No">
                <input type="text" value={formData.tenantIdNo} onChange={e => setFormData({ ...formData, tenantIdNo: e.target.value })} className="modal-input" />
              </Field>
              <Field label="Landlord Name">
                <input type="text" value={formData.landlordName} onChange={e => setFormData({ ...formData, landlordName: e.target.value })} className="modal-input" />
              </Field>
              <Field label="Landlord ID No">
                <input type="text" value={formData.landlordIdNo} onChange={e => setFormData({ ...formData, landlordIdNo: e.target.value })} className="modal-input" />
              </Field>
              <Field label={t('entry.building')}>
                <input type="text" value={formData.buildingName || ''} onChange={e => setFormData({ ...formData, buildingName: e.target.value })} className="modal-input" />
              </Field>
              <Field label={t('entry.unit')}>
                <input type="text" value={formData.unitName || ''} onChange={e => setFormData({ ...formData, unitName: e.target.value })} className="modal-input" />
              </Field>
              <Field label="Rent Amount (SAR/yr)">
                <input type="number" value={formData.rentAmount} onChange={e => setFormData({ ...formData, rentAmount: e.target.value })} className="modal-input" min={0} />
              </Field>
              <Field label="Payment Frequency">
                <select value={formData.paymentFrequency} onChange={e => setFormData({ ...formData, paymentFrequency: e.target.value })} className="modal-input">
                  {['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label={t('contract.startDate')}>
                <input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="modal-input" />
              </Field>
              <Field label={t('contract.endDate')}>
                <input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="modal-input" />
              </Field>
              <Field label="Registration Date">
                <input type="date" value={formData.registrationDate} onChange={e => setFormData({ ...formData, registrationDate: e.target.value })} className="modal-input" />
              </Field>
            </div>

            <Field label={t('common.notes')}>
              <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="modal-input" rows={2} />
            </Field>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">{t('common.cancel')}</button>
              <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-200">{t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ───────────── Modal: Import ───────────── */}
      {isImportOpen && (
        <Modal onClose={() => setIsImportOpen(false)} title="Import from Ejar" icon={<ArrowRightLeft size={18} className="text-blue-600" />}>
          <p className="text-xs text-slate-500 mb-3">Enter the contract details from the Ejar platform. This will create <b>both</b> an Ejar record and a local Amlak contract, fully linked.</p>
          <form onSubmit={handleImport} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Paste the details from the Ejar portal</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Ejar Contract Number *"><input type="text" value={importData.ejarNumber} onChange={e => setImportData({ ...importData, ejarNumber: e.target.value })} className="modal-input" placeholder="EJ-12345678" required /></Field>
              <Field label="Tenant Name *"><input type="text" value={importData.tenantName} onChange={e => setImportData({ ...importData, tenantName: e.target.value })} className="modal-input" required /></Field>
              <Field label="Tenant ID No"><input type="text" value={importData.tenantIdNo} onChange={e => setImportData({ ...importData, tenantIdNo: e.target.value })} className="modal-input" /></Field>
              <Field label="Landlord Name"><input type="text" value={importData.landlordName} onChange={e => setImportData({ ...importData, landlordName: e.target.value })} className="modal-input" /></Field>
              <Field label="Landlord ID No"><input type="text" value={importData.landlordIdNo} onChange={e => setImportData({ ...importData, landlordIdNo: e.target.value })} className="modal-input" /></Field>
              <Field label="Building *">
                <select value={importData.buildingId} onChange={e => setImportData({ ...importData, buildingId: e.target.value })} className="modal-input" required>
                  <option value="">Select Building</option>
                  {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label={t('building.unitName')}><input type="text" value={importData.unitName} onChange={e => setImportData({ ...importData, unitName: e.target.value })} className="modal-input" /></Field>
              <Field label="Annual Rent (SAR) *"><input type="number" value={importData.rentAmount || ''} onChange={e => setImportData({ ...importData, rentAmount: e.target.value })} className="modal-input" min={0} required /></Field>
              <Field label="Start Date *"><input type="date" value={importData.startDate} onChange={e => setImportData({ ...importData, startDate: e.target.value })} className="modal-input" required /></Field>
              <Field label="End Date *"><input type="date" value={importData.endDate} onChange={e => setImportData({ ...importData, endDate: e.target.value })} className="modal-input" required /></Field>
              <Field label="Payment Frequency">
                <select value={importData.paymentFrequency} onChange={e => setImportData({ ...importData, paymentFrequency: e.target.value })} className="modal-input">
                  {['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label={t('contract.installments')}>
                <input type="number" value={importData.installmentCount || 2} onChange={e => setImportData({ ...importData, installmentCount: e.target.value })} className="modal-input" min={1} />
              </Field>
            </div>
            <Field label={t('common.notes')}>
              <textarea value={importData.notes || ''} onChange={e => setImportData({ ...importData, notes: e.target.value })} className="modal-input" rows={2} />
            </Field>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setIsImportOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">{t('common.cancel')}</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 flex items-center gap-1.5 shadow-sm shadow-blue-200">
                <ArrowRightLeft size={14} /> Import & Create Contract
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ───────────── Modal: Duplicates ───────────── */}
      {isDupModalOpen && (
        <Modal onClose={() => setIsDupModalOpen(false)} title="Duplicate Ejar Records" icon={<AlertTriangle size={18} className="text-rose-600" />} size="lg">
          {duplicateGroups.length === 0 ? (
            <p className="text-sm text-slate-500">No duplicate groups found.</p>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-3">
                Found <b>{duplicateGroups.length}</b> duplicate group(s). Merging keeps the newest record and deletes the rest after combining missing values.
              </p>
              <div className="space-y-3 mb-4">
                {duplicateGroups.map((g) => (
                  <div key={g.key} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Key: {g.key} · {g.rows.length} rows</div>
                    <div className="space-y-1">
                      {g.rows.map((r, idx) => (
                        <div key={r.id} className={`text-xs px-3 py-2 rounded-lg border ${idx === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                          <b>{idx === 0 ? '✓ Keep' : '✗ Remove'}</b> — {r.tenantName || 'Unnamed'} | {r.buildingName || '-'} / {r.unitName || '-'} | Ejar#: {r.ejarNumber || '-'}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsDupModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Close</button>
                <button type="button" onClick={handleMergeAllDuplicates} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 shadow-sm shadow-rose-200">Merge All Duplicates</button>
              </div>
            </>
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t('common.confirm')}
        message={confirmMsg}
        onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
        danger
      />

      {/* Scoped helper styles (applied via className) */}
      <style>{`
        .modal-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          outline: none;
          transition: all 0.15s ease;
        }
        .modal-input:focus {
          background: white;
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
        }
      `}</style>
    </div>
  );
};

/* ───────────── Small Presentational Components ───────────── */

const KpiCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode; tone: 'slate' | 'emerald' | 'blue' | 'amber' | 'rose' }> = ({ label, value, icon, tone }) => {
  const tones: Record<string, { bg: string; text: string; icon: string; border: string }> = {
    slate:   { bg: 'bg-slate-50',   text: 'text-slate-900',   icon: 'bg-slate-100 text-slate-700',     border: 'border-slate-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-900', icon: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-900',    icon: 'bg-blue-100 text-blue-700',       border: 'border-blue-200' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-900',   icon: 'bg-amber-100 text-amber-700',     border: 'border-amber-200' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-900',    icon: 'bg-rose-100 text-rose-700',       border: 'border-rose-200' },
  };
  const s = tones[tone];
  return (
    <div className={`${s.bg} border ${s.border} rounded-2xl p-4 shadow-sm hover:shadow-md transition-all`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
          <div className={`text-3xl font-black mt-1 ${s.text}`}>{value}</div>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.icon}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</label>
    {children}
  </div>
);

const Modal: React.FC<{ onClose: () => void; title: string; icon?: React.ReactNode; size?: 'md' | 'lg'; children: React.ReactNode }> = ({ onClose, title, icon, size = 'md', children }) => (
  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-[6vh] overflow-y-auto" onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div className={`bg-white rounded-3xl w-full ${size === 'lg' ? 'max-w-3xl' : 'max-w-2xl'} shadow-2xl border border-slate-100 overflow-hidden animate-scale-in`}>
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <X size={18} />
        </button>
      </div>
      <div className="p-6 max-h-[80vh] overflow-y-auto">
        {children}
      </div>
    </div>
  </div>
);

export default EjarIntegration;
