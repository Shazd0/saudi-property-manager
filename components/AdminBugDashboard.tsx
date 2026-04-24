import React, { useState, useEffect } from 'react';
import { BugReport } from '../types';
import { CheckCircle, XCircle } from 'lucide-react';



const AdminBugDashboard: React.FC = () => {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [filter, setFilter] = useState<'all'|'open'|'resolved'>('all');

  useEffect(() => {
    // TODO: fetch from Firestore
    setReports([]);
  }, []);

  const filtered = filter === 'all' ? reports : reports.filter(r => r.status === filter);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-black mb-4 text-rose-700">Bugs & Complaints</h1>
      <div className="flex gap-2 mb-4">
        <button onClick={()=>setFilter('all')} className={`px-4 py-2 rounded-xl font-bold ${filter==='all'?'bg-rose-600 text-white':'bg-slate-100 text-slate-700'}`}>All</button>
        <button onClick={()=>setFilter('open')} className={`px-4 py-2 rounded-xl font-bold ${filter==='open'?'bg-amber-500 text-white':'bg-slate-100 text-slate-700'}`}>Open</button>
        <button onClick={()=>setFilter('resolved')} className={`px-4 py-2 rounded-xl font-bold ${filter==='resolved'?'bg-emerald-600 text-white':'bg-slate-100 text-slate-700'}`}>Resolved</button>
      </div>
      <div className="space-y-4">
        {filtered.length === 0 && <div className="text-slate-400 text-center py-8">No reports found.</div>}
        {filtered.map(r => (
          <div key={r.id} className={`rounded-2xl border p-5 shadow-sm bg-white flex flex-col sm:flex-row gap-4 items-start sm:items-center ${r.status==='resolved'?'border-emerald-200':'border-rose-200'}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {r.status==='resolved'
                  ? <CheckCircle size={18} className="text-emerald-500"/>
                  : <XCircle size={18} className="text-rose-500"/>
                }
                <span className={`font-bold ${r.status==='resolved'?'text-emerald-700':'text-rose-700'}`}>{r.status.toUpperCase()}</span>
                <span className="text-xs text-slate-400 ml-2">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <div className="font-bold text-slate-700 mb-1">{r.description}</div>
              <div className="text-xs text-slate-500 mb-1">Page: <span className="font-mono">{r.pageUrl}</span></div>
              {r.elementSelector && <div className="text-xs text-rose-500 mb-1">Location: <span className="font-mono">{r.elementSelector}</span></div>}
              {r.screenshotUrl && <img src={r.screenshotUrl} alt="Screenshot" className="rounded-lg border border-slate-200 mb-2 max-w-xs" />}
              {r.adminNote && <div className="text-xs text-emerald-700 mt-1">Note: {r.adminNote}</div>}
            </div>
            {/* TODO: Add resolve button, admin note, etc. */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminBugDashboard;
