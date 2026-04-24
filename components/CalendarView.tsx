
import React, { useState, useEffect } from 'react';
import { getContracts, getTransactions, getCustomers } from '../services/firestoreService';
import { Contract, Transaction, TransactionType } from '../types';
import { ChevronLeft, ChevronRight, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { useLanguage } from '../i18n';
import { buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';

const CalendarView: React.FC = () => {
  const { t, isRTL, language } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => { (async () => { await loadEvents(); })(); }, [currentDate, language]);

  const loadEvents = async () => {
    const contracts = await getContracts() || [];
    const transactions = await getTransactions() || [];
    const customers = await getCustomers() || [];
    const roomMap = buildCustomerRoomMap(customers);
    const loadedEvents: any[] = [];

    // 1. Contract Expiries
    contracts.forEach(c => {
      loadedEvents.push({
        date: c.toDate,
        title: `${t('calendar.expPrefix')} #${c.contractNo}`,
        type: 'EXPIRY',
        detail: `${c.unitName} - ${formatCustomerFromMap(c.customerName, c.customerId, roomMap)}`,
        color: 'bg-rose-100 text-rose-700 border-rose-200'
      });
    });

    // 2. Income Recorded
    transactions.filter(tx => tx.type === TransactionType.INCOME).forEach(tx => {
       loadedEvents.push({
          date: tx.date,
          title: `${t('calendar.incPrefix')} ${tx.amount} SAR`,
          type: 'INCOME',
          detail: tx.details || `Unit ${tx.unitNumber}`,
          color: 'bg-emerald-100 text-emerald-700 border-emerald-200'
       });
    });

    setEvents(loadedEvents);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 bg-slate-50/50 border border-slate-100"></div>);
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date === dateStr);
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      days.push(
        <div key={day} className={`min-h-[80px] sm:min-h-[120px] bg-white border border-slate-100 p-1 sm:p-2 relative group hover:shadow-lg transition-all ${isToday ? 'ring-2 ring-emerald-500 z-10' : ''}`}>
          <div className="flex justify-between items-start mb-1">
            <span className={`text-[9px] sm:text-sm font-bold w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-emerald-500 text-white' : 'text-slate-500 group-hover:bg-slate-100'}`}>
              {day}
            </span>
          </div>
          
          <div className="space-y-0.5 overflow-y-auto max-h-[60px] sm:max-h-[80px] custom-scrollbar">
            {dayEvents.map((evt, idx) => (
              <div key={idx} className={`text-[7px] sm:text-[10px] px-0.5 sm:px-1.5 py-0.5 sm:py-1 rounded border ${evt.color} font-bold truncate cursor-help`} title={evt.detail}>
                 {evt.title}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 bg-gradient-to-r from-slate-50 to-white">
         <div className="flex items-center gap-2 sm:gap-4">
             <div className="p-2 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                 <Calendar size={18} className="sm:w-6 sm:h-6" />
             </div>
             <div>
                 <h2 className="text-lg sm:text-2xl font-black text-slate-800">
                     {currentDate.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
                 </h2>
                 <p className="text-[10px] sm:text-sm text-slate-500 font-medium">{t('calendar.eventsExpiries')}</p>
             </div>
         </div>
         <div className="flex gap-1 sm:gap-2">
             <button onClick={() => changeMonth(-1)} className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
                 <ChevronLeft size={16} className="sm:w-5 sm:h-5" />
             </button>
             <button onClick={() => setCurrentDate(new Date())} className="px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors whitespace-nowrap">{t('common.today')}</button>
             <button onClick={() => changeMonth(1)} className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
                 <ChevronRight size={16} className="sm:w-5 sm:h-5" />
             </button>
         </div>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(2024, 0, 7 + i); // Jan 7, 2024 = Sunday
            return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short' });
          }).map(d => (
              <div key={d} className="py-2 sm:py-3 text-center text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {d}
              </div>
          ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 bg-slate-100 gap-px">
          {renderCalendarDays()}
      </div>

      {/* Legend */}
      <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-6 justify-center">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-600">
              <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-rose-500"></span> {t('calendar.contractExpired')}
          </div>
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-600">
              <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-emerald-500"></span> {t('calendar.incomeReceived')}
          </div>
      </div>
    </div>
  );
};

export default CalendarView;
