import React, { useState } from 'react';
import { MessageCircle, Download, CheckCircle } from 'lucide-react';
import type { AiAction } from '../services/amlakAiContext';
import { queueWhatsAppReminders } from '../services/amlakAiContext';
import { useToast } from './Toast';

interface Props {
  action: AiAction;
  userId: string;
  canSendWhatsApp: boolean;
}

const AiActionCard: React.FC<Props> = ({ action, userId, canSendWhatsApp }) => {
  const { showSuccess, showError } = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (action.type === 'whatsapp_preview') {
    const rows = action.rows;
    return (
      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/80 p-3 text-sm">
        <div className="font-bold text-violet-900 mb-2 flex items-center gap-2">
          <MessageCircle size={16} /> Payment reminders ({rows.length})
        </div>
        <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
          {rows.map((r) => (
            <div key={r.contractId} className="flex justify-between text-xs text-slate-700">
              <span className="truncate flex-1">{r.customerName} · {r.unitName}</span>
              <span className="font-mono ms-2">{r.remaining.toLocaleString()} SAR</span>
            </div>
          ))}
        </div>
        {canSendWhatsApp && !done ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { queued } = await queueWhatsAppReminders(rows, userId);
                showSuccess(`Queued ${queued} WhatsApp reminder(s)`);
                setDone(true);
              } catch (e: any) {
                showError(e?.message || 'Failed to queue');
              } finally {
                setBusy(false);
              }
            }}
            className="w-full py-2 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? '…' : 'Confirm & queue'}
          </button>
        ) : done ? (
          <p className="text-xs text-emerald-700 flex items-center gap-1">
            <CheckCircle size={14} /> Queued
          </p>
        ) : (
          <p className="text-xs text-slate-500">Manager/Admin only</p>
        )}
      </div>
    );
  }

  if (action.type === 'export_table') {
    const csv = [
      action.headers.join(','),
      ...action.rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm overflow-x-auto">
        <div className="font-bold text-slate-800 mb-2">{action.title}</div>
        <table className="w-full text-xs mb-2">
          <thead>
            <tr>
              {action.headers.map((h) => (
                <th key={h} className="text-start py-1 px-1 border-b font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {action.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="py-1 px-1 border-b border-slate-100">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={() => {
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${action.title.replace(/\s+/g, '_')}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showSuccess('Downloaded CSV');
          }}
          className="flex items-center gap-1 text-xs text-blue-600 font-bold"
        >
          <Download size={14} /> Download CSV
        </button>
      </div>
    );
  }

  return null;
};

export default AiActionCard;
