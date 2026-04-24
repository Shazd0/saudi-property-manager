
import React, { useState, useEffect, useMemo } from 'react';
import { Building, BuildingUnit, BuildingLease, ExpenseCategory, TransactionType, Transaction } from '../types';
import { getBuildings, saveBuilding, deleteBuilding, getBanks, getContracts, getTransactions, cascadeUnitRename, transferBuildingToBook } from '../services/firestoreService';
import { Building as BuildingIcon, Plus, Trash2, Home, Save, Edit2, X, AlertCircle, PlusCircle, RotateCcw, Search, CalendarDays, DollarSign, ShieldAlert, FileKey, Clock, CheckCircle2, Circle, ArrowRightLeft } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';
import { useBook } from '../contexts/BookContext';

const BuildingManager: React.FC = () => {
    const { t, isRTL } = useLanguage();
    const { showSuccess, showError } = useToast();
    const { activeBookId, books } = useBook();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [view, setView] = useState<'LIST' | 'EDIT'>('LIST');
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);

  // Transfer state
  const [transferBuilding, setTransferBuilding] = useState<Building | null>(null);
  const [transferTargetBookId, setTransferTargetBookId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState('');
  
    // New Building State
    const [newBuildingName, setNewBuildingName] = useState('');
    const [newBuildingBank, setNewBuildingBank] = useState('');
    const [newBuildingIban, setNewBuildingIban] = useState('');
    const [banks, setBanks] = useState<any[]>([]);
    const [newPropertyType, setNewPropertyType] = useState<'RESIDENTIAL' | 'NON_RESIDENTIAL'>('RESIDENTIAL');
    const [newVatApplicable, setNewVatApplicable] = useState(false);
  
  // Unit Form State
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitRent, setNewUnitRent] = useState<number>(0);
  const [newUnitMeter, setNewUnitMeter] = useState('');
  const [editingUnitIndex, setEditingUnitIndex] = useState<number | null>(null);
  const [unitSearch, setUnitSearch] = useState('');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
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

    useEffect(() => { (async () => { setBuildings(await getBuildings({ includeDeleted: true }) || []); setBanks(await getBanks() || []); setAllTransactions(await getTransactions() || []); })(); }, []);

    const loadBuildings = async () => {
        const fresh = await getBuildings({ includeDeleted: true }) || [];
        setBuildings(fresh);
        setAllTransactions(await getTransactions() || []);
        // Keep editingBuilding in sync with fresh Firestore data
        setEditingBuilding(prev => {
            if (!prev) return null;
            const updated = fresh.find(b => b.id === prev.id);
            return updated ? { ...updated } : null;
        });
    };

    const handleAddBuilding = async (e: React.FormEvent) => {
        e.preventDefault();
        SoundService.play('submit');
        if (!newBuildingName.trim()) return;
        // Check for duplicate building name
        const duplicateName = buildings.find(b => 
          b.name.toLowerCase() === newBuildingName.trim().toLowerCase()
        );
        if (duplicateName) {
            showError(`Building name "${newBuildingName}" already exists!`);
            return;
        }
        const newBuilding: Building = {
            id: crypto.randomUUID(),
            name: newBuildingName,
            units: [],
            bankName: newBuildingBank || undefined,
            iban: newBuildingIban || undefined,
            propertyType: newPropertyType,
            vatApplicable: newPropertyType === 'NON_RESIDENTIAL' ? newVatApplicable : false
        };
        await saveBuilding(newBuilding);
        setNewBuildingName('');
        setNewBuildingBank('');
        setNewBuildingIban('');
        setNewPropertyType('RESIDENTIAL');
        setNewVatApplicable(false);
        await loadBuildings();
    };

    const handleDeleteBuilding = async (id: string) => {
        openConfirm('Move building to trash?', async () => {
            const building = buildings.find(b => b.id === id);
            if (building) {
                const updated = { ...building, deleted: true, deletedAt: Date.now() } as any;
                await saveBuilding(updated);
                await loadBuildings();
                if (editingBuilding?.id === id) {
                    setView('LIST');
                    setEditingBuilding(null);
                }
            }
            closeConfirm();
        });
    };

    const handleRestoreBuilding = async (id: string) => {
        openConfirm('Restore this building?', async () => {
            const building = buildings.find(b => b.id === id);
            if (building) {
                const updated = { ...building, deleted: false, deletedAt: undefined } as any;
                await saveBuilding(updated);
                await loadBuildings();
            }
            closeConfirm();
        });
    };

    const handlePermanentDeleteBuilding = async (id: string) => {
                openConfirm('PERMANENTLY delete building? This cannot be undone!', async () => {
                        await deleteBuilding(id);
                        await loadBuildings();
                        if (editingBuilding?.id === id) {
                                setView('LIST');
                                setEditingBuilding(null);
                        }
                        closeConfirm();
                }, { danger: true, title: 'Delete Building' });
    };

    const handleRestoreAll = () => {
        const deleted = buildings.filter(b => (b as any).deleted);
        if (deleted.length === 0) return;
        openConfirm(`Restore all ${deleted.length} trashed buildings?`, async () => {
            try {
                await Promise.all(deleted.map(b => saveBuilding({ ...b, deleted: false, deletedAt: undefined } as any)));
                showSuccess('All trashed buildings restored.');
                await loadBuildings();
            } catch (e) {
                console.error('Restore all buildings failed', e);
                showError('Failed to restore all buildings');
            }
            closeConfirm();
        });
    };

    const handleDeleteAll = () => {
        const deleted = buildings.filter(b => (b as any).deleted);
        if (deleted.length === 0) return;
        openConfirm(`PERMANENTLY delete all ${deleted.length} trashed buildings? This cannot be undone!`, async () => {
            try {
                await Promise.all(deleted.map(b => deleteBuilding(b.id)));
                showSuccess('All trashed buildings permanently deleted.');
                await loadBuildings();
            } catch (e) {
                console.error('Delete all buildings failed', e);
                showError('Failed to delete all buildings');
            }
            closeConfirm();
        }, { danger: true, title: 'Delete All Buildings' });
    };

  const startEdit = (b: Building) => {
    setEditingBuilding({ ...b });
    setView('EDIT');
  };

  const handleTransferBuilding = async () => {
    if (!transferBuilding || !transferTargetBookId) return;
    setIsTransferring(true);
    setTransferProgress('Starting transfer...');
    try {
      const result = await transferBuildingToBook(
        transferBuilding.id,
        activeBookId,
        transferTargetBookId,
        (msg) => setTransferProgress(msg)
      );
      const counts = Object.entries(result.transferred)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');
      showSuccess(`Building transferred successfully. Moved: ${counts || 'building record'}.`);
      if (result.errors.length > 0) {
        showError(`Some collections had errors: ${result.errors.join('; ')}`);
      }
      setTransferBuilding(null);
      setTransferTargetBookId('');
      setTransferProgress('');
      await loadBuildings();
    } catch (e: any) {
      showError(`Transfer failed: ${e?.message || String(e)}`);
    } finally {
      setIsTransferring(false);
    }
  };

  const getNextUnitSuggestion = (currentUnit: string): string => {
    const match = currentUnit.match(/^([A-Za-z]+)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10) + 1;
      return `${prefix}${num}`;
    }
    const numOnly = currentUnit.match(/(\d+)/);
    if (numOnly) {
      return String(parseInt(numOnly[1], 10) + 1);
    }
    return currentUnit || '1';
  };

  const handleAddUnit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingBuilding) return;
      if (!newUnitName.trim()) return;
      // Prevent duplicate unit names
      const duplicate = editingBuilding.units.some((u, i) => 
          u.name.toLowerCase() === newUnitName.trim().toLowerCase() && i !== editingUnitIndex
      );
      if (duplicate) {
          showError(`Unit "${newUnitName.trim()}" already exists in this building.`);
          return;
      }
      const updatedUnits = [...editingBuilding.units];
      const oldUnitName = editingUnitIndex !== null ? editingBuilding.units[editingUnitIndex]?.name : null;
      if (editingUnitIndex !== null) {
          updatedUnits[editingUnitIndex] = { name: newUnitName.trim(), defaultRent: newUnitRent || 0, meterNumber: newUnitMeter.trim() } as BuildingUnit;
      } else {
          updatedUnits.push({ name: newUnitName.trim(), defaultRent: newUnitRent || 0, meterNumber: newUnitMeter.trim() } as BuildingUnit);
      }
      const updatedBuilding = { ...editingBuilding, units: updatedUnits };
      setEditingBuilding(updatedBuilding);
      await saveBuilding(updatedBuilding);
      // Cascade rename across contracts, transactions, stock entries
      if (editingUnitIndex !== null && oldUnitName && oldUnitName !== newUnitName.trim()) {
          try {
              const counts = await cascadeUnitRename(editingBuilding.id, oldUnitName, newUnitName.trim());
              const total = counts.contracts + counts.transactions + counts.stockEntries;
              if (total > 0) {
                  showSuccess(`Unit renamed: updated ${counts.contracts} contract(s), ${counts.transactions} transaction(s), ${counts.stockEntries} stock record(s).`);
              }
          } catch (err) {
              console.error('Cascade rename error', err);
              showError('Unit saved but some linked records could not be updated. Please check contracts and transactions.');
          }
      }
      if (editingUnitIndex !== null) {
          // After editing: clear the form
          setNewUnitName('');
          setNewUnitRent(0);
          setNewUnitMeter('');
      } else {
          // After adding: suggest next unit number for rapid entry
          const suggestion = getNextUnitSuggestion(newUnitName.trim());
          setNewUnitName(suggestion);
          // Keep the same rent for convenience
      }
      setEditingUnitIndex(null);
      await loadBuildings();
  };

  const handleEditUnit = (unit: BuildingUnit) => {
      if (!editingBuilding) return;
      const originalIndex = editingBuilding.units.findIndex(u => u.name === unit.name);
      if (originalIndex === -1) return;
      setNewUnitName(unit.name);
      setNewUnitRent(unit.defaultRent);
      setNewUnitMeter(unit.meterNumber || '');
      setEditingUnitIndex(originalIndex);
  };

  const handleCancelEdit = () => {
      setNewUnitName('');
      setNewUnitRent(0);
      setNewUnitMeter('');
      setEditingUnitIndex(null);
  };

  const handleDeleteUnit = async (unit: BuildingUnit) => {
    if (!editingBuilding) return;
    
    const unitName = unit.name;
    
    // Check if unit has ever been used in any contract (exact name match)
    const allContracts = await getContracts();
    const unitInUse = allContracts?.some(c => 
      c.buildingId === editingBuilding.id && 
      (c.unitName === unitName || (c.unitName && c.unitName.split(', ').includes(unitName)))
    );
    
    if (unitInUse) {
            showError(`Cannot delete unit "${unitName}" - it has been used in one or more contracts. Units with contract history cannot be deleted to maintain data integrity.`);
      return;
    }
    
        openConfirm(`Are you sure you want to delete unit "${unitName}"?`, async () => {
            // Re-read editingBuilding fresh from state via functional approach
            // Use unit name as identifier (unique within a building)
            setEditingBuilding(prev => {
                if (!prev) return null;
                const filtered = prev.units.filter(u => u.name !== unitName);
                const updated = { ...prev, units: filtered };
                // Save async (fire and forget within setState, then reload)
                saveBuilding(updated).then(() => loadBuildings());
                return updated;
            });
            // Clear edit form if it was editing the deleted unit
            setEditingUnitIndex(null);
            setNewUnitName('');
            setNewUnitRent(0);
            setNewUnitMeter('');
            closeConfirm();
        }, { danger: true, title: 'Delete Unit' });
  };

  // ---- LEASE HELPERS ----

  // Auto-calculate given amount from Property Rent expense transactions for a building
  const getLeasePayments = (buildingId: string): Transaction[] => {
      return allTransactions.filter(t => 
          t.type === TransactionType.EXPENSE && 
          (t.expenseCategory === ExpenseCategory.PROPERTY_RENT || t.expenseCategory === 'Property Rent') &&
          t.buildingId === buildingId &&
          t.status !== 'REJECTED'
      );
  };

  const calcGivenAmount = (buildingId: string): number => {
      return getLeasePayments(buildingId).reduce((sum, t) => sum + t.amount, 0);
  };

  // Calculate lease duration in months and days
  const calcLeaseDuration = (startDate?: string, endDate?: string): { months: number; days: number; totalDays: number } => {
      if (!startDate || !endDate) return { months: 0, days: 0, totalDays: 0 };
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return { months: 0, days: 0, totalDays: 0 };
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
      let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      const tempDate = new Date(start);
      tempDate.setMonth(tempDate.getMonth() + months);
      if (tempDate > end) { months--; tempDate.setMonth(tempDate.getMonth() - 1); }
      const days = Math.ceil((end.getTime() - tempDate.getTime()) / 86400000);
      return { months, days, totalDays };
  };

  // Generate rent payment schedule (installments)
  const generateRentSchedule = (lease: BuildingLease, buildingId: string) => {
      if (!lease.leaseStartDate || !lease.totalRent) return [];
      const count = lease.installmentCount || 12;
      const installmentAmt = Math.round((lease.totalRent / count) * 100) / 100;
      const start = new Date(lease.leaseStartDate);
      const payments = getLeasePayments(buildingId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const schedule: { no: number; dueDate: string; amount: number; status: 'paid' | 'overdue' | 'upcoming'; paidAmount: number; paidDate?: string }[] = [];
      let paidIdx = 0;
      let cumPaid = 0;

      const gapMonths = lease.installmentGapMonths || 1;
      for (let i = 0; i < count; i++) {
          const dueDate = new Date(start);
          dueDate.setMonth(dueDate.getMonth() + (i * gapMonths));
          const dueDateStr = dueDate.toISOString().split('T')[0];
          
          // Match payments to installments
          let installmentPaid = 0;
          let paidDate: string | undefined;
          const targetCum = installmentAmt * (i + 1);
          
          while (paidIdx < payments.length && cumPaid + payments[paidIdx].amount <= targetCum + 0.01) {
              cumPaid += payments[paidIdx].amount;
              installmentPaid += payments[paidIdx].amount;
              paidDate = payments[paidIdx].date;
              paidIdx++;
          }
          // Check if partially covered
          if (paidIdx < payments.length && cumPaid < targetCum) {
              const needed = targetCum - cumPaid;
              if (payments[paidIdx].amount >= needed) {
                  installmentPaid += needed;
                  paidDate = payments[paidIdx].date;
              }
          }

          const isPaid = cumPaid >= targetCum - 0.01;
          const isOverdue = !isPaid && dueDate < new Date();
          
          schedule.push({
              no: i + 1,
              dueDate: dueDateStr,
              amount: i === count - 1 ? (lease.totalRent - installmentAmt * (count - 1)) : installmentAmt, // Last installment gets remainder
              status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'upcoming',
              paidAmount: Math.min(installmentPaid, installmentAmt),
              paidDate
          });
      }
      return schedule;
  };

    return (
        <div className="premium-card mobile-tab-shell tab-properties min-h-[600px] animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/30">
        <div>
            <h2 className="text-base sm:text-xl font-black text-slate-800 flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                <BuildingIcon className="text-white" size={20} /> 
            </div>
            {t('building.propertyManagement')}
            </h2>
            <p className="text-slate-500 text-[10px] sm:text-sm mt-1 ml-10 sm:ml-14">{t('building.subtitle')}</p>
        </div>
        
        {view === 'EDIT' && (
             <button 
             onClick={() => setView('LIST')}
             className="px-3 sm:px-4 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs sm:text-sm hover:bg-slate-200 transition-colors w-full sm:w-auto"
           >
             {t('building.backToList')}
           </button>
        )}
      </div>

      <div className="p-4 sm:p-6 md:p-8">
        {view === 'LIST' ? (
          <div className="space-y-4 sm:space-y-6 md:space-y-8">
             {/* Add Building Bar */}
                         <form onSubmit={handleAddBuilding} className="flex flex-col sm:grid sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl border border-slate-100 items-end">
                                <div className="sm:col-span-1 md:col-span-2">
                                        <label className="text-[8px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">{t('building.name')}</label>
                                        <input 
                                             type="text" 
                                             value={newBuildingName}
                                             onChange={e => setNewBuildingName(e.target.value)}
                                             placeholder="e.g. Olaya Center"
                                             className="w-full mt-1 px-2 sm:px-4 py-2 sm:py-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                                        />
                                </div>
                                <div className="sm:col-span-1 md:col-span-1">
                                        <label className="text-[8px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">{t('history.bank')}</label>
                                        <select value={newBuildingBank} onChange={e => { setNewBuildingBank(e.target.value); const found = banks.find(b => b.name === e.target.value); if(found) setNewBuildingIban(found.iban || ''); }} className="w-full mt-1 px-2 sm:px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm">
                                                <option value="">Select</option>
                                                {banks.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                                        </select>
                                </div>
                                <div className="sm:col-span-1 md:col-span-1">
                                        <label className="text-[8px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">{t('entry.iban')}</label>
                                        <input value={newBuildingIban} onChange={e => setNewBuildingIban(e.target.value)} placeholder="SA..." className="w-full mt-1 px-2 sm:px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm" />
                                </div>
                                <div className="sm:col-span-1 md:col-span-1">
                                        <label className="text-[8px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">{t('building.propertyType')}</label>
                                        <select value={newPropertyType} onChange={e => { setNewPropertyType(e.target.value as 'RESIDENTIAL' | 'NON_RESIDENTIAL'); if(e.target.value === 'RESIDENTIAL') setNewVatApplicable(false); }} className="w-full mt-1 px-2 sm:px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm">
                                                <option value="RESIDENTIAL">{t('building.residential')}</option>
                                                <option value="NON_RESIDENTIAL">{t('building.nonResidential')}</option>
                                        </select>
                                </div>
                                {newPropertyType === 'NON_RESIDENTIAL' && (
                                    <div className="sm:col-span-1 md:col-span-1 flex items-center mt-4">
                                        <input id="vatApplicable" type="checkbox" checked={newVatApplicable} onChange={e => setNewVatApplicable(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded mr-2" />
                                        <label htmlFor="vatApplicable" className="text-xs font-bold text-slate-800 cursor-pointer">{t('entry.vat')}</label>
                                    </div>
                                )}
                                <div className="flex gap-2 sm:col-span-2 md:col-span-1 w-full sm:w-auto">
                                    <button 
                                        onClick={() => setShowDeleted(!showDeleted)}
                                        type="button"
                                        className={`px-2 sm:px-4 py-2 rounded-lg font-bold flex items-center gap-1 text-[10px] sm:text-xs flex-1 sm:flex-none ${showDeleted ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600'}`}
                                    >
                                        <Trash2 size={14} /> {showDeleted ? t('common.active') : t('common.trash')}
                                    </button>
                                    {showDeleted && (
                                            <>
                                                    <button type="button" onClick={handleRestoreAll} className="px-2 sm:px-4 py-2 rounded-lg font-bold text-[10px] sm:text-xs flex-1 sm:flex-none bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">{t('history.restoreAll')}</button>
                                                    <button type="button" onClick={handleDeleteAll} className="px-2 sm:px-4 py-2 rounded-lg font-bold text-[10px] sm:text-xs flex-1 sm:flex-none bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100">{t('history.deleteAll')}</button>
                                            </>
                                    )}
                                    <button type="submit" className="pm-btn pm-btn-primary pm-btn-sm flex items-center gap-1 sm:gap-2 flex-1 sm:flex-none whitespace-nowrap">
                                            <Plus size={14} />{t('common.add')}</button>
                                </div>
                         </form>

             {/* Buildings Grid */}
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                {buildings.filter(b => showDeleted ? (b as any).deleted === true : !(b as any).deleted).map(b => (
                    <div key={b.id} onClick={() => !showDeleted && startEdit(b)} className={`group ${showDeleted ? '' : 'cursor-pointer'} premium-card premium-card-interactive p-4 sm:p-5 relative`}>
                        <div className="flex justify-between items-start mb-4">
                             <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                 <BuildingIcon size={24} />
                             </div>
                             <div className="flex gap-2">
                                {showDeleted ? (
                                  <>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleRestoreBuilding(b.id); }}
                                        className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                                        title={t('history.restore')}
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handlePermanentDeleteBuilding(b.id); }}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                        title={t('history.deletePermanently')}
                                    >
                                        <X size={16} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {books.filter(bk => bk.id !== activeBookId).length > 0 && (
                                      <button
                                          onClick={(e) => { e.stopPropagation(); setTransferBuilding(b); setTransferTargetBookId(books.filter(bk => bk.id !== activeBookId)[0]?.id || ''); }}
                                          className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors"
                                          title="Transfer to another book"
                                      >
                                          <ArrowRightLeft size={16} />
                                      </button>
                                    )}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteBuilding(b.id); }}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                        title={t('history.moveToTrash')}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                  </>
                                )}
                             </div>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">{b.name}</h3>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] sm:text-sm text-slate-500 font-medium">{b.units.length} {t('building.units')} / Rooms</p>
                            {b.lease?.isLeased && (
                                <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-200">
                                    {t('building.leasedBadge')}
                                </span>
                            )}
                        </div>
                        {b.lease?.isLeased && b.lease.leaseEndDate && (() => {
                            const days = Math.ceil((new Date(b.lease.leaseEndDate!).getTime() - Date.now()) / 86400000);
                            const isExpired = days <= 0;
                            const isWarning = days > 0 && days <= 60;
                            return (
                                <div className={`mt-2 px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold flex items-center gap-1 ${isExpired ? 'bg-rose-50 text-rose-600 border border-rose-200' : isWarning ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                                    <CalendarDays size={11} />
                                    {isExpired ? `Lease expired ${Math.abs(days)}d ago` : `Lease ends in ${days}d`}
                                </div>
                            );
                        })()}
                        
                        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-50 flex items-center gap-2 text-blue-600 text-[9px] sm:text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">
                            {t('building.manageUnits')} <Edit2 size={12} />
                        </div>
                    </div>
                ))}
             </div>
          </div>
        ) : (
          <div className="animate-slideUp max-w-4xl mx-auto">
             {editingBuilding && (
                 <div className="space-y-4 sm:space-y-6 md:space-y-8">
                     <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                         <div>
                             <h3 className="text-lg sm:text-xl font-bold text-slate-800">{editingBuilding.name}</h3>
                             <p className="text-slate-500 text-xs sm:text-sm">{t('building.managingUnits')}</p>
                         </div>

                        <div className="bg-slate-50 p-4 sm:p-6 rounded-lg sm:rounded-2xl border border-slate-200 w-full sm:w-auto">
                            <h4 className="text-[10px] sm:text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 sm:mb-4">{t('building.details')}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                                <div>
                                    <label className="text-[8px] sm:text-xs font-bold text-slate-400 mb-1 block">{t('common.name')}</label>
                                    <input value={editingBuilding.name} onChange={e => setEditingBuilding({ ...editingBuilding, name: e.target.value })} className="w-full px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm" />
                                </div>
                                <div>
                                    <label className="text-[8px] sm:text-xs font-bold text-slate-400 mb-1 block">Water Meter Number</label>
                                    <input value={editingBuilding.waterMeterNumber || ''} onChange={e => setEditingBuilding({ ...editingBuilding, waterMeterNumber: e.target.value })} className="w-full px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm" placeholder="Optional" />
                                </div>
                                <div>
                                    <label className="text-[8px] sm:text-xs font-bold text-slate-400 mb-1 block">{t('history.bank')}</label>
                                    <select value={editingBuilding.bankName || ''} onChange={e => { setEditingBuilding({ ...editingBuilding, bankName: e.target.value }); const found = banks.find(b => b.name === e.target.value); if(found) setEditingBuilding({ ...editingBuilding, bankName: e.target.value, iban: found.iban || editingBuilding.iban }); }} className="w-full px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm">
                                        <option value="">{t('building.noBank')}</option>
                                        {banks.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[8px] sm:text-xs font-bold text-slate-400 mb-1 block">{t('entry.iban')}</label>
                                    <input value={editingBuilding.iban || ''} onChange={e => setEditingBuilding({ ...editingBuilding, iban: e.target.value })} className="w-full px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm" />
                                </div>
                                <div>
                                    <label className="text-[8px] sm:text-xs font-bold text-slate-400 mb-1 block">{t('building.propertyType')}</label>
                                    <select
                                        value={editingBuilding.propertyType || 'RESIDENTIAL'}
                                        onChange={e => {
                                            const type = e.target.value as 'RESIDENTIAL' | 'NON_RESIDENTIAL';
                                            setEditingBuilding({
                                                ...editingBuilding,
                                                propertyType: type,
                                                vatApplicable: type === 'NON_RESIDENTIAL' ? (editingBuilding.vatApplicable || false) : false
                                            });
                                        }}
                                        className="w-full px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm"
                                    >
                                        <option value="RESIDENTIAL">{t('building.residential')}</option>
                                        <option value="NON_RESIDENTIAL">{t('building.nonResidential')}</option>
                                    </select>
                                </div>
                                <div className="col-span-1 sm:col-span-2 pt-2">
                                    <button
                                        onClick={async () => {
                                            if (!editingBuilding) return;
                                            await saveBuilding(editingBuilding);
                                            await loadBuildings();
                                            showSuccess('Building details saved!');
                                        }}
                                        className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md flex items-center justify-center gap-2"
                                    >
                                        <Save size={16} /> Save Property Details
                                    </button>
                                </div>
                                {editingBuilding.propertyType === 'NON_RESIDENTIAL' && (
                                    <div className="flex items-center mt-2">
                                        <input
                                            id="editVatApplicable"
                                            type="checkbox"
                                            checked={!!editingBuilding.vatApplicable}
                                            onChange={e => setEditingBuilding({ ...editingBuilding, vatApplicable: e.target.checked })}
                                            className="w-4 h-4 text-emerald-600 rounded mr-2"
                                        />
                                        <label htmlFor="editVatApplicable" className="text-xs font-bold text-slate-800 cursor-pointer">{t('entry.vat')}</label>
                                    </div>
                                )}
                                <div className="flex items-end pt-2 sm:pt-0">
                                    <button onClick={async () => { if (!editingBuilding) return; await saveBuilding(editingBuilding); await loadBuildings(); showSuccess('Saved'); }} className="w-full px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-bold">{t('common.save')}</button>
                                </div>
                            </div>
                        </div>
                         <div className="bg-blue-50 text-blue-800 px-3 sm:px-4 py-2 rounded-lg font-mono font-bold text-[10px] sm:text-sm whitespace-nowrap w-full sm:w-auto text-center">
                             {editingBuilding.units.length} Units
                         </div>
                     </div>

                     {/* Lease Management Section */}
                     <div className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
                         editingBuilding.lease?.isLeased 
                             ? 'border-orange-200 bg-gradient-to-br from-orange-50/80 via-amber-50/60 to-yellow-50/40' 
                             : 'border-slate-200 bg-slate-50/50'
                     }`}>
                         {/* Decorative corner accent */}
                         {editingBuilding.lease?.isLeased && (
                             <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-orange-200/30 to-transparent rounded-bl-full" />
                         )}
                         <div className="relative p-4 sm:p-6">
                             <div className="flex items-center justify-between mb-4">
                                 <h4 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                         editingBuilding.lease?.isLeased 
                                             ? 'bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-200' 
                                             : 'bg-slate-200'
                                     }`}>
                                         <FileKey size={16} className="text-white" />
                                     </div>
                                     {t('building.buildingLease')}
                                 </h4>
                                 <label className="relative inline-flex items-center cursor-pointer">
                                     <input
                                         type="checkbox"
                                         className="sr-only peer"
                                         checked={editingBuilding.lease?.isLeased || false}
                                         onChange={async (e) => {
                                             const isLeased = e.target.checked;
                                             const updatedLease: BuildingLease = {
                                                 ...(editingBuilding.lease || {}),
                                                 isLeased
                                             };
                                             const updated = { ...editingBuilding, lease: updatedLease };
                                             setEditingBuilding(updated);
                                             await saveBuilding(updated);
                                             await loadBuildings();
                                         }}
                                     />
                                     <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-orange-500 peer-checked:to-amber-500"></div>
                                     <span className="ml-2 text-xs font-bold text-slate-600">
                                         {editingBuilding.lease?.isLeased ? t('building.leasedLabel') : t('building.ownedLabel')}
                                     </span>
                                 </label>
                             </div>

                             {editingBuilding.lease?.isLeased && (() => {
                                 const lease = editingBuilding.lease!;
                                 const givenFromTxns = calcGivenAmount(editingBuilding.id);
                                 const duration = calcLeaseDuration(lease.leaseStartDate, lease.leaseEndDate);
                                 const totalRent = lease.totalRent || 0;
                                 const balance = totalRent - givenFromTxns;
                                 const schedule = generateRentSchedule(lease, editingBuilding.id);
                                 const paidCount = schedule.filter(s => s.status === 'paid').length;
                                 const overdueCount = schedule.filter(s => s.status === 'overdue').length;

                                 return (
                                 <div className="space-y-4 animate-fade-in">
                                     {/* Lease status banner */}
                                     {lease.leaseEndDate && (() => {
                                         const days = Math.ceil((new Date(lease.leaseEndDate!).getTime() - Date.now()) / 86400000);
                                         const isExpired = days <= 0;
                                         const isWarning = days > 0 && days <= 60;
                                         return (
                                             <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                                                 isExpired ? 'bg-rose-50 border-rose-200 text-rose-700' 
                                                 : isWarning ? 'bg-amber-50 border-amber-200 text-amber-700' 
                                                 : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                             }`}>
                                                 <ShieldAlert size={18} className={isExpired ? 'text-rose-500 animate-pulse' : isWarning ? 'text-amber-500' : 'text-emerald-500'} />
                                                 <div className="flex-1">
                                                     <div className="text-xs font-bold">
                                                         {isExpired ? `Lease EXPIRED ${Math.abs(days)} days ago!` 
                                                         : isWarning ? `Lease expires in ${days} days - Renew soon!` 
                                                         : `Lease active - ${days} days remaining`}
                                                     </div>
                                                     <div className="text-[10px] opacity-75">
                                                         {lease.leaseStartDate} → {lease.leaseEndDate}
                                                         {duration.months > 0 || duration.days > 0 ? (
                                                             <span className="ml-2 font-bold">
                                                                 ({duration.months > 0 ? `${duration.months} month${duration.months !== 1 ? 's' : ''}` : ''}
                                                                 {duration.months > 0 && duration.days > 0 ? ', ' : ''}
                                                                 {duration.days > 0 ? `${duration.days} day${duration.days !== 1 ? 's' : ''}` : ''})
                                                             </span>
                                                         ) : null}
                                                     </div>
                                                 </div>
                                             </div>
                                         );
                                     })()}

                                     {/* Duration badge when no end date alert */}
                                     {!lease.leaseEndDate && lease.leaseStartDate && (
                                         <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-600">
                                             <Clock size={14} /> Start: {lease.leaseStartDate} (no end date set)
                                         </div>
                                     )}

                                     {/* Lease details form */}
                                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                         <div>
                                             <label className="text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('building.landlordName')}</label>
                                             <input
                                                 type="text"
                                                 value={lease.landlordName || ''}
                                                 onChange={e => setEditingBuilding({
                                                     ...editingBuilding,
                                                     lease: { ...lease, landlordName: e.target.value }
                                                 })}
                                                 placeholder="Property owner name"
                                                 className="w-full px-3 py-2.5 rounded-lg border border-orange-200 bg-white outline-none focus:ring-2 focus:ring-orange-400/40 text-xs sm:text-sm"
                                             />
                                         </div>
                                         <div>
                                             <label className="text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('contract.startDate')}</label>
                                             <input
                                                 type="date"
                                                 value={lease.leaseStartDate || ''}
                                                 onChange={e => {
                                                     const startDate = e.target.value;
                                                     const years = lease.durationYears || 0;
                                                     let endDate = lease.leaseEndDate || '';
                                                     if (startDate && years > 0) {
                                                         const d = new Date(startDate);
                                                         d.setFullYear(d.getFullYear() + years);
                                                         endDate = d.toISOString().split('T')[0];
                                                     }
                                                     setEditingBuilding({
                                                         ...editingBuilding,
                                                         lease: { ...lease, leaseStartDate: startDate, leaseEndDate: endDate }
                                                     });
                                                 }}
                                                 className="w-full px-3 py-2.5 rounded-lg border border-orange-200 bg-white outline-none focus:ring-2 focus:ring-orange-400/40 text-xs sm:text-sm"
                                             />
                                         </div>
                                         <div>
                                             <label className="text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('building.durationYears')}</label>
                                             <input
                                                 type="number"
                                                 min="0"
                                                 step="1"
                                                 value={lease.durationYears || ''}
                                                 onChange={e => {
                                                     const years = parseFloat(e.target.value) || 0;
                                                     const startDate = lease.leaseStartDate || '';
                                                     let endDate = lease.leaseEndDate || '';
                                                     if (startDate && years > 0) {
                                                         const d = new Date(startDate);
                                                         d.setFullYear(d.getFullYear() + Math.floor(years));
                                                         // Handle fractional years as months
                                                         const fractional = years - Math.floor(years);
                                                         if (fractional > 0) {
                                                             d.setMonth(d.getMonth() + Math.round(fractional * 12));
                                                         }
                                                         endDate = d.toISOString().split('T')[0];
                                                     }
                                                     const yearlyRent = lease.yearlyRent || 0;
                                                     const totalRent = years > 0 && yearlyRent > 0 ? Math.round(yearlyRent * years * 100) / 100 : lease.totalRent || 0;
                                                     setEditingBuilding({
                                                         ...editingBuilding,
                                                         lease: { ...lease, durationYears: years, leaseEndDate: endDate, totalRent }
                                                     });
                                                 }}
                                                 placeholder="e.g. 2"
                                                 className="w-full px-3 py-2.5 rounded-lg border border-orange-200 bg-white outline-none focus:ring-2 focus:ring-orange-400/40 text-xs sm:text-sm"
                                             />
                                         </div>
                                         <div>
                                             <label className="text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('contract.endDate')}<span className="text-[8px] text-orange-400">(auto)</span></label>
                                             <input
                                                 type="date"
                                                 value={lease.leaseEndDate || ''}
                                                 onChange={e => setEditingBuilding({
                                                     ...editingBuilding,
                                                     lease: { ...lease, leaseEndDate: e.target.value }
                                                 })}
                                                 className="w-full px-3 py-2.5 rounded-lg border border-orange-200 bg-orange-50/30 outline-none focus:ring-2 focus:ring-orange-400/40 text-xs sm:text-sm"
                                             />
                                         </div>
                                     </div>
                                     {/* Duration display */}
                                     {(duration.months > 0 || duration.days > 0) && (
                                         <div className="w-full px-3 py-2 rounded-lg border border-orange-100 bg-orange-50/50 text-xs sm:text-sm font-bold text-orange-700">
                                             📅 Duration: {duration.months > 0 ? `${duration.months} month${duration.months !== 1 ? 's' : ''}` : ''}
                                             {duration.months > 0 && duration.days > 0 ? ', ' : ''}
                                             {duration.days > 0 ? `${duration.days} day${duration.days !== 1 ? 's' : ''}` : ''}
                                             {` (${duration.totalDays} days total)`}
                                         </div>
                                     )}

                                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                         <div>
                                             <label className="text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('building.yearlyRent')} (SAR)</label>
                                             <input
                                                 type="number"
                                                 min="0"
                                                 value={lease.yearlyRent || ''}
                                                 onChange={e => {
                                                     const yearlyRent = parseFloat(e.target.value) || 0;
                                                     const years = lease.durationYears || 0;
                                                     const totalRent = years > 0 && yearlyRent > 0 ? Math.round(yearlyRent * years * 100) / 100 : lease.totalRent || 0;
                                                     setEditingBuilding({
                                                         ...editingBuilding,
                                                         lease: { ...lease, yearlyRent, totalRent }
                                                     });
                                                 }}
                                                 placeholder={t('entry.zero')}
                                                 className="w-full px-3 py-2.5 rounded-lg border border-orange-200 bg-white outline-none focus:ring-2 focus:ring-orange-400/40 text-xs sm:text-sm"
                                             />
                                         </div>
                                         <div>
                                             <label className="text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('building.totalRentLabel')} <span className="text-[8px] text-orange-400">(auto: yearly × years)</span></label>
                                             <div className="w-full px-3 py-2.5 rounded-lg border border-orange-100 bg-orange-50/30 text-xs sm:text-sm font-bold text-orange-700">
                                                 {(lease.totalRent || 0).toLocaleString()} SAR
                                                 {lease.yearlyRent && lease.durationYears ? (
                                                     <span className="text-[9px] text-slate-400 ml-1">({lease.yearlyRent.toLocaleString()} × {lease.durationYears}yr)</span>
                                                 ) : null}
                                             </div>
                                         </div>
                                         <div>
                                             <label className="text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('contract.installments')}</label>
                                             <input
                                                 type="number"
                                                 min="1"
                                                 max="120"
                                                 value={lease.installmentCount || 12}
                                                 onChange={e => setEditingBuilding({
                                                     ...editingBuilding,
                                                     lease: { ...lease, installmentCount: parseInt(e.target.value) || 12 }
                                                 })}
                                                 className="w-full px-3 py-2.5 rounded-lg border border-orange-200 bg-white outline-none focus:ring-2 focus:ring-orange-400/40 text-xs sm:text-sm"
                                             />
                                         </div>
                                     </div>
                                     {/* Installment gap - shown when installments > 1 */}
                                     {(lease.installmentCount || 12) > 1 && (
                                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                             <div>
                                                 <label className="text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('building.gapMonths')}</label>
                                                 <input
                                                     type="number"
                                                     min="1"
                                                     max="60"
                                                     value={lease.installmentGapMonths || ''}
                                                     onChange={e => setEditingBuilding({
                                                         ...editingBuilding,
                                                         lease: { ...lease, installmentGapMonths: parseInt(e.target.value) || 1 }
                                                     })}
                                                     placeholder="e.g. 1 = monthly, 3 = quarterly, 6 = semi-annual"
                                                     className="w-full px-3 py-2.5 rounded-lg border border-orange-200 bg-white outline-none focus:ring-2 focus:ring-orange-400/40 text-xs sm:text-sm"
                                                 />
                                             </div>
                                             <div>
                                                 <label className="text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('building.schedulePattern')}</label>
                                                 <div className="w-full px-3 py-2.5 rounded-lg border border-orange-100 bg-orange-50/30 text-xs sm:text-sm font-bold text-orange-700">
                                                     {(() => {
                                                         const gap = lease.installmentGapMonths || 1;
                                                         const count = lease.installmentCount || 12;
                                                         const perInstall = totalRent > 0 ? Math.round(totalRent / count) : 0;
                                                         return `${count} payments of ${perInstall.toLocaleString()} SAR every ${gap} month${gap !== 1 ? 's' : ''}`;
                                                     })()}
                                                 </div>
                                             </div>
                                         </div>
                                     )}

                                     {/* Financial Summary Cards */}
                                     <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                                         <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-orange-100 text-center">
                                             <div className="text-[9px] font-bold text-slate-500 uppercase">{t('building.yearly')}</div>
                                             <div className="text-sm sm:text-lg font-black text-orange-600">{(lease.yearlyRent || 0).toLocaleString()}</div>
                                             <div className="text-[8px] text-slate-400">SAR/year</div>
                                         </div>
                                         <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-orange-100 text-center">
                                             <div className="text-[9px] font-bold text-slate-500 uppercase">{t('building.totalRentLabel')}</div>
                                             <div className="text-sm sm:text-lg font-black text-slate-800">{totalRent.toLocaleString()}</div>
                                             <div className="text-[8px] text-slate-400">{t('common.sar')}</div>
                                         </div>
                                         <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-emerald-100 text-center">
                                             <div className="text-[9px] font-bold text-emerald-600 uppercase">{t('tenant.paidAmount')}</div>
                                             <div className="text-sm sm:text-lg font-black text-emerald-600">{givenFromTxns.toLocaleString()}</div>
                                             <div className="text-[8px] text-slate-400">SAR (auto)</div>
                                         </div>
                                         <div className={`bg-white/80 backdrop-blur-sm rounded-xl p-3 border text-center ${balance > 0 ? 'border-rose-100' : 'border-emerald-100'}`}>
                                             <div className="text-[9px] font-bold text-slate-500 uppercase">{t('tenant.balance')}</div>
                                             <div className={`text-sm sm:text-lg font-black ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                 {balance.toLocaleString()}
                                             </div>
                                             <div className="text-[8px] text-slate-400">SAR remaining</div>
                                         </div>
                                         <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-blue-100 text-center">
                                             <div className="text-[9px] font-bold text-slate-500 uppercase">{t('building.perInstall')}</div>
                                             <div className="text-sm sm:text-lg font-black text-blue-600">
                                                 {totalRent > 0 ? Math.round(totalRent / (lease.installmentCount || 12)).toLocaleString() : '0'}
                                             </div>
                                             <div className="text-[8px] text-slate-400">SAR × {lease.installmentCount || 12}</div>
                                         </div>
                                     </div>

                                     {/* Payment progress bar */}
                                     {totalRent > 0 && (
                                         <div className="space-y-1">
                                             <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                                 <span>{t('building.paymentProgress')}</span>
                                                 <span>{Math.min(100, Math.round((givenFromTxns / totalRent) * 100))}%</span>
                                             </div>
                                             <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                                 <div className="bg-gradient-to-r from-orange-500 to-amber-400 h-2.5 rounded-full transition-all duration-500" 
                                                     style={{ width: `${Math.min(100, (givenFromTxns / totalRent) * 100)}%` }} />
                                             </div>
                                         </div>
                                     )}

                                     {/* Rent Payment Schedule */}
                                     {schedule.length > 0 && (
                                         <div className="bg-white rounded-xl border border-orange-100 overflow-hidden">
                                             <div className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 flex items-center justify-between">
                                                 <h5 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                                                     <CalendarDays size={16} className="text-orange-500" />
                                                     {t('building.rentSchedule')}
                                                 </h5>
                                                 <div className="flex gap-2 text-[9px] font-bold">
                                                     <span className="text-emerald-600">{paidCount} Paid</span>
                                                     {overdueCount > 0 && <span className="text-rose-600">{overdueCount} Overdue</span>}
                                                     <span className="text-slate-400">{schedule.length - paidCount - overdueCount} Upcoming</span>
                                                 </div>
                                             </div>
                                             <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                                                 {schedule.map((s) => (
                                                     <div key={s.no} className={`flex items-center gap-3 px-3 py-2.5 text-xs ${
                                                         s.status === 'paid' ? 'bg-emerald-50/40' : s.status === 'overdue' ? 'bg-rose-50/40' : ''
                                                     }`}>
                                                         <div className="w-5 shrink-0">
                                                             {s.status === 'paid' ? (
                                                                 <CheckCircle2 size={16} className="text-emerald-500" />
                                                             ) : s.status === 'overdue' ? (
                                                                 <AlertCircle size={16} className="text-rose-500 animate-pulse" />
                                                             ) : (
                                                                 <Circle size={16} className="text-slate-300" />
                                                             )}
                                                         </div>
                                                         <div className="w-6 text-[10px] font-black text-slate-400">#{s.no}</div>
                                                         <div className="flex-1 font-bold text-slate-700">{s.dueDate}</div>
                                                         <div className="font-bold text-slate-800">{s.amount.toLocaleString()} <span className="text-[9px] text-slate-400">{t('common.sar')}</span></div>
                                                         <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                                             s.status === 'paid' ? 'bg-emerald-100 text-emerald-700' 
                                                             : s.status === 'overdue' ? 'bg-rose-100 text-rose-700' 
                                                             : 'bg-slate-100 text-slate-500'
                                                         }`}>
                                                             {s.status === 'paid' ? 'Paid' : s.status === 'overdue' ? 'Overdue' : 'Due'}
                                                         </div>
                                                     </div>
                                                 ))}
                                             </div>
                                         </div>
                                     )}

                                     {/* Notes */}
                                     <div>
                                         <label className="text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">{t('building.leaseNotes')}</label>
                                         <textarea
                                             value={lease.notes || ''}
                                             onChange={e => setEditingBuilding({
                                                 ...editingBuilding,
                                                 lease: { ...lease, notes: e.target.value }
                                             })}
                                             placeholder="Additional notes about the lease..."
                                             rows={2}
                                             className="w-full px-3 py-2.5 rounded-lg border border-orange-200 bg-white outline-none focus:ring-2 focus:ring-orange-400/40 text-xs sm:text-sm resize-none"
                                         />
                                     </div>

                                     {/* Save Lease Button */}
                                     <button
                                         onClick={async () => {
                                             if (!editingBuilding) return;
                                             await saveBuilding(editingBuilding);
                                             await loadBuildings();
                                             showSuccess('Lease details saved!');
                                         }}
                                         className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-200/50 flex items-center justify-center gap-2"
                                     >
                                         <Save size={16} /> {t('building.saveLease')}
                                     </button>
                                 </div>
                                 );
                             })()}
                         </div>
                     </div>

                     {/* Add Unit Form */}
                     <div className="bg-slate-50 p-4 sm:p-6 rounded-lg sm:rounded-2xl border border-slate-200">
                         <h4 className="text-[10px] sm:text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 sm:mb-4 flex items-center gap-2">
                             {editingUnitIndex !== null ? (
                                 <><Edit2 size={16} className="text-orange-500"/> {t('building.editUnit')}</>
                             ) : (
                                 <><PlusCircle size={16} className="text-blue-500"/> {t('building.addNewUnit')}</>
                             )}
                         </h4>
                         <form onSubmit={handleAddUnit} className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-end">
                             <div className="flex-[2] w-full">
                                 <label className="text-[8px] sm:text-xs font-bold text-slate-400 mb-1 block">{t('building.unitRoomNo')}</label>
                                 <input 
                                    type="text" 
                                    required
                                    value={newUnitName}
                                    onChange={e => setNewUnitName(e.target.value)}
                                    placeholder="e.g. Flat 101, Shop A"
                                    className="w-full px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                                 />
                             </div>
                             <div className="flex-1 w-full">
                                 <label className="text-[8px] sm:text-xs font-bold text-slate-400 mb-1 block">{t('building.defaultRent')} (SAR)</label>
                                 <input 
                                    type="number" 
                                    required
                                    min="0"
                                    value={newUnitRent || ''}
                                    onChange={e => setNewUnitRent(parseFloat(e.target.value))}
                                    placeholder={t('entry.zero')}
                                    className="w-full px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                                 />
                             </div>
                             <div className="flex-1 w-full">
                                 <label className="text-[8px] sm:text-xs font-bold text-slate-400 mb-1 block">Meter Number (Electricity)</label>
                                 <input 
                                    type="text" 
                                    value={newUnitMeter}
                                    onChange={e => setNewUnitMeter(e.target.value)}
                                    placeholder="Optional"
                                    className="w-full px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                                 />
                             </div>
                             {editingUnitIndex !== null ? (
                                 <>
                                     <button type="submit" className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors">
                                         {t('building.update')}
                                     </button>
                                     <button type="button" onClick={handleCancelEdit} className="px-6 py-2.5 bg-slate-400 text-white rounded-lg font-bold hover:bg-slate-500 transition-colors">{t('common.cancel')}</button>
                                 </>
                             ) : (
                                 <button type="submit" className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 transition-colors">{t('common.add')}</button>
                             )}
                         </form>
                     </div>

                     {/* Room Search Bar */}
                     <div className="relative">
                         <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                         <input
                             type="text"
                             value={unitSearch}
                             onChange={e => setUnitSearch(e.target.value)}
                             placeholder={t('building.searchUnits')}
                             className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                         />
                         {unitSearch && (
                             <button onClick={() => setUnitSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                 <X size={14} />
                             </button>
                         )}
                     </div>

                     {/* Units - Mobile Cards */}
                     <div className="md:hidden space-y-3">
                        {[...editingBuilding.units]
                        .filter(u => !unitSearch || u.name.toLowerCase().includes(unitSearch.toLowerCase()))
                        .sort((a, b) => {
                            const aMatch = a.name.match(/^([A-Za-z-]*)(\d+)(.*)$/);
                            const bMatch = b.name.match(/^([A-Za-z-]*)(\d+)(.*)$/);
                            if (aMatch && bMatch) {
                                const aPrefix = aMatch[1].toLowerCase();
                                const bPrefix = bMatch[1].toLowerCase();
                                const aNum = parseInt(aMatch[2]);
                                const bNum = parseInt(bMatch[2]);
                                if (aPrefix !== bPrefix) return aPrefix.localeCompare(bPrefix);
                                return aNum - bNum;
                            }
                            return a.name.localeCompare(b.name);
                        }).map((u, idx) => (
                            <div key={u.name + '-' + idx} className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Home size={14} className="text-slate-400" /> {u.name}</div>
                                    <div className="text-[11px] text-emerald-700 font-bold">{u.defaultRent.toLocaleString()} <span className="text-[10px] text-slate-500">{t('common.sar')}</span></div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditUnit(u)} className="p-1.5 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold">{t('common.edit')}</button>
                                    <button onClick={() => handleDeleteUnit(u)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg text-[11px] font-bold">{t('common.delete')}</button>
                                </div>
                            </div>
                        ))}
                        {editingBuilding.units.length === 0 && (
                            <div className="px-3 py-6 text-center text-slate-400 text-sm">{t('building.noUnits')}</div>
                        )}
                     </div>

                     {/* Units Table */}
                     <div className="hidden md:block bg-white rounded-xl border border-slate-100 overflow-hidden">
                         <table className="w-full text-left">
                             <thead className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-100">
                                 <tr>
                                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{t('building.unitName')}</th>
                                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{t('building.defaultRent')}</th>
                                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">{t('common.actions')}</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100">
                                 {[...editingBuilding.units]
                                 .filter(u => !unitSearch || u.name.toLowerCase().includes(unitSearch.toLowerCase()))
                                 .sort((a, b) => {
                                     // Sort by Block (A, B, C) then by number
                                     const aMatch = a.name.match(/^([A-Za-z-]*)(\d+)(.*)$/);
                                     const bMatch = b.name.match(/^([A-Za-z-]*)(\d+)(.*)$/);
                                     
                                     if (aMatch && bMatch) {
                                         const aPrefix = aMatch[1].toLowerCase();
                                         const bPrefix = bMatch[1].toLowerCase();
                                         const aNum = parseInt(aMatch[2]);
                                         const bNum = parseInt(bMatch[2]);
                                         
                                         // First sort by block letter (A before B before C)
                                         if (aPrefix !== bPrefix) {
                                             return aPrefix.localeCompare(bPrefix);
                                         }
                                         // Then by number within same block
                                         return aNum - bNum;
                                     }
                                     return a.name.localeCompare(b.name);
                                 }).map((u, idx) => (
                                     <tr key={u.name + '-' + idx} className="hover:bg-slate-50">
                                         <td className="px-6 py-4 text-sm font-bold text-slate-700 flex items-center gap-2">
                                             <Home size={14} className="text-slate-400" /> {u.name}
                                         </td>
                                         <td className="px-6 py-4 text-sm font-medium text-emerald-600">
                                             {u.defaultRent.toLocaleString()} <span className="text-xs text-slate-400">{t('common.sar')}</span>
                                         </td>
                                         <td className="px-6 py-4 text-right">
                                             <button 
                                                onClick={() => handleEditUnit(u)}
                                                className="text-slate-400 hover:text-blue-600 transition-colors p-2"
                                                title="Edit Unit"
                                             >
                                                 <Edit2 size={16} />
                                             </button>
                                             <button 
                                                onClick={() => handleDeleteUnit(u)}
                                                className="text-slate-400 hover:text-red-600 transition-colors p-2 ml-2"
                                                title="Delete Unit"
                                             >
                                                 <Trash2 size={16} />
                                             </button>
                                         </td>
                                     </tr>
                                 ))}
                                 {editingBuilding.units.length === 0 && (
                                     <tr>
                                         <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                                             <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                                             {t('building.noUnits')}
                                         </td>
                                     </tr>
                                 )}
                             </tbody>
                         </table>
                     </div>
                 </div>
             )}
          </div>
        )}
            </div>

            <ConfirmDialog
                open={confirmOpen}
                title={confirmTitle}
                message={confirmMessage}
                danger={confirmDanger}
                onConfirm={() => confirmAction && confirmAction()}
                onCancel={closeConfirm}
            />

            {/* Transfer Building Dialog */}
            {transferBuilding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                                <ArrowRightLeft className="text-indigo-600" size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Transfer Building to Another Book</h3>
                                <p className="text-xs text-slate-500">All data will be moved completely</p>
                            </div>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
                            <p className="text-sm font-bold text-indigo-800 mb-1">{transferBuilding.name}</p>
                            <p className="text-xs text-indigo-600">{transferBuilding.units.length} units · Will transfer: transactions, contracts, staff & all linked records</p>
                        </div>

                        <div className="mb-5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Transfer To Book</label>
                            <select
                                value={transferTargetBookId}
                                onChange={e => setTransferTargetBookId(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                            >
                                {books.filter(bk => bk.id !== activeBookId).map(bk => (
                                    <option key={bk.id} value={bk.id}>{bk.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 text-xs text-amber-800">
                            <strong>Warning:</strong> This will permanently move the building and ALL its data (transactions, contracts, staff assigned only to this building) to the selected book. This cannot be undone.
                        </div>

                        {isTransferring && (
                            <div className="mb-4 text-xs text-indigo-600 font-medium animate-pulse">{transferProgress}</div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setTransferBuilding(null); setTransferTargetBookId(''); setTransferProgress(''); }}
                                disabled={isTransferring}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleTransferBuilding}
                                disabled={isTransferring || !transferTargetBookId}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <ArrowRightLeft size={15} />
                                {isTransferring ? 'Transferring...' : 'Transfer Building'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
    </div>
  );
};

export default BuildingManager;
