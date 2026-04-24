import React, { useState } from 'react';
import { User } from '../types';
import { ShieldCheck, Lock, Mail, Phone, UserCheck, UserX, Save } from 'lucide-react';
import { useLanguage } from '../i18n';

// Emerald/light theme styles
const emeraldBg = 'bg-emerald-50';
const emeraldAccent = 'text-emerald-600';
const emeraldBtn = 'bg-emerald-500 hover:bg-emerald-600 text-white';

interface StaffPortalProps {
  currentUser: User;
}

const StaffPortal: React.FC<StaffPortalProps> = ({ currentUser }) => {
  const { t, isRTL } = useLanguage();
  // Password reset requests
  const [resetRequests, setResetRequests] = useState<Array<{customerId: string, name: string, roomNumber?: string, newPassword: string, status: 'pending'|'approved'|'rejected'}>>([]);

  // Approve/reject password reset
  const handleApprove = (id: string) => {
    setResetRequests(reqs => reqs.map(r => r.customerId === id ? {...r, status: 'approved'} : r));
    // TODO: Actually update password in backend
  };
  const handleReject = (id: string) => {
    setResetRequests(reqs => reqs.map(r => r.customerId === id ? {...r, status: 'rejected'} : r));
  };

  return (
    <div className={`min-h-screen ${emeraldBg} p-8`}>
      <h1 className={`text-2xl font-black mb-6 ${emeraldAccent}`}>Staff Portal</h1>
      <div className="rounded-xl shadow-lg bg-white p-6 mb-8">
        <h2 className="text-lg font-bold mb-4">Password Reset Requests</h2>
        {resetRequests.length === 0 ? (
          <div className="text-slate-400 text-sm">No requests pending.</div>
        ) : (
          <ul className="space-y-4">
            {resetRequests.map(r => (
              <li key={r.customerId} className="border border-emerald-100 rounded-lg p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-bold text-lg">{r.name}{r.roomNumber ? `-${r.roomNumber}` : ''}</div>
                  <div className="text-xs text-slate-500">New Password: <span className="font-mono text-emerald-700">{r.newPassword}</span></div>
                  <div className="text-xs text-slate-500">Status: <span className="font-bold">{r.status}</span></div>
                </div>
                {r.status === 'pending' && (
                  <>
                    <button className={`px-4 py-2 rounded-lg font-bold ${emeraldBtn}`} onClick={() => handleApprove(r.customerId)}><UserCheck size={16}/>{t('approval.approve')}</button>
                    <button className="px-4 py-2 rounded-lg font-bold bg-rose-500 hover:bg-rose-600 text-white" onClick={() => handleReject(r.customerId)}><UserX size={16}/>{t('approval.reject')}</button>
                  </>
                )}
                {r.status === 'approved' && <ShieldCheck size={24} className="text-emerald-500" />}
                {r.status === 'rejected' && <Lock size={24} className="text-rose-500" />}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* ...other staff features... */}
    </div>
  );
};

export default StaffPortal;
