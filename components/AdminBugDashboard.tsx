import React, { useState, useEffect } from 'react';
import { BugReport, RuntimeErrorReport } from '../types';
import { CheckCircle, XCircle, Zap, AlertTriangle } from 'lucide-react';
import { collection, getDocs, orderBy, query, limit } from 'firebase/firestore';
import { getDb } from '../firebase';

const AdminBugDashboard: React.FC = () => {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [runtimeErrors, setRuntimeErrors] = useState<RuntimeErrorReport[]>([]);
  const [filter, setFilter] = useState<'all'|'open'|'resolved'>('all');
  const [tab, setTab] = useState<'manual' | 'auto'>('auto');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(getDb(), 'runtime_errors'),
          orderBy('createdAt', 'desc'),
          limit(100),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        setRuntimeErrors(snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<RuntimeErrorReport, 'id'>) })));
      } catch {
        if (!cancelled) setRuntimeErrors([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = filter === 'all' ? reports : reports.filter(r => r.status === filter);
  const filteredAuto = filter === 'all'
    ? runtimeErrors
    : runtimeErrors.filter(r => r.status === filter);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-black mb-2 text-rose-700">Bugs & Auto-Fix Queue</h1>
      <p className="text-sm text-slate-500 mb-4">
        Console and runtime errors from all users are captured automatically and can trigger Cursor to fix them.
      </p>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('auto')} className={`px-4 py-2 rounded-xl font-bold ${tab === 'auto' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
          Auto errors ({runtimeErrors.length})
        </button>
        <button onClick={() => setTab('manual')} className={`px-4 py-2 rounded-xl font-bold ${tab === 'manual' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
          Manual reports ({reports.length})
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={()=>setFilter('all')} className={`px-4 py-2 rounded-xl font-bold ${filter==='all'?'bg-slate-700 text-white':'bg-slate-100 text-slate-700'}`}>All</button>
        <button onClick={()=>setFilter('open')} className={`px-4 py-2 rounded-xl font-bold ${filter==='open'?'bg-amber-500 text-white':'bg-slate-100 text-slate-700'}`}>Open</button>
        <button onClick={()=>setFilter('resolved')} className={`px-4 py-2 rounded-xl font-bold ${filter==='resolved'?'bg-emerald-600 text-white':'bg-slate-100 text-slate-700'}`}>Resolved</button>
      </div>

      {tab === 'auto' && (
        <div className="space-y-4">
          {filteredAuto.length === 0 && <div className="text-slate-400 text-center py-8">No auto-captured errors yet.</div>}
          {filteredAuto.map(r => (
            <div key={r.id} className={`rounded-2xl border p-5 shadow-sm bg-white ${r.status==='resolved'?'border-emerald-200':'border-violet-200'}`}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <AlertTriangle size={18} className="text-violet-500"/>
                <span className="font-bold text-violet-700">{r.kind}</span>
                {r.cursorStatus === 'sent' && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                    <Zap size={12}/> Sent to Cursor
                  </span>
                )}
                {r.cursorStatus === 'failed' && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Cursor webhook failed</span>
                )}
                <span className="text-xs text-slate-400 ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <div className="font-mono text-sm text-slate-800 mb-2 whitespace-pre-wrap break-words">{r.message}</div>
              {r.stack && (
                <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto mb-2 text-slate-600">{r.stack}</pre>
              )}
              <div className="text-xs text-slate-500 space-y-1">
                <div>Page: <span className="font-mono">{r.route || r.url}</span></div>
                {r.userId && <div>User: <span className="font-mono">{r.userId}</span></div>}
                {r.bookId && <div>Book: <span className="font-mono">{r.bookId}</span></div>}
                {r.cursorError && <div className="text-rose-600">Webhook: {r.cursorError}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'manual' && (
        <div className="space-y-4">
          {filtered.length === 0 && <div className="text-slate-400 text-center py-8">No manual reports found.</div>}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminBugDashboard;
