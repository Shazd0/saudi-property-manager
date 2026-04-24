import React, { useState } from 'react';
import { BookOpen, BookMarked, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { useBook } from '../contexts/BookContext';
import { useLanguage } from '../i18n';

const BookManager: React.FC<{ currentUser?: any }> = ({ currentUser }) => {
  const { books, activeBookId, switchBook, addBook, renameBook, removeBook } = useBook();
  const { t, isRTL } = useLanguage();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNameAr, setNewNameAr] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await addBook(newName.trim(), newNameAr.trim() || undefined);
      setNewName('');
      setNewNameAr('');
      setShowAdd(false);
    } catch (e: any) {
      setError(e.message || 'Failed to create book');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await renameBook(id, editName.trim(), editNameAr.trim() || undefined);
      setEditId(null);
    } catch (e: any) {
      setError(e.message || 'Failed to rename');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete book "${name}"?\n\nThe book will be removed from the list. All data stored under this book remains in Firestore but will no longer be accessible from the app.`)) return;
    setBusy(true);
    setError('');
    try {
      await removeBook(id);
    } catch (e: any) {
      setError(e.message || 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-emerald-100 rounded-xl">
          <BookOpen size={22} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-emerald-900">{t('nav.booksPartitions')}</h1>
          <p className="text-sm text-slate-500">Each book is a completely independent dataset</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm font-medium">{error}</div>
      )}

      {/* Book list */}
      <div className="space-y-3">
        {books.map(book => (
          <div
            key={book.id}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              activeBookId === book.id
                ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100'
                : 'border-slate-200 bg-white hover:border-emerald-300'
            }`}
          >
            {editId === book.id ? (
              <div className="flex-1 flex gap-2 flex-wrap">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="flex-1 min-w-[120px] px-3 py-1.5 border border-emerald-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Book name (EN)"
                  autoFocus
                />
                <input
                  value={editNameAr}
                  onChange={e => setEditNameAr(e.target.value)}
                  className="flex-1 min-w-[120px] px-3 py-1.5 border border-emerald-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="اسم الدفتر (عربي)"
                  dir="rtl"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => handleRename(book.id)}
                    disabled={busy || !editName.trim()}
                    className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-all"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="p-1.5 bg-slate-200 rounded-lg hover:bg-slate-300 transition-all"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <BookMarked
                  size={20}
                  className={activeBookId === book.id ? 'text-emerald-600 flex-shrink-0' : 'text-slate-400 flex-shrink-0'}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900">{book.name}</p>
                    {book.id === 'default' && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Default
                      </span>
                    )}
                    {activeBookId === book.id && (
                      <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full uppercase tracking-wider">{t('common.active')}</span>
                    )}
                  </div>
                  {book.nameAr && (
                    <p className="text-sm text-slate-500 mt-0.5" dir="rtl">{book.nameAr}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {activeBookId !== book.id && (
                    <button
                      onClick={() => switchBook(book.id)}
                      className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-all shadow-sm"
                    >
                      Switch
                    </button>
                  )}
                  <button
                    onClick={() => { setEditId(book.id); setEditName(book.name); setEditNameAr(book.nameAr || ''); }}
                    className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"
                    title="Rename"
                  >
                    <Edit2 size={14} />
                  </button>
                  {book.id !== 'default' && (
                    <button
                      onClick={() => handleDelete(book.id, book.name)}
                      disabled={busy}
                      className="p-1.5 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 disabled:opacity-50 transition-all"
                      title="Delete book"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new book */}
      {showAdd ? (
        <div className="mt-4 p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl">
          <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
            <Plus size={16} /> New Book
          </h3>
          <div className="space-y-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Book name (English)"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <input
              value={newNameAr}
              onChange={e => setNewNameAr(e.target.value)}
              className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="اسم الدفتر بالعربي (اختياري)"
              dir="rtl"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAdd}
              disabled={busy || !newName.trim()}
              className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              {busy ? 'Creating…' : 'Create Book'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewName(''); setNewNameAr(''); }}
              className="px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300 transition-all"
            >{t('common.cancel')}</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-emerald-300 rounded-xl text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 transition-all font-semibold text-sm"
        >
          <Plus size={18} />
          Add New Book
        </button>
      )}

      {/* Info box */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <h3 className="font-semibold text-amber-900 mb-2 text-sm">About Books</h3>
        <ul className="text-xs text-amber-800 space-y-1 leading-relaxed">
          <li>• Each book has its own buildings, transactions, contracts, customers, and all financial data</li>
          <li>• Staff accounts and system settings are <strong>shared</strong> across all books</li>
          <li>• Switch between books using the book selector in the sidebar at any time</li>
          <li>• The active book name is shown at the top of the sidebar</li>
          <li>• Deleting a book only removes it from the list — the underlying Firestore data is preserved</li>
        </ul>
      </div>
    </div>
  );
};

export default BookManager;
