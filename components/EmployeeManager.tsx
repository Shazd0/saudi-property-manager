
import React, { useState, useEffect } from 'react';
import { User, UserRole, Building } from '../types';
import { getUsers, saveUser, deleteUser, getBuildings } from '../services/firestoreService';
import { UserCheck, Plus, Trash2, Edit, Save, X, Lock, Key, Building2, RotateCcw, AlertTriangle, CreditCard, Calendar, Crown } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import SoundService from '../services/soundService';
import { fmtDate } from '../utils/dateFormat';
import { useLanguage } from '../i18n';

const EmployeeManager: React.FC = () => {
    const { t, isRTL } = useLanguage();
    const { showSuccess, showError, showWarning } = useToast();
  const [employees, setEmployees] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [view, setView_] = useState<'LIST' | 'FORM'>('LIST');
  const setView = (v: 'LIST' | 'FORM') => { SoundService.play('tab'); setView_(v); };
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
    const [formData, setFormData] = useState<Partial<User>>({
        id: '',
        name: '',
        password: '',
        role: UserRole.EMPLOYEE,
        email: '',
        status: 'Active',
        joinedDate: new Date().toISOString().split('T')[0],
        baseSalary: 0,
        hasSystemAccess: true,
        buildingId: '',
        buildingIds: [],
        iqamaNo: '',
        iqamaExpiry: '',
        isOwner: false,
        sharePercentage: 0,
        ownerBuildingIds: [],
        phone: ''
    });

    useEffect(() => {
        const load = async () => {
            const [usrs, blds] = await Promise.all([getUsers({ includeDeleted: true }), getBuildings()]);
            setEmployees(usrs || []);
            setBuildings(blds || []);
        };
        load();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    if (!formData.name) {
        showWarning("Please enter employee name");
        return;
    }
    
    // Auto-generate ID if no system access or ID missing
    // Only auto-generate ID if creating a new user (not editing)
    let finalId = formData.id;
    if (!finalId) {
        finalId = `staff_${Date.now()}`;
    }

    if (formData.hasSystemAccess && !formData.password) {
        showWarning("Password required for system access");
        return;
    }

        const chosenBuildings = formData.buildingIds && formData.buildingIds.length > 0
            ? formData.buildingIds
            : (formData.buildingId ? [formData.buildingId] : []);

        const newUser: User = {
            ...formData as User,
                        id: finalId,
                        role: (formData.role as UserRole) || UserRole.EMPLOYEE,
                        buildingIds: chosenBuildings,
                        buildingId: chosenBuildings[0] || formData.buildingId || ''
        };
    
                await saveUser(newUser);
                const usrs = await getUsers();
                setEmployees(usrs || []);
    setView('LIST');
    resetForm();
  };

  const resetForm = () => {
            setFormData({
                id: '', name: '', password: '', role: UserRole.EMPLOYEE, email: '', status: 'Active', joinedDate: new Date().toISOString().split('T')[0], baseSalary: 0, hasSystemAccess: true, buildingId: '', buildingIds: [], iqamaNo: '', iqamaExpiry: '', isOwner: false, sharePercentage: 0, ownerBuildingIds: [], phone: ''
        });
  };

    const handleDelete = async (id: string) => {
        openConfirm('PERMANENTLY delete employee? This cannot be undone!', async () => {
            await deleteUser(id);
            const usrs = await getUsers();
            setEmployees(usrs || []);
            showSuccess('Employee deleted.');
            closeConfirm();
        }, { danger: true, title: 'Delete Employee' });
    };

    const handleRestore = async (id: string) => {
        openConfirm('Restore this employee?', async () => {
            const employee = employees.find(e => e.id === id);
            if (employee) {
                const updated = { ...employee, deleted: false, deletedAt: undefined } as any;
                await saveUser(updated);
                const usrs = await getUsers();
                setEmployees(usrs || []);
                showSuccess('Employee restored.');
            }
            closeConfirm();
        });
    };

    const handlePermanentDelete = async (id: string) => {
        openConfirm('PERMANENTLY delete employee? This cannot be undone!', async () => {
                await deleteUser(id);
                const usrs = await getUsers();
                setEmployees(usrs || []);
                showSuccess('Employee permanently deleted.');
                closeConfirm();
        }, { danger: true, title: 'Delete Employee' });
    };

    const handleRestoreAll = () => {
        const deleted = employees.filter(e => (e as any).deleted);
        if (deleted.length === 0) return;
        openConfirm(`Restore all ${deleted.length} trashed employees?`, async () => {
            await Promise.all(deleted.map(e => saveUser({ ...e, deleted: false, deletedAt: undefined } as any)));
            const usrs = await getUsers();
            setEmployees(usrs || []);
            showSuccess('All trashed employees restored.');
            closeConfirm();
        });
    };

    const handleDeleteAll = () => {
        const deleted = employees.filter(e => (e as any).deleted);
        if (deleted.length === 0) return;
        openConfirm(`PERMANENTLY delete all ${deleted.length} trashed employees? This cannot be undone!`, async () => {
            await Promise.all(deleted.map(e => deleteUser(e.id)));
            const usrs = await getUsers();
            setEmployees(usrs || []);
            showSuccess('All trashed employees permanently deleted.');
            closeConfirm();
        }, { danger: true, title: 'Delete All Employees' });
    };

  const handleEdit = (user: User) => {
        setFormData({
            ...user,
            id: user.id, // Always set id for editing
            buildingIds: (user as any).buildingIds || (user.buildingId ? [user.buildingId] : []),
            iqamaNo: user.iqamaNo || '',
            iqamaExpiry: user.iqamaExpiry || '',
            isOwner: user.isOwner || false,
            sharePercentage: user.sharePercentage || 0,
            ownerBuildingIds: user.ownerBuildingIds || [],
            phone: user.phone || ''
        });
        setView('FORM');
  };

  // Iqama expiry helpers
  const getIqamaExpiryStatus = (expiry?: string) => {
      if (!expiry) return null;
      const exp = new Date(expiry);
      const now = new Date();
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return { label: 'Expired', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: 'expired', days: Math.abs(diffDays) };
      if (diffDays <= 30) return { label: `Expires in ${diffDays}d`, color: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'warning', days: diffDays };
      return { label: 'Valid', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'ok', days: diffDays };
  };

  const expiringIqamas = employees.filter(e => !(e as any).deleted && e.iqamaExpiry).filter(e => {
      const s = getIqamaExpiryStatus(e.iqamaExpiry);
      return s && s.days <= 30;
  });

  return (
    <div className="premium-card overflow-hidden min-h-[600px] animate-fade-in">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
        <div>
            <h2 className="text-base sm:text-xl font-black text-slate-800 flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm">
                <UserCheck className="text-white" size={24} /> 
            </div>
            Employee Management
            </h2>
            <p className="text-slate-500 text-sm mt-1 ml-14">Manage access and team members</p>
        </div>
        
        {view === 'LIST' && (
          <div className="flex gap-3">
            <button 
              onClick={() => setShowDeleted(!showDeleted)}
              className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 ${showDeleted ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600'}`}
            >
              <Trash2 size={18} /> {showDeleted ? 'Active' : `Trash (${employees.filter(e => (e as any).deleted).length})`}
            </button>
                        {showDeleted && (
                            <>
                                <button onClick={handleRestoreAll} className="px-4 py-2.5 rounded-xl font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">{t('history.restoreAll')}</button>
                                <button onClick={handleDeleteAll} className="px-4 py-2.5 rounded-xl font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100">{t('history.deleteAll')}</button>
                            </>
                        )}
            <button 
              onClick={() => {
                  resetForm();
                  setView('FORM');
              }}
              className="pm-btn pm-btn-primary flex items-center gap-2"
            >
              <Plus size={18} /> Add Employee
            </button>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6">
        {/* Iqama Expiry Alert Banner */}
        {view === 'LIST' && expiringIqamas.length > 0 && (
            <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 animate-fade-in">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-200 rounded-xl"><AlertTriangle size={20} className="text-amber-700" /></div>
                    <div>
                        <h3 className="font-bold text-amber-900 text-sm">Iqama Expiry Alert</h3>
                        <p className="text-amber-700 text-xs">{expiringIqamas.length} employee{expiringIqamas.length > 1 ? 's' : ''} with expiring / expired Iqama</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {expiringIqamas.map(emp => {
                        const s = getIqamaExpiryStatus(emp.iqamaExpiry)!;
                        return (
                            <div key={emp.id} className={`flex items-center justify-between p-3 rounded-xl border ${s.color}`}>
                                <div>
                                    <p className="font-bold text-sm">{emp.name}</p>
                                    <p className="text-[10px] font-mono">Iqama: {emp.iqamaNo || '—'} • Exp: {fmtDate(emp.iqamaExpiry)}</p>
                                </div>
                                <span className="text-xs font-black whitespace-nowrap">{s.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {view === 'LIST' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {employees.filter(e => showDeleted ? (e as any).deleted === true : !(e as any).deleted).map(emp => (
                <div key={emp.id} className="group premium-card premium-card-interactive p-4 sm:p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        {showDeleted ? (
                          <>
                            <button onClick={() => handleRestore(emp.id)} className="p-2 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 rounded-full transition-colors" title={t('history.restore')}>
                                <RotateCcw size={16} />
                            </button>
                            <button onClick={() => handlePermanentDelete(emp.id)} className="p-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-full transition-colors" title={t('history.deletePermanently')}>
                                <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(emp)} className="p-2 bg-slate-100 hover:bg-violet-50 text-slate-600 hover:text-violet-600 rounded-full transition-colors">
                                <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(emp.id)} className="p-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-full transition-colors" title={t('history.moveToTrash')}>
                                <Trash2 size={16} />
                            </button>
                          </>
                        )}
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
                            {(emp.name && typeof emp.name === 'string' && emp.name.length > 0) ? emp.name.charAt(0) : '?'}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">{emp.name}</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-xs font-medium">
                                    {emp.status || 'Active'}
                                </span>
                                {(emp.isOwner || emp.role === UserRole.OWNER) && (
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-bold flex items-center gap-1">
                                        <Crown size={10} /> Owner {emp.sharePercentage ? `(${emp.sharePercentage}%)` : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-2 text-sm text-slate-500">
                        {emp.iqamaNo && (
                        <div className="flex justify-between border-b border-slate-50 pb-2">
                            <span className="flex items-center gap-1"><CreditCard size={12} /> Iqama</span>
                            <span className="font-mono text-slate-700 font-bold">{emp.iqamaNo}</span>
                        </div>
                        )}
                        {emp.iqamaExpiry && (() => {
                            const s = getIqamaExpiryStatus(emp.iqamaExpiry);
                            return (
                                <div className="flex justify-between border-b border-slate-50 pb-2 items-center">
                                    <span className="flex items-center gap-1"><Calendar size={12} /> Iqama Expiry</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-700">{fmtDate(emp.iqamaExpiry)}</span>
                                        {s && s.days <= 30 && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${s.color}`}>{s.label}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="flex justify-between border-b border-slate-50 pb-2">
                            <span>App Access</span>
                            <span className={`font-bold ${emp.hasSystemAccess ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {emp.hasSystemAccess ? 'Granted' : 'No Access'}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-50 pb-2 gap-2">
                            <span>Assigned Buildings</span>
                            <span className="font-bold text-slate-700 text-right truncate max-w-[200px]">
                                {((emp as any).buildingIds && (emp as any).buildingIds.length > 0
                                  ? (emp as any).buildingIds.map((bid: string) => buildings.find(b => b.id === bid)?.name || 'Unknown').join(', ')
                                  : (buildings.find(b => b.id === emp.buildingId)?.name || 'General'))}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-50 pb-2">
                            <span>Salary</span>
                            <span className="font-mono text-emerald-600 font-bold">{emp.baseSalary?.toLocaleString()} SAR</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Joined</span>
                            <span className="text-slate-700">{fmtDate(emp.joinedDate)}</span>
                        </div>
                    </div>
                </div>
            ))}
            {employees.length === 0 && (
                <div className="col-span-full empty-state">
                    <p className="text-slate-400 font-medium">No employees found. Click "Add Employee" to start.</p>
                </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto animate-slideUp">
             <div className="bg-slate-50/50 p-4 sm:p-6 rounded-xl border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Employee Name</label>
                        <input 
                            type="text" 
                            required 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            className="pm-input w-full"
                            placeholder="Full Name"
                        />
                    </div>

                    <div className="col-span-2 p-4 bg-white rounded-xl border border-slate-200">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={formData.hasSystemAccess} 
                                onChange={e => setFormData({...formData, hasSystemAccess: e.target.checked})}
                                className="w-5 h-5 rounded text-violet-600 focus:ring-violet-500"
                            />
                            <div>
                                <span className="block font-bold text-slate-700">Grant System Access (Login)</span>
                                <span className="text-xs text-slate-400">If unchecked, employee cannot log in (e.g., Cleaners, Security)</span>
                            </div>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Role</label>
                        <select value={formData.role} onChange={e => {
                            const newRole = e.target.value as UserRole;
                            setFormData({...formData, role: newRole, isOwner: newRole === UserRole.OWNER ? true : formData.isOwner});
                        }} className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none">
                            <option value={UserRole.EMPLOYEE}>Employee</option>
                            <option value={UserRole.MANAGER}>Manager</option>
                            <option value={UserRole.ENGINEER}>Engineer</option>
                            <option value={UserRole.ADMIN}>Admin</option>
                            <option value={UserRole.OWNER}>👑 Owner</option>
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">Assign role; only Engineers can consume stock.</p>
                    </div>

                    {/* Owner Section */}
                    {(formData.role === UserRole.OWNER || formData.isOwner) && (
                        <div className="col-span-2 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200">
                            <h3 className="text-sm font-bold text-amber-800 mb-4 flex items-center gap-2"><Crown size={16} className="text-amber-600" /> Owner / Investor Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-amber-700 mb-2">Profit Share Percentage (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={formData.sharePercentage || 0}
                                        onChange={e => setFormData({...formData, sharePercentage: parseFloat(e.target.value) || 0})}
                                        className="w-full px-4 py-2.5 rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500 outline-none bg-white font-mono text-lg"
                                        placeholder="e.g. 25"
                                    />
                                    <p className="text-[10px] text-amber-600 mt-1">The owner's share of net profit from assigned buildings.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-amber-700 mb-2">Contact Phone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone || ''}
                                        onChange={e => setFormData({...formData, phone: e.target.value})}
                                        className="w-full px-4 py-2.5 rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                                        placeholder="+966 5x xxx xxxx"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-amber-700 mb-2">Owner's Buildings (Properties with stake)</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl border border-amber-200 bg-white">
                                        {buildings.map(b => {
                                            const checked = (formData.ownerBuildingIds || []).includes(b.id);
                                            return (
                                                <label key={b.id} className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={e => {
                                                            const prev = formData.ownerBuildingIds || [];
                                                            const next = e.target.checked ? [...prev, b.id] : prev.filter(id => id !== b.id);
                                                            setFormData({ ...formData, ownerBuildingIds: next });
                                                        }}
                                                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                                                    />
                                                    <span>{b.name}</span>
                                                </label>
                                            );
                                        })}
                                        {buildings.length === 0 && <div className="text-slate-400 text-sm">No buildings found.</div>}
                                    </div>
                                    {formData.ownerBuildingIds && formData.ownerBuildingIds.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {formData.ownerBuildingIds.map(bid => (
                                                <span key={bid} className="px-2 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold">
                                                    {buildings.find(b => b.id === bid)?.name || bid}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {formData.hasSystemAccess && (
                        <>
                            <div className="col-span-2">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-semibold text-slate-700">Assign Buildings (Multi-select)</label>
                                    <span className="text-[11px] font-bold text-violet-600">Hold Shift/Ctrl not needed — use checkboxes</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl border border-slate-200 bg-white">
                                    {buildings.map(b => {
                                        const checked = (formData.buildingIds || []).includes(b.id);
                                        return (
                                            <label key={b.id} className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={e => {
                                                        const prev = formData.buildingIds || [];
                                                        const next = e.target.checked ? [...prev, b.id] : prev.filter(id => id !== b.id);
                                                        setFormData({ ...formData, buildingIds: next, buildingId: next[0] || '' });
                                                    }}
                                                    className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
                                                />
                                                <span>{b.name}</span>
                                            </label>
                                        );
                                    })}
                                    {buildings.length === 0 && <div className="text-slate-400 text-sm">No buildings found.</div>}
                                </div>
                                {formData.buildingIds && formData.buildingIds.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {formData.buildingIds.map(bid => (
                                            <span key={bid} className="px-2 py-1 bg-violet-50 text-violet-700 border border-violet-100 rounded-lg text-xs font-semibold">
                                                {buildings.find(b => b.id === bid)?.name || bid}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-[10px] text-slate-400 mt-1">You can pick multiple buildings; the first selected is kept for legacy filters.</p>
                            </div>

                            <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-2">Login ID</label>
                                    <input 
                                        type="text" 
                                        required={formData.hasSystemAccess}
                                        value={formData.id} 
                                        onChange={e => setFormData({...formData, id: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none"
                                        placeholder="e.g. johndoe"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-2">{t('login.password')}</label>
                                    <input 
                                        type="text" 
                                        required={formData.hasSystemAccess}
                                        value={formData.password} 
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none"
                                        placeholder="Secret password"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Email (Optional)</label>
                        <input 
                            type="email" 
                            value={formData.email} 
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none"
                            placeholder="email@company.com"
                        />
                    </div>

                     <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Assign to Building</label>
                        <select 
                            value={formData.buildingId}
                            onChange={e => setFormData({...formData, buildingId: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none"
                        >
                            <option value="">General (All Buildings)</option>
                            {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">Expenses for this employee will be allocated to this building.</p>
                    </div>

                    {/* Iqama Section */}
                    <div className="col-span-2 pt-4 border-t border-slate-200">
                        <h3 className="text-sm font-bold text-violet-700 mb-3 flex items-center gap-2"><CreditCard size={16} /> Iqama / Residence Permit</h3>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Iqama Number</label>
                        <input 
                            type="text" 
                            value={formData.iqamaNo || ''} 
                            onChange={e => setFormData({...formData, iqamaNo: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none font-mono"
                            placeholder="e.g. 2xxxxxxxxx"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Iqama Expiry Date</label>
                        <input 
                            type="date" 
                            value={formData.iqamaExpiry || ''} 
                            onChange={e => setFormData({...formData, iqamaExpiry: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none"
                        />
                        {formData.iqamaExpiry && (() => {
                            const s = getIqamaExpiryStatus(formData.iqamaExpiry);
                            return s && s.days <= 30 ? (
                                <p className={`text-xs font-bold mt-1 flex items-center gap-1 ${s.icon === 'expired' ? 'text-rose-600' : 'text-amber-600'}`}>
                                    <AlertTriangle size={12} /> {s.icon === 'expired' ? `Expired ${s.days} days ago!` : `Expiring in ${s.days} days`}
                                </p>
                            ) : null;
                        })()}
                    </div>
                    <div className="col-span-2 pb-2"></div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Base Salary (SAR)</label>
                        <input 
                            type="number" 
                            min="0"
                            value={formData.baseSalary} 
                            onChange={e => setFormData({...formData, baseSalary: parseFloat(e.target.value)})}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none"
                            placeholder={t('entry.zero')}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('common.status')}</label>
                        <select 
                            value={formData.status}
                            onChange={e => setFormData({...formData, status: e.target.value as 'Active' | 'Inactive'})}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none"
                        >
                            <option value="Active">{t('common.active')}</option>
                            <option value="Inactive">Inactive (Access Revoked)</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-4 mt-8 pt-6 border-t border-slate-200">
                    <button 
                        type="button"
                        onClick={() => setView('LIST')}
                        className="pm-btn pm-btn-secondary flex-1 flex items-center justify-center gap-2"
                    >
                        <X size={18} />{t('common.cancel')}</button>
                    <button 
                        type="submit"
                        className="pm-btn pm-btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                        <Save size={18} /> Save Employee
                    </button>
                </div>
             </div>
          </form>
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
        </div>
  );
};

export default EmployeeManager;