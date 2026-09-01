import React, { useState, useEffect, useMemo } from 'react';
import { Scale, Upload, Search, X, Link2, Sparkles, Split } from 'lucide-react';
import { useToast } from './Toast';
import { getBankStatements, saveBankStatement, getReconciliationRecords, saveReconciliationRecord, getTransactions, getBanks } from '../services/firestoreService';
import type { BankStatement, ReconciliationRecord, Transaction } from '../types';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';
import {
  detectRecurringPatterns,
  findBestMatch,
  findSplitMatchCandidates,
  getMatchedTransactionIds,
  loadReconciliationHints,
  recordLearnedHint,
  suggestUnmatched,
} from '../utils/reconciliationEngine';

const STATUS_COLORS: Record<string, string> = {
  Matched: 'bg-emerald-100 text-emerald-700',
  Unmatched: 'bg-amber-100 text-amber-700',
  Disputed: 'bg-rose-100 text-rose-700',
  Ignored: 'bg-slate-100 text-slate-500',
};

const BankReconciliation: React.FC = () => {
  const { t } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [manualEntry, setManualEntry] = useState({ bankName: '', transactionDate: '', description: '', referenceNo: '', debit: 0, credit: 0 });
  const [matchModal, setMatchModal] = useState<BankStatement | null>(null);
  const [splitModal, setSplitModal] = useState<BankStatement | null>(null);
  const [splitSelected, setSplitSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'statements' | 'unmatched' | 'insights'>('statements');

  const load = async () => {
    setLoading(true);
    try {
      const [s, r, tx, b] = await Promise.all([
        getBankStatements(),
        getReconciliationRecords(),
        getTransactions(),
        getBanks(),
      ]);
      setStatements((s || []) as BankStatement[]);
      setReconciliations((r || []) as ReconciliationRecord[]);
      setTransactions((tx || []) as Transaction[]);
      setBanks(b || []);
    } catch (err) {
      console.error('Failed to load bank data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reconMap = useMemo(() => {
    const map: Record<string, ReconciliationRecord> = {};
    reconciliations.forEach((r) => {
      map[r.bankStatementId] = r;
    });
    return map;
  }, [reconciliations]);

  const matchedTxIds = useMemo(
    () => getMatchedTransactionIds(reconciliations),
    [reconciliations],
  );

  const recurringPatterns = useMemo(
    () => detectRecurringPatterns(transactions),
    [transactions],
  );

  const reconCtx = useMemo(
    () => ({
      hints: loadReconciliationHints(),
      recurringPatterns,
      matchedTxIds: new Set(matchedTxIds),
    }),
    [recurringPatterns, matchedTxIds],
  );

  const addManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    SoundService.play('submit');
    if (!manualEntry.bankName || !manualEntry.transactionDate) {
      showError('Bank name and date required');
      return;
    }
    const stmt: BankStatement = {
      id: crypto.randomUUID(),
      bankName: manualEntry.bankName,
      transactionDate: manualEntry.transactionDate,
      statementDate: manualEntry.transactionDate,
      description: manualEntry.description,
      referenceNo: manualEntry.referenceNo,
      debit: Number(manualEntry.debit) || 0,
      credit: Number(manualEntry.credit) || 0,
      createdAt: Date.now(),
    };
    setSaving(true);
    try {
      await saveBankStatement(stmt);
      showSuccess('Statement entry added');
      setManualEntry({ bankName: '', transactionDate: '', description: '', referenceNo: '', debit: 0, credit: 0 });
      load();
    } catch (err: any) {
      showError(err.message || 'Failed to save statement');
    } finally {
      setSaving(false);
    }
  };

  const importCSV = async () => {
    if (!csvText.trim()) {
      showError('Paste CSV data first');
      return;
    }
    const lines = csvText.trim().split('\n');
    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));
      if (cols.length < 4) continue;
      const stmt: BankStatement = {
        id: crypto.randomUUID(),
        bankName: selectedBank || cols[0] || 'Unknown',
        transactionDate: cols[1] || new Date().toISOString().slice(0, 10),
        statementDate: cols[1] || new Date().toISOString().slice(0, 10),
        description: cols[2] || '',
        referenceNo: cols[3] || '',
        debit: Number(cols[4]) || 0,
        credit: Number(cols[5]) || 0,
        importBatchId: `batch-${Date.now()}`,
        createdAt: Date.now(),
      };
      await saveBankStatement(stmt);
      imported++;
    }
    showSuccess(`Imported ${imported} statement entries`);
    setCsvText('');
    setIsEntryOpen(false);
    load();
  };

  const autoMatch = async () => {
    let matchCount = 0;
    const unmatchedStatements = statements.filter((s) => !reconMap[s.id]);
    const ctx = {
      ...reconCtx,
      matchedTxIds: new Set(matchedTxIds),
    };

    for (const stmt of unmatchedStatements) {
      const splitIds = findSplitMatchCandidates(stmt, transactions, ctx);
      if (splitIds && splitIds.length >= 2) {
        const txs = splitIds.map((id) => transactions.find((t) => t.id === id)!);
        const recon: ReconciliationRecord = {
          id: crypto.randomUUID(),
          bankStatementId: stmt.id,
          transactionId: splitIds[0],
          transactionIds: splitIds,
          allocatedAmounts: txs.map((t) => t.amount),
          status: 'Matched',
          matchType: 'Split',
          matchConfidence: 90,
          matchReasons: ['split_sum'],
          createdAt: Date.now(),
        };
        await saveReconciliationRecord(recon);
        splitIds.forEach((id) => ctx.matchedTxIds.add(id));
        matchCount++;
        continue;
      }

      const best = findBestMatch(stmt, transactions, ctx);
      if (best) {
        const recon: ReconciliationRecord = {
          id: crypto.randomUUID(),
          bankStatementId: stmt.id,
          transactionId: best.transactionId,
          status: 'Matched',
          matchType: 'Auto',
          matchConfidence: best.score,
          matchReasons: best.reasons,
          createdAt: Date.now(),
        };
        await saveReconciliationRecord(recon);
        ctx.matchedTxIds.add(best.transactionId);
        matchCount++;
      }
    }

    showSuccess(`Auto-matched ${matchCount} entries`);
    load();
  };

  const manualMatch = async (stmtId: string, txId: string) => {
    const stmt = statements.find((s) => s.id === stmtId);
    const tx = transactions.find((t) => t.id === txId);
    if (stmt && tx) recordLearnedHint(stmt, tx);

    const recon: ReconciliationRecord = {
      id: crypto.randomUUID(),
      bankStatementId: stmtId,
      transactionId: txId,
      status: 'Matched',
      matchType: 'Manual',
      matchConfidence: 100,
      matchReasons: ['manual'],
      createdAt: Date.now(),
    };
    await saveReconciliationRecord(recon);
    showSuccess('Matched manually');
    setMatchModal(null);
    load();
  };

  const saveSplitMatch = async () => {
    if (!splitModal || splitSelected.size < 2) {
      showError('Select at least 2 transactions');
      return;
    }
    const ids = Array.from(splitSelected);
    const txs = ids.map((id) => transactions.find((t) => t.id === id)!);
    const sum = txs.reduce((s, t) => s + (t.amount || 0), 0);
    const stmtAmt = splitModal.credit || splitModal.debit;
    if (Math.abs(sum - stmtAmt) >= 1) {
      showError(`Selected total ${sum} does not match statement ${stmtAmt}`);
      return;
    }
    for (const tx of txs) recordLearnedHint(splitModal, tx);

    const recon: ReconciliationRecord = {
      id: crypto.randomUUID(),
      bankStatementId: splitModal.id,
      transactionId: ids[0],
      transactionIds: ids,
      allocatedAmounts: txs.map((t) => t.amount),
      status: 'Matched',
      matchType: 'Split',
      matchConfidence: 100,
      matchReasons: ['manual_split'],
      createdAt: Date.now(),
    };
    await saveReconciliationRecord(recon);
    showSuccess(`Split-matched ${ids.length} transactions`);
    setSplitModal(null);
    setSplitSelected(new Set());
    load();
  };

  const filtered = statements
    .filter((s) => {
      const r = reconMap[s.id];
      const matchSearch =
        !search ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        (s.referenceNo || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || (r?.status || 'Unmatched') === filterStatus;
      const matchBank = !selectedBank || s.bankName === selectedBank;
      const matchDate =
        (!dateFrom || s.transactionDate >= dateFrom) && (!dateTo || s.transactionDate <= dateTo);
      return matchSearch && matchStatus && matchBank && matchDate;
    })
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

  const unmatchedSystemTx = transactions.filter(
    (t) => !matchedTxIds.has(t.id) && t.paymentMethod === 'BANK',
  );

  const unmatchedWithSuggestions = useMemo(() => {
    return statements
      .filter((s) => !reconMap[s.id])
      .map((stmt) => ({
        stmt,
        suggestion: suggestUnmatched(stmt, transactions, reconCtx),
      }))
      .filter((x) => x.suggestion);
  }, [statements, reconMap, transactions, reconCtx]);

  const stats = {
    totalStatements: statements.length,
    matched: reconciliations.filter((r) => r.status === 'Matched').length,
    unmatched: statements.length - reconciliations.filter((r) => r.status === 'Matched').length,
    unmatchedSystem: unmatchedSystemTx.length,
    totalDebit: statements.reduce((s, st) => s + st.debit, 0),
    totalCredit: statements.reduce((s, st) => s + st.credit, 0),
  };

  const getMatchedTxs = (recon?: ReconciliationRecord): Transaction[] => {
    if (!recon) return [];
    const ids = recon.transactionIds?.length
      ? recon.transactionIds
      : recon.transactionId
        ? [recon.transactionId]
        : [];
    return ids.map((id) => transactions.find((t) => t.id === id)).filter(Boolean) as Transaction[];
  };

  return (
    <div className="px-3 sm:px-6 pt-2 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Scale className="text-emerald-600" /> Bank Reconciliation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Smart match: fuzzy names, learned hints, recurring patterns, split deposits
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={autoMatch}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 flex items-center gap-1"
          >
            <Link2 size={14} /> Auto-Match
          </button>
          <button
            onClick={() => setIsEntryOpen(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700 flex items-center gap-1"
          >
            <Upload size={14} /> Import / Add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="ios-card p-4 text-center">
          <div className="text-2xl font-bold text-slate-700">{stats.totalStatements}</div>
          <div className="text-xs text-slate-500">Bank Entries</div>
        </div>
        <div className="ios-card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{stats.matched}</div>
          <div className="text-xs text-slate-500">Matched</div>
        </div>
        <div className="ios-card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{stats.unmatched}</div>
          <div className="text-xs text-slate-500">Unmatched (Bank)</div>
        </div>
        <div className="ios-card p-4 text-center">
          <div className="text-2xl font-bold text-rose-600">{stats.unmatchedSystem}</div>
          <div className="text-xs text-slate-500">Unmatched (System)</div>
        </div>
        <div className="ios-card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.totalCredit.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Total Credits (SAR)</div>
        </div>
        <div className="ios-card p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.totalDebit.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Total Debits (SAR)</div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        <button
          onClick={() => setActiveTab('statements')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'statements' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
        >
          {t('bank.tab.statements')} ({statements.length})
        </button>
        <button
          onClick={() => setActiveTab('unmatched')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'unmatched' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
        >
          {t('bank.tab.unmatched')} ({unmatchedSystemTx.length})
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'insights' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
        >
          <Sparkles size={14} className="inline me-1" /> Insights ({unmatchedWithSuggestions.length})
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('entry.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-xl text-sm"
        >
          <option value="">{t('history.allStatus')}</option>
          <option>Matched</option>
          <option>Unmatched</option>
          <option>Disputed</option>
          <option>Ignored</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : activeTab === 'insights' ? (
        <div className="space-y-2">
          {recurringPatterns.length > 0 && (
            <div className="ios-card p-4 mb-4">
              <h3 className="font-bold text-sm mb-2">Recurring patterns detected</h3>
              <ul className="text-xs text-slate-600 space-y-1">
                {recurringPatterns.map((p, i) => (
                  <li key={i}>• {p.label}</li>
                ))}
              </ul>
            </div>
          )}
          {unmatchedWithSuggestions.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No suggestions for unmatched lines.</p>
          ) : (
            unmatchedWithSuggestions.map(({ stmt, suggestion }) => (
              <div key={stmt.id} className="ios-card p-3 border-l-4 border-indigo-400">
                <p className="text-sm font-medium">{stmt.description}</p>
                <p className="text-xs text-slate-500">
                  {stmt.transactionDate} · {(stmt.credit || stmt.debit).toLocaleString()} SAR
                </p>
                {suggestion && (
                  <p className="text-xs text-indigo-700 mt-2">
                    <Sparkles size={12} className="inline" /> {suggestion.label}: {suggestion.detail} ({suggestion.confidence}%)
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setMatchModal(stmt)}
                    className="text-xs text-blue-600 font-bold"
                  >
                    Match manually
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSplitModal(stmt);
                      setSplitSelected(new Set());
                    }}
                    className="text-xs text-violet-600 font-bold flex items-center gap-1"
                  >
                    <Split size={12} /> Split deposit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'statements' ? (
        filtered.length === 0 ? (
          <div className="text-center py-12">
            <Scale size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400">No bank statements found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((stmt) => {
              const recon = reconMap[stmt.id];
              const status = recon?.status || 'Unmatched';
              const matchedTxs = getMatchedTxs(recon);
              const suggestion =
                status === 'Unmatched' ? suggestUnmatched(stmt, transactions, reconCtx) : null;

              return (
                <div key={stmt.id} className="ios-card p-3">
                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-slate-400">{stmt.transactionDate}</span>
                        <span className="text-xs font-medium text-slate-500">{stmt.bankName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>{status}</span>
                        {recon?.matchType === 'Split' && (
                          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Split</span>
                        )}
                        {recon?.matchConfidence != null && (
                          <span className="text-xs text-slate-400">{recon.matchConfidence}%</span>
                        )}
                        {recon?.matchReasons?.map((r) => (
                          <span key={r} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded">
                            {r}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm font-medium">{stmt.description}</p>
                      {matchedTxs.map((tx) => (
                        <p key={tx.id} className="text-xs text-emerald-600 mt-1">
                          → {tx.details} ({tx.amount?.toLocaleString()} SAR)
                        </p>
                      ))}
                      {suggestion && (
                        <p className="text-xs text-indigo-600 mt-1">
                          Hint: {suggestion.label} — {suggestion.detail}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      {stmt.credit > 0 && (
                        <span className="text-lg font-bold text-emerald-600">+{stmt.credit.toLocaleString()}</span>
                      )}
                      {stmt.debit > 0 && (
                        <span className="text-lg font-bold text-rose-600">-{stmt.debit.toLocaleString()}</span>
                      )}
                      {status === 'Unmatched' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setMatchModal(stmt)}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Link2 size={12} /> Match
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSplitModal(stmt);
                              setSplitSelected(new Set());
                            }}
                            className="text-xs text-violet-600 hover:underline flex items-center gap-1"
                          >
                            <Split size={12} /> Split
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {unmatchedSystemTx.length === 0 ? (
            <div className="text-center py-12 text-slate-400">All bank transactions are matched!</div>
          ) : (
            unmatchedSystemTx.map((tx) => (
              <div key={tx.id} className="ios-card p-3 border-l-4 border-amber-400">
                <div className="flex justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-400">{tx.date}</span>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">No bank match</span>
                    </div>
                    <p className="text-sm font-medium">{tx.details}</p>
                    <p className="text-xs text-slate-400">
                      {tx.buildingName} {tx.unitNumber ? `/ ${tx.unitNumber}` : ''} • {tx.bankName || 'Bank'}
                    </p>
                  </div>
                  <div className="text-lg font-bold text-emerald-600">{tx.amount.toLocaleString()} SAR</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isEntryOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setIsEntryOpen(false)}
        >
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add Bank Statements</h2>
              <button type="button" onClick={() => setIsEntryOpen(false)} className="p-1 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <h3 className="font-semibold text-sm mb-2">Manual Entry</h3>
            <form onSubmit={addManualEntry} className="space-y-3 mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Bank Name *"
                  value={manualEntry.bankName}
                  onChange={(e) => setManualEntry({ ...manualEntry, bankName: e.target.value })}
                  className="border rounded-xl px-3 py-2 text-sm"
                  required
                />
                <input
                  type="date"
                  value={manualEntry.transactionDate}
                  onChange={(e) => setManualEntry({ ...manualEntry, transactionDate: e.target.value })}
                  className="border rounded-xl px-3 py-2 text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="Ref No"
                  value={manualEntry.referenceNo}
                  onChange={(e) => setManualEntry({ ...manualEntry, referenceNo: e.target.value })}
                  className="border rounded-xl px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder={t('entry.description')}
                  value={manualEntry.description}
                  onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })}
                  className="border rounded-xl px-3 py-2 text-sm col-span-2 sm:col-span-1"
                />
                <input
                  type="number"
                  placeholder="Credit"
                  value={manualEntry.credit || ''}
                  onChange={(e) => setManualEntry({ ...manualEntry, credit: Number(e.target.value) })}
                  className="border rounded-xl px-3 py-2 text-sm"
                  min="0"
                  step="0.01"
                />
                <input
                  type="number"
                  placeholder="Debit"
                  value={manualEntry.debit || ''}
                  onChange={(e) => setManualEntry({ ...manualEntry, debit: Number(e.target.value) })}
                  className="border rounded-xl px-3 py-2 text-sm"
                  min="0"
                  step="0.01"
                />
              </div>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm disabled:opacity-60">
                {saving ? 'Saving...' : 'Add Entry'}
              </button>
            </form>
            <h3 className="font-semibold text-sm mb-2">Import from CSV</h3>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm font-mono"
              rows={6}
              placeholder="Paste CSV data here..."
            />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={importCSV} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">
                Import CSV
              </button>
              <button type="button" onClick={() => setIsEntryOpen(false)} className="px-4 py-2 border rounded-xl text-sm">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {matchModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setMatchModal(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Match Bank Entry</h2>
              <button type="button" onClick={() => setMatchModal(null)} className="p-1 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm">
              <p className="font-medium">{matchModal.description}</p>
              <p className="text-xs text-slate-500">
                {matchModal.transactionDate} • {matchModal.bankName} •{' '}
                {matchModal.credit > 0 ? `Credit: ${matchModal.credit}` : `Debit: ${matchModal.debit}`} SAR
              </p>
            </div>
            <p className="text-sm font-medium mb-2">Select matching system transaction:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {transactions
                .filter((t) => !matchedTxIds.has(t.id) && t.paymentMethod === 'BANK')
                .map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => manualMatch(matchModal.id, tx.id)}
                    className="w-full text-left p-3 border rounded-xl hover:bg-emerald-50 hover:border-emerald-300 text-sm transition"
                  >
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium">{tx.details}</p>
                        <p className="text-xs text-slate-400">
                          {tx.date} • {tx.buildingName || ''} {tx.customerName || ''}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-600">{tx.amount.toLocaleString()} SAR</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {splitModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setSplitModal(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Split deposit</h2>
              <button type="button" onClick={() => setSplitModal(null)} className="p-1 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm mb-3">
              Bank line: <strong>{(splitModal.credit || splitModal.debit).toLocaleString()} SAR</strong> — select income
              transactions that sum to this amount.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {transactions
                .filter((t) => !matchedTxIds.has(t.id) && t.paymentMethod === 'BANK' && t.type === 'INCOME')
                .map((tx) => {
                  const checked = splitSelected.has(tx.id);
                  return (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => {
                        const next = new Set(splitSelected);
                        if (checked) next.delete(tx.id);
                        else next.add(tx.id);
                        setSplitSelected(next);
                      }}
                      className={`w-full text-left p-3 border rounded-xl text-sm ${checked ? 'border-violet-400 bg-violet-50' : ''}`}
                    >
                      <div className="flex justify-between">
                        <span>{tx.details}</span>
                        <span className="font-bold">{tx.amount.toLocaleString()} SAR</span>
                      </div>
                    </button>
                  );
                })}
            </div>
            <button
              type="button"
              onClick={saveSplitMatch}
              className="w-full py-2 bg-violet-600 text-white rounded-xl text-sm font-bold"
            >
              Save split match ({splitSelected.size} selected)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankReconciliation;


