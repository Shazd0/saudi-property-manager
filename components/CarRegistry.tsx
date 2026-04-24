
import React, { useState, useEffect, useMemo } from 'react';
import { getCustomers, getContracts } from '../services/firestoreService';
import { Search, Car, User, Smartphone, Building2, FileText, Filter, ChevronDown, ChevronUp, Hash, MapPin, Shield, Clock, CheckCircle, XCircle, LayoutGrid, List } from 'lucide-react';
import SoundService from '../services/soundService';
import type { Customer, Contract } from '../types';
import { useLanguage } from '../i18n';
import { formatNameWithRoom } from '../utils/customerDisplay';

interface CarPlateEntry {
    plate: string;
    customer: string;
    customerId: string;
    customerCode: string;
    unit: string;
    building: string;
    mobile: string;
    contractNo: string;
    contractStatus: 'Active' | 'Expired' | 'Terminated' | 'None';
    idNo: string;
    nationality: string;
}

const CarRegistry: React.FC = () => {
    const [plates, setPlates] = useState<CarPlateEntry[]>([]);
    const { t, isRTL, language } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [buildingFilter, setBuildingFilter] = useState<string>('All');
    const [sortField, setSortField] = useState<'plate' | 'customer' | 'building'>('customer');
    const [sortAsc, setSortAsc] = useState(true);
    const [viewMode, setViewMode_] = useState<'grid' | 'list'>('grid');
    const setViewMode = (v: 'grid' | 'list') => { SoundService.play('tab'); setViewMode_(v); };
    const [loading, setLoading] = useState(true);
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const [customers, contracts] = await Promise.all([
                getCustomers(),
                getContracts()
            ]);
            const custs: Customer[] = customers || [];
            const cons: Contract[] = contracts || [];

            // Build maps for customerId → best contract (prefer Active)
            // Match by customerId (Firestore doc id), customer code, and customerName as fallbacks
            const contractByCustomerId = new Map<string, Contract>();
            const contractByCustomerName = new Map<string, Contract>();
            const contractByCustomerCode = new Map<string, Contract>();
            cons.forEach(c => {
                // By customerId
                if (c.customerId) {
                    const existing = contractByCustomerId.get(c.customerId);
                    if (!existing || (c.status === 'Active' && existing.status !== 'Active')) {
                        contractByCustomerId.set(c.customerId, c);
                    }
                }
                // By customerName (normalized lowercase)
                if (c.customerName) {
                    const key = c.customerName.trim().toLowerCase();
                    const existing = contractByCustomerName.get(key);
                    if (!existing || (c.status === 'Active' && existing.status !== 'Active')) {
                        contractByCustomerName.set(key, c);
                    }
                }
            });

            const allPlates: CarPlateEntry[] = [];
            custs.forEach(c => {
                if (c.carPlates && c.carPlates.length > 0) {
                    // Try matching: by Firestore id → by customer code → by name
                    const contract =
                        contractByCustomerId.get(c.id) ||
                        (c.code ? contractByCustomerId.get(c.code) : undefined) ||
                        contractByCustomerName.get((c.nameEn || '').trim().toLowerCase()) ||
                        contractByCustomerName.get((c.nameAr || '').trim().toLowerCase()) ||
                        undefined;
                    c.carPlates.forEach(p => {
                        allPlates.push({
                            plate: p,
                            customer: formatNameWithRoom(c.nameEn, c.roomNumber),
                            customerId: c.id,
                            customerCode: c.code || '',
                            mobile: c.mobileNo,
                            unit: contract?.unitName || '—',
                            building: contract?.buildingName || '—',
                            contractNo: contract?.contractNo || '—',
                            contractStatus: contract?.status || 'None',
                            idNo: c.idNo || '',
                            nationality: c.nationality || '',
                        });
                    });
                }
            });
            setPlates(allPlates);
            setLoading(false);
        })();
    }, []);

    const buildings = useMemo(() => {
        const set = new Set(plates.map(p => p.building).filter(b => b !== '—'));
        return ['All', ...Array.from(set).sort()];
    }, [plates]);

    const filtered = useMemo(() => {
        let list = plates.filter(p =>
            p.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.contractNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.building.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.unit.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (statusFilter !== 'All') {
            list = list.filter(p => p.contractStatus === statusFilter);
        }
        if (buildingFilter !== 'All') {
            list = list.filter(p => p.building === buildingFilter);
        }
        list.sort((a, b) => {
            const valA = a[sortField].toLowerCase();
            const valB = b[sortField].toLowerCase();
            return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });
        return list;
    }, [plates, searchTerm, statusFilter, buildingFilter, sortField, sortAsc]);

    const stats = useMemo(() => ({
        total: plates.length,
        active: plates.filter(p => p.contractStatus === 'Active').length,
        expired: plates.filter(p => p.contractStatus === 'Expired').length,
        unlinked: plates.filter(p => p.contractStatus === 'None').length,
    }), [plates]);

    const toggleSort = (field: 'plate' | 'customer' | 'building') => {
        if (sortField === field) setSortAsc(!sortAsc);
        else { setSortField(field); setSortAsc(true); }
    };

    const statusColor = (s: string) => {
        if (s === 'Active') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (s === 'Expired') return 'bg-amber-100 text-amber-700 border-amber-200';
        if (s === 'Terminated') return 'bg-rose-100 text-rose-700 border-rose-200';
        return 'bg-slate-100 text-slate-500 border-slate-200';
    };

    const statusIcon = (s: string) => {
        if (s === 'Active') return <CheckCircle size={12} />;
        if (s === 'Expired') return <Clock size={12} />;
        if (s === 'Terminated') return <XCircle size={12} />;
        return <Shield size={12} />;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[500px]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-emerald-700 font-bold">{t('car.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="page-header page-header-emerald">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4"></div>
                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                                    <Car size={28} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="ph-title tracking-tight">{t('car.title')}</h1>
                                    <p className="text-emerald-100 text-sm font-medium mt-0.5">سجل المركبات — {t('car.subtitle')}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="bg-white/15 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/20">
                                <span className="text-3xl font-black">{stats.total}</span>
                                <span className="text-emerald-100 text-xs ml-2 font-bold">{t('car.vehicles')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <button onClick={() => setStatusFilter('All')} className={`p-4 rounded-2xl border-2 transition-all text-left ${statusFilter === 'All' ? 'border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-100' : 'border-slate-100 bg-white hover:border-emerald-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <Car size={16} className="text-emerald-600" />
                        <span className="text-xs font-bold text-slate-500 uppercase">{t('common.total')}</span>
                    </div>
                    <span className="text-2xl font-black text-slate-800">{stats.total}</span>
                </button>
                <button onClick={() => setStatusFilter('Active')} className={`p-4 rounded-2xl border-2 transition-all text-left ${statusFilter === 'Active' ? 'border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-100' : 'border-slate-100 bg-white hover:border-emerald-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle size={16} className="text-emerald-600" />
                        <span className="text-xs font-bold text-slate-500 uppercase">{t('common.active')}</span>
                    </div>
                    <span className="text-2xl font-black text-emerald-700">{stats.active}</span>
                </button>
                <button onClick={() => setStatusFilter('Expired')} className={`p-4 rounded-2xl border-2 transition-all text-left ${statusFilter === 'Expired' ? 'border-amber-400 bg-amber-50 shadow-lg shadow-amber-100' : 'border-slate-100 bg-white hover:border-amber-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <Clock size={16} className="text-amber-600" />
                        <span className="text-xs font-bold text-slate-500 uppercase">{t('contract.statusExpired')}</span>
                    </div>
                    <span className="text-2xl font-black text-amber-700">{stats.expired}</span>
                </button>
                <button onClick={() => setStatusFilter('None')} className={`p-4 rounded-2xl border-2 transition-all text-left ${statusFilter === 'None' ? 'border-slate-400 bg-slate-50 shadow-lg shadow-slate-100' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <Shield size={16} className="text-slate-500" />
                        <span className="text-xs font-bold text-slate-500 uppercase">{t('car.noContract')}</span>
                    </div>
                    <span className="text-2xl font-black text-slate-600">{stats.unlinked}</span>
                </button>
            </div>

            {/* Search & Filters */}
            <div className="premium-card p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <div className="relative flex-1 form-with-icon">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
                        <input
                            type="text"
                            placeholder={t('car.searchPlaceholder')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pr-4 py-3 bg-emerald-50/50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-300 focus:bg-white outline-none font-medium text-slate-800 placeholder:text-slate-400 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <select
                                value={buildingFilter}
                                onChange={e => setBuildingFilter(e.target.value)}
                                className="appearance-none pl-9 pr-8 py-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-300 cursor-pointer"
                            >
                                {buildings.map(b => <option key={b} value={b}>{b === 'All' ? t('car.allBuildings') : b}</option>)}
                            </select>
                            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
                        </div>
                        <div className="flex bg-emerald-50 rounded-xl border border-emerald-200 overflow-hidden">
                            <button onClick={() => setViewMode('grid')} className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-emerald-500 text-white' : 'text-emerald-500 hover:bg-emerald-100'}`}><LayoutGrid size={18} /></button>
                            <button onClick={() => setViewMode('list')} className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-emerald-500 text-white' : 'text-emerald-500 hover:bg-emerald-100'}`}><List size={18} /></button>
                        </div>
                    </div>
                </div>
                {(statusFilter !== 'All' || buildingFilter !== 'All' || searchTerm) && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-emerald-100">
                        <Filter size={14} className="text-emerald-500" />
                        {statusFilter !== 'All' && (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1">
                                {statusFilter} <button onClick={() => setStatusFilter('All')} className="ml-1 hover:text-emerald-900">×</button>
                            </span>
                        )}
                        {buildingFilter !== 'All' && (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1">
                                {buildingFilter} <button onClick={() => setBuildingFilter('All')} className="ml-1 hover:text-emerald-900">×</button>
                            </span>
                        )}
                        {searchTerm && (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1">
                                "{searchTerm}" <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-emerald-900">×</button>
                            </span>
                        )}
                        <button onClick={() => { setStatusFilter('All'); setBuildingFilter('All'); setSearchTerm(''); }} className="text-xs text-emerald-600 hover:text-emerald-800 font-bold underline ml-2">{t('car.clearAll')}</button>
                    </div>
                )}
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between px-1">
                <span className="text-sm font-bold text-slate-500">{filtered.length} {filtered.length !== 1 ? t('car.vehiclesFound') : t('car.vehicleFound')}</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{t('car.sort')}:</span>
                    {(['plate', 'customer', 'building'] as const).map(f => (
                        <button key={f} onClick={() => toggleSort(f)} className={`text-xs font-bold px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${sortField === f ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}>
                            {f === 'plate' ? t('car.plate') : f === 'customer' ? t('car.customer') : t('car.building')}
                            {sortField === f && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                    {filtered.map((item, idx) => {
                        const key = `${item.plate}-${item.customerId}-${idx}`;
                        const isExpanded = expandedCard === key;
                        return (
                            <div
                                key={key}
                                onClick={() => setExpandedCard(isExpanded ? null : key)}
                                className="premium-card premium-card-interactive cursor-pointer group relative overflow-hidden"
                            >
                                {/* Top accent */}
                                <div className={`h-1.5 w-full ${item.contractStatus === 'Active' ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : item.contractStatus === 'Expired' ? 'bg-gradient-to-r from-amber-400 to-orange-400' : item.contractStatus === 'Terminated' ? 'bg-gradient-to-r from-rose-400 to-pink-400' : 'bg-gradient-to-r from-slate-300 to-slate-400'}`}></div>

                                <div className="p-5">
                                    {/* Plate Badge */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-inner">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                            <span className="font-mono text-xl sm:text-2xl font-black text-slate-800 tracking-wider uppercase">{item.plate}</span>
                                        </div>
                                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusColor(item.contractStatus)}`}>
                                            {statusIcon(item.contractStatus)} {item.contractStatus === 'None' ? t('car.noContract') : item.contractStatus}
                                        </span>
                                    </div>

                                    {/* Customer Info */}
                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                                <User size={14} className="text-emerald-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-800 truncate text-sm">{item.customer}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{item.customerCode}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                                <Building2 size={14} className="text-emerald-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-700 truncate">{item.building}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{t('car.unit')}: {item.unit}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                                <FileText size={14} className="text-emerald-600" />
                                            </div>
                                            <p className="text-sm font-semibold text-slate-700">{t('car.contract')}: <span className="font-mono">{item.contractNo}</span></p>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t border-emerald-100 space-y-2 animate-fade-in">
                                            <div className="flex items-center gap-3 text-sm">
                                                <Smartphone size={14} className="text-emerald-500" />
                                                <span className="font-mono text-slate-600">{item.mobile}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                                <Hash size={14} className="text-emerald-500" />
                                                <span className="text-slate-600">{t('car.idNo')}: {item.idNo || '—'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                                <MapPin size={14} className="text-emerald-500" />
                                                <span className="text-slate-600">{item.nationality || '—'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Expand hint */}
                                <div className="flex items-center justify-center py-2 bg-emerald-50/50 border-t border-emerald-100 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    <span className="ml-1">{isExpanded ? t('car.less') : t('car.moreDetails')}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="premium-card overflow-hidden">
                    {/* Table Header */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                        <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-emerald-900" onClick={() => toggleSort('plate')}>
                            {t('car.plate')} {sortField === 'plate' && (sortAsc ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}
                        </div>
                        <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-emerald-900" onClick={() => toggleSort('customer')}>
                            {t('car.customer')} {sortField === 'customer' && (sortAsc ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}
                        </div>
                        <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-emerald-900" onClick={() => toggleSort('building')}>
                            {t('car.building')} {sortField === 'building' && (sortAsc ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}
                        </div>
                        <div className="col-span-1">{t('entry.unit')}</div>
                        <div className="col-span-2">{t('car.contract')}</div>
                        <div className="col-span-1">{t('common.status')}</div>
                        <div className="col-span-2">Mobile</div>
                    </div>
                    {/* Rows */}
                    <div className="divide-y divide-emerald-50">
                        {filtered.map((item, idx) => (
                            <div key={`${item.plate}-${idx}`} className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-2 px-5 py-3 hover:bg-emerald-50/50 transition-colors items-center">
                                <div className="col-span-2 flex items-center gap-2">
                                    <span className="font-mono text-sm font-black text-slate-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg uppercase tracking-wider">{item.plate}</span>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-sm font-bold text-slate-800 truncate">{item.customer}</p>
                                    <p className="text-[10px] text-slate-400 sm:hidden">{item.building} • {item.unit}</p>
                                </div>
                                <div className="col-span-2 text-sm text-slate-600 truncate hidden sm:block">{item.building}</div>
                                <div className="col-span-1 text-sm text-slate-600 hidden sm:block">{item.unit}</div>
                                <div className="col-span-2 text-sm font-mono text-slate-600 hidden sm:block">{item.contractNo}</div>
                                <div className="col-span-1 hidden sm:block">
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor(item.contractStatus)}`}>
                                        {statusIcon(item.contractStatus)} {item.contractStatus === 'None' ? 'N/A' : item.contractStatus}
                                    </span>
                                </div>
                                <div className="col-span-2 text-xs font-mono text-slate-500 hidden sm:block">{item.mobile}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {filtered.length === 0 && (
                <div className="text-center py-16 bg-white/80 backdrop-blur rounded-3xl border-2 border-dashed border-emerald-200">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Car size={36} className="text-emerald-400" />
                    </div>
                    <h3 className="font-bold text-slate-700 text-lg mb-1">{t('car.noVehiclesFound')}</h3>
                    <p className="text-slate-400 text-sm">{t('car.noVehiclesHint')}</p>
                    {(statusFilter !== 'All' || buildingFilter !== 'All' || searchTerm) && (
                        <button onClick={() => { setStatusFilter('All'); setBuildingFilter('All'); setSearchTerm(''); }} className="mt-4 px-6 py-2 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 transition-colors">
                            {t('car.clearAllFilters')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default CarRegistry;
