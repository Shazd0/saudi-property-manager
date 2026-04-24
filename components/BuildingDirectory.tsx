import React, { useState, useEffect } from 'react';
import { Building, Contract, Customer, User, Transaction, TransactionType, TransactionStatus } from '../types';
import { getBuildings, getContracts, getCustomers, getUsers, getTransactions } from '../services/firestoreService';
import { Building2, Users, Phone, Mail, Calendar, Clock, AlertTriangle, ChevronDown, ChevronRight, Search, FileText, User as UserIcon, Home, Timer, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { fmtDate } from '../utils/dateFormat';
import { formatNameWithRoom } from '../utils/customerDisplay';
import { useLanguage } from '../i18n';

interface TenantInfo {
  contract: Contract;
  customer: Customer | undefined;
  daysRemaining: number;
  isExpiringSoon: boolean;
}

interface BuildingWithTenants {
  building: Building;
  tenants: TenantInfo[];
  occupiedUnits: number;
  totalUnits: number;
  assignedStaff: User[];
  totalIncome: number;
  totalExpense: number;
  pendingCount: number;
}

const BuildingDirectory: React.FC = () => {
  const [buildingsData, setBuildingsData] = useState<BuildingWithTenants[]>([]);
  const { t, isRTL } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'expiring' | 'active'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [buildings, contracts, customers, users, allTxs] = await Promise.all([
        getBuildings(),
        getContracts(),
        getCustomers(),
        getUsers(),
        getTransactions({ role: 'ADMIN' }),
      ]);

      // Sort buildings alphabetically by name (e.g., SAAD-101, PANDA-102)
      const sortedBuildings = [...(buildings || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

      const today = new Date();
      
      const data: BuildingWithTenants[] = sortedBuildings.map(building => {
        const buildingContracts = contracts.filter(
          c => c.buildingId === building.id && c.status === 'Active'
        );
        
        const tenants: TenantInfo[] = buildingContracts.map(contract => {
          const customer = customers.find(c => c.id === contract.customerId);
          const expiryDate = new Date(contract.toDate);
          const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            contract,
            customer,
            daysRemaining,
            isExpiringSoon: daysRemaining <= 30,
          };
        });

        const assignedStaff = users.filter(u => u.buildingId === building.id);
        
        // Calculate income/expense for this building (only APPROVED transactions)
        const buildingTxs = (allTxs || []).filter((t: Transaction) => t.buildingId === building.id && !(t as any).deleted);
        const approvedTxs = buildingTxs.filter((t: Transaction) => t.status === TransactionStatus.APPROVED);
        const totalIncome = approvedTxs.filter((t: Transaction) => t.type === TransactionType.INCOME).reduce((s: number, t: Transaction) => s + t.amount, 0);
        // Exclude ALL borrowing opening balances from totals (tracked separately in BorrowingTracker/OwnerPortal)
        const isBorrowingOpeningBal = (t: Transaction) => t.borrowingType === 'OPENING_BALANCE' || (t as any).isOwnerOpeningBalance === true;
        const totalExpense = approvedTxs
          .filter((t: Transaction) => t.type === TransactionType.EXPENSE && !isBorrowingOpeningBal(t))
          .reduce((s: number, t: Transaction) => s + t.amount, 0);
        const pendingCount = buildingTxs.filter((t: Transaction) => t.status === TransactionStatus.PENDING).length;

        return {
          building,
          tenants,
          occupiedUnits: buildingContracts.length,
          totalUnits: building.units?.length || 0,
          assignedStaff,
          totalIncome,
          totalExpense,
          pendingCount,
        };
      });

      setBuildingsData(data);
      // Expand first building by default
      if (data.length > 0) {
        setExpandedBuildings(new Set([data[0].building.id]));
      }
    } catch (error) {
      console.error('Failed to load building directory:', error);
    }
    setLoading(false);
  };

  const toggleBuilding = (id: string) => {
    setExpandedBuildings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredBuildings = buildingsData.filter(bd => {
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    return (
      bd.building.name.toLowerCase().includes(lower) ||
      bd.tenants.some(t => 
        t.customer?.nameEn?.toLowerCase().includes(lower) ||
        t.customer?.nameAr?.includes(lower) ||
        t.contract.unitName.toLowerCase().includes(lower)
      )
    );
  });

  const getExpiryColor = (days: number) => {
    if (days <= 7) return 'text-red-600 bg-red-50 border-red-200';
    if (days <= 30) return 'text-amber-600 bg-amber-50 border-amber-200';
    if (days <= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  const totalExpiring = buildingsData.reduce((sum, bd) => 
    sum + bd.tenants.filter(t => t.isExpiringSoon).length, 0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-white/20 min-h-[600px]">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-emerald-500 rounded-lg shadow-lg shadow-emerald-200">
                <Building2 className="text-white" size={24} />
              </div>{t('nav.directory')}</h2>
            <p className="text-slate-500 mt-1">{t('directory.subtitle')}</p>
          </div>
          
          {/* Stats */}
          <div className="flex gap-4">
            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-2xl font-black text-slate-800">{buildingsData.length}</div>
              <div className="text-xs text-slate-500">{t('directory.buildings')}</div>
            </div>
            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-2xl font-black text-emerald-600">
                {buildingsData.reduce((sum, bd) => sum + bd.occupiedUnits, 0)}
              </div>
              <div className="text-xs text-slate-500">{t('directory.activeTenants')}</div>
            </div>
            <div className="bg-white px-4 py-2 rounded-xl border border-amber-200 shadow-sm">
              <div className="text-2xl font-black text-amber-600">{totalExpiring}</div>
              <div className="text-xs text-slate-500">{t('owner.contractsExpiring')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder={t('directory.searchPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'all' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >{t('common.all')}</button>
          <button
            onClick={() => setFilter('expiring')}
            className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${filter === 'expiring' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <AlertTriangle size={16} /> {t('directory.expiring')}
          </button>
        </div>
      </div>

      {/* Building List */}
      <div className="p-6 space-y-4">
        {filteredBuildings.map(({ building, tenants, occupiedUnits, totalUnits, assignedStaff, totalIncome, totalExpense, pendingCount }) => {
          const isExpanded = expandedBuildings.has(building.id);
          const filteredTenants = filter === 'expiring' 
            ? tenants.filter(t => t.isExpiringSoon)
            : tenants;
          
          if (filter === 'expiring' && filteredTenants.length === 0) return null;

          const netBalance = totalIncome - totalExpense;

          return (
            <div key={building.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {/* Building Header */}
              <button
                onClick={() => toggleBuilding(building.id)}
                className="w-full p-4 bg-slate-50 hover:bg-slate-100 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                    <Building2 size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-black text-slate-800 text-base tracking-tight truncate" style={{maxWidth:'220px'}}>{building.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Home size={14} />
                        {occupiedUnits}/{totalUnits} {t('directory.unitsOccupied')}
                      </span>
                      {assignedStaff.length > 0 && (
                        <span className="flex items-center gap-1">
                          <UserIcon size={14} />
                          {assignedStaff.map(s => s.name).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {pendingCount > 0 && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1">
                      <Clock size={12} />
                      {pendingCount} {t('directory.pending')}
                    </span>
                  )}
                  {tenants.filter(t => t.isExpiringSoon).length > 0 && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-bold flex items-center gap-1">
                      <AlertTriangle size={14} />
                      {tenants.filter(t => t.isExpiringSoon).length} {t('directory.expiringCount')}
                    </span>
                  )}
                  {isExpanded ? <ChevronDown size={24} className="text-slate-400" /> : <ChevronRight size={24} className="text-slate-400" />}
                </div>
              </button>

              {/* Financial Summary - always visible under header */}
              <div className="grid grid-cols-3 gap-0 border-t border-slate-200 bg-white">
                <div className="p-3 text-center border-r border-slate-100">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                    <TrendingUp size={11} className="text-emerald-500" />{t('entry.income')}</div>
                  <div className="text-sm font-black text-emerald-600">{totalIncome.toLocaleString()} <span className="text-[10px] text-slate-400 font-medium">{t('common.sar')}</span></div>
                </div>
                <div className="p-3 text-center border-r border-slate-100">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                    <TrendingDown size={11} className="text-rose-500" />{t('entry.expense')}</div>
                  <div className="text-sm font-black text-rose-600">{totalExpense.toLocaleString()} <span className="text-[10px] text-slate-400 font-medium">{t('common.sar')}</span></div>
                </div>
                <div className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                    <DollarSign size={11} className={netBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'} /> {t('directory.net')}
                  </div>
                  <div className={`text-sm font-black ${netBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{netBalance.toLocaleString()} <span className="text-[10px] text-slate-400 font-medium">{t('common.sar')}</span></div>
                </div>
              </div>

              {/* Tenant List */}
              {isExpanded && filteredTenants.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {filteredTenants
                    .sort((a, b) => a.daysRemaining - b.daysRemaining)
                    .map(({ contract, customer, daysRemaining }) => (
                    <div key={contract.id} className="p-4 hover:bg-slate-50 transition">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Tenant Info */}
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold">
                            {customer?.nameEn?.[0] || '?'}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800">{formatNameWithRoom(customer?.nameEn || 'Unknown', customer?.roomNumber)}</h4>
                            <p className="text-sm text-slate-500 font-arabic">{formatNameWithRoom(customer?.nameAr, customer?.roomNumber)}</p>
                            <div className="flex items-center gap-4 mt-1 text-sm">
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium">
                                {t('directory.unit')}: {contract.unitName}
                              </span>
                              <span className="text-slate-500 flex items-center gap-1">
                                <FileText size={12} />
                                Contract #{contract.contractNo}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Contact Info */}
                        <div className="flex flex-col gap-1 text-sm">
                          {customer?.mobileNo && (
                            <a href={`tel:${customer.mobileNo}`} className="flex items-center gap-2 text-slate-600 hover:text-emerald-600">
                              <Phone size={14} /> {customer.mobileNo}
                            </a>
                          )}
                          {customer?.email && (
                            <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-slate-600 hover:text-emerald-600">
                              <Mail size={14} /> {customer.email}
                            </a>
                          )}
                        </div>

                        {/* Lease Expiry Countdown */}
                        <div className={`flex flex-col items-center p-3 rounded-xl border ${getExpiryColor(daysRemaining)}`}>
                          <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide opacity-80">
                            <Timer size={12} /> {t('directory.leaseExpiry')}
                          </div>
                          <div className="text-2xl font-black">
                            {daysRemaining > 0 ? daysRemaining : 0}
                          </div>
                          <div className="text-xs">{t('directory.daysRemaining')}</div>
                          <div className="text-[10px] mt-1 opacity-70">
                            {fmtDate(contract.toDate)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {isExpanded && filteredTenants.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  <Users size={40} className="mx-auto mb-2 opacity-50" />
                  <p>{t('directory.noTenants')}</p>
                </div>
              )}
            </div>
          );
        })}

        {/* No Results */}
        {filteredBuildings.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Building2 size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No buildings found</p>
            <p className="text-sm">Try adjusting your search criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildingDirectory;
