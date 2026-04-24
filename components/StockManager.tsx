import React, { useEffect, useState, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, addDoc, updateDoc, deleteDoc, query, serverTimestamp, runTransaction } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Package, Plus, Trash2, RefreshCw, ShoppingCart, 
  List, ChevronUp, Check, X, Search, Filter, ArrowRight
} from 'lucide-react';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'stock-manager-v1';

// --- STYLES & CONSTANTS ---
const EMPTY_FORM = { name: '', qty: 1, buyingPrice: 0, sellingPrice: 0, unit: 'pcs' };


const App = ({ currentUser: propUser }) => {
  const [user, setUser] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [customers, setCustomers] = useState([]);

  // UI State
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [restockRows, setRestockRows] = useState({});
  const [toast, setToast] = useState(null);

  // Issue/Sell State
  const [issueMode, setIssueMode] = useState('consume');
  const [selectedItems, setSelectedItems] = useState({});
  const [buildingId, setBuildingId] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // --- AUTHENTICATION ---
  useEffect(() => {
    // Use the currentUser prop passed from App.tsx instead of anonymous auth
    if (propUser) {
      setUser(propUser);
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
    });
    return () => unsubscribe();
  }, [propUser]);

  // --- DATA FETCHING (FIRESTORE) ---
  useEffect(() => {
    if (!user) return;
    if (!db) {
      console.error('Firestore db is undefined! Check firebase initialization.');
      return;
    }

    const stocksRef = collection(db, 'artifacts', appId, 'public', 'data', 'stocks');
    const entriesRef = collection(db, 'artifacts', appId, 'public', 'data', 'stockEntries');
    const buildingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'buildings');
    const customersRef = collection(db, 'artifacts', appId, 'public', 'data', 'customers');

    const unsubStocks = onSnapshot(stocksRef, 
      (snap) => setStocks(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Stocks fetch error:", err)
    );

    const unsubEntries = onSnapshot(entriesRef, 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEntries(data.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)));
      },
      (err) => console.error("Entries fetch error:", err)
    );

    const unsubBuildings = onSnapshot(buildingsRef, 
      (snap) => setBuildings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubCustomers = onSnapshot(customersRef, 
      (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsubStocks();
      unsubEntries();
      unsubBuildings();
      unsubCustomers();
    };
  }, [user]);

  // --- UTILS ---
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const logEntry = async (stockId, stockName, qty, type, details) => {
    const entriesRef = collection(db, 'artifacts', appId, 'public', 'data', 'stockEntries');
    await addDoc(entriesRef, {
      stockId,
      stockName,
      qty,
      type,
      details,
      date: serverTimestamp(),
      userId: user?.uid
    });
  };

  // --- ACTIONS ---
  const handleAddItem = async () => {
    if (!addForm.name.trim()) return showToast("Name is required", "error");
    setLoading(true);
    try {
      const stocksRef = collection(db, 'artifacts', appId, 'public', 'data', 'stocks');
      const docRef = await addDoc(stocksRef, {
        name: addForm.name.trim(),
        quantity: addForm.qty,
        buyingPrice: addForm.buyingPrice,
        sellingPrice: addForm.sellingPrice,
        unit: addForm.unit,
        createdAt: serverTimestamp()
      });
      await logEntry(docRef.id, addForm.name, addForm.qty, 'INITIAL', 'Initial stock entry');
      setAddForm(EMPTY_FORM);
      setShowAddForm(false);
      showToast("Item added successfully");
    } catch (err) {
      showToast("Failed to add item", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRestock = async (stock) => {
    const row = restockRows[stock.id];
    if (!row || row.qty < 1) return;
    setLoading(true);
    try {
      const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'stocks', stock.id);
      await updateDoc(stockRef, {
        quantity: (stock.quantity || 0) + row.qty
      });
      await logEntry(stock.id, stock.name, row.qty, 'RESTOCK', `Added ${row.qty} ${stock.unit}`);
      setRestockRows(prev => { const c = { ...prev }; delete c[stock.id]; return c; });
      showToast(`Restocked ${stock.name}`);
    } catch (err) {
      showToast("Restock failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stocks', id));
      showToast("Item deleted");
    } catch (err) {
      showToast("Delete failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleIssue = async () => {
    const selectedKeys = Object.keys(selectedItems);
    if (!selectedKeys.length) return;
    setLoading(true);

    try {
      await runTransaction(db, async (transaction) => {
        for (const id of selectedKeys) {
          const item = selectedItems[id];
          const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'stocks', id);
          const stockSnap = await transaction.get(stockRef);
          
          if (!stockSnap.exists()) throw new Error("Item not found");
          const currentQty = stockSnap.data().quantity || 0;
          if (currentQty < item.qty) throw new Error(`Insufficient stock for ${stockSnap.data().name}`);

          transaction.update(stockRef, { quantity: currentQty - item.qty });
          
          const details = issueMode === 'consume' 
            ? `Consumed for building/unit: ${buildingId || 'N/A'} ${unitNumber || ''}`
            : `Sold to customer ${selectedCustomer || 'Walking'}`;

          const entriesRef = collection(db, 'artifacts', appId, 'public', 'data', 'stockEntries');
          const newEntryRef = doc(entriesRef);
          transaction.set(newEntryRef, {
            stockId: id,
            stockName: stockSnap.data().name,
            qty: -item.qty,
            type: issueMode.toUpperCase(),
            details,
            date: serverTimestamp(),
            userId: user?.uid
          });
        }
      });
      
      setSelectedItems({});
      showToast("Transaction completed");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id) => {
    setSelectedItems(prev => {
      const copy = { ...prev };
      if (copy[id]) delete copy[id];
      else {
        const stock = stocks.find(s => s.id === id);
        copy[id] = { qty: 1, unitPrice: stock?.sellingPrice || stock?.buyingPrice || 0 };
      }
      return copy;
    });
  };

  const sellTotal = useMemo(() => 
    Object.values(selectedItems).reduce((sum, it) => sum + (it.qty * it.unitPrice), 0)
  , [selectedItems]);

  const totalValue = stocks.reduce((s, k) => s + (k.quantity || 0) * (k.buyingPrice || 0), 0);

  if (!user) return <div className="flex items-center justify-center h-screen text-slate-500">Connecting...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl shadow-2xl text-white font-bold animate-bounce ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200 text-white">
              <Package size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Stock Pro</h1>
              <p className="text-slate-500 font-medium">Real-time Inventory Management</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <div className="bg-white border px-6 py-3 rounded-2xl shadow-sm text-center">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Total Value</div>
              <div className="text-xl font-black text-indigo-600">{totalValue.toLocaleString()} <span className="text-xs">SAR</span></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1.5 bg-slate-200/50 rounded-2xl w-fit mb-8 gap-1">
          {[
            { id: 'inventory', icon: <Package size={18} />, label: 'Inventory' },
            { id: 'issue', icon: <ShoppingCart size={18} />, label: 'Issue / Sell' },
            { id: 'log', icon: <List size={18} />, label: 'History' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Inventory Content */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">In-Stock Items</h2>
              <button 
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-100"
              >
                {showAddForm ? <X size={20} /> : <Plus size={20} />}
                {showAddForm ? 'Cancel' : 'New Item'}
              </button>
            </div>

            {showAddForm && (
              <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Item Name</label>
                    <input 
                      className="w-full mt-1 p-4 bg-slate-50 border-0 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      placeholder="e.g. Copper Pipe 1/2 inch"
                      value={addForm.name}
                      onChange={e => setAddForm({...addForm, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Unit</label>
                    <select 
                      className="w-full mt-1 p-4 bg-slate-50 border-0 rounded-2xl outline-none"
                      value={addForm.unit}
                      onChange={e => setAddForm({...addForm, unit: e.target.value})}
                    >
                      {['pcs','box','kg','ltr','m','roll'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Initial Qty</label>
                    <input 
                      type="number"
                      className="w-full mt-1 p-4 bg-slate-50 border-0 rounded-2xl outline-none"
                      value={addForm.qty}
                      onChange={e => setAddForm({...addForm, qty: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Buying Price</label>
                    <input 
                      type="number"
                      className="w-full mt-1 p-4 bg-slate-50 border-0 rounded-2xl outline-none"
                      value={addForm.buyingPrice}
                      onChange={e => setAddForm({...addForm, buyingPrice: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Selling Price</label>
                    <input 
                      type="number"
                      className="w-full mt-1 p-4 bg-slate-50 border-0 rounded-2xl outline-none"
                      value={addForm.sellingPrice}
                      onChange={e => setAddForm({...addForm, sellingPrice: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddItem}
                  disabled={loading}
                  className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg transition-all shadow-lg shadow-emerald-100"
                >
                  Create Product
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stocks.map(item => (
                <div key={item.id} className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">{item.name}</h3>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">{item.unit}</span>
                    </div>
                    <button 
                      onClick={() => handleDelete(item.id, item.name)}
                      className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  <div className="flex items-end justify-between">
                    <div>
                      <div className={`text-4xl font-black ${item.quantity <= 5 ? 'text-rose-500' : 'text-slate-800'}`}>
                        {item.quantity}
                      </div>
                      <div className="text-xs font-bold text-slate-400 uppercase">Current Stock</div>
                    </div>
                    <div className="text-right">
                      <div className="text-indigo-600 font-bold">{item.sellingPrice} SAR</div>
                      <div className="text-[10px] text-slate-400 uppercase">Sales Price</div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-50">
                    {restockRows[item.id] ? (
                      <div className="flex gap-2 animate-in zoom-in-95">
                        <input 
                          autoFocus
                          type="number"
                          className="w-full p-2 bg-slate-50 rounded-xl outline-none font-bold"
                          value={restockRows[item.id].qty}
                          onChange={e => setRestockRows({...restockRows, [item.id]: { qty: parseInt(e.target.value) || 0 }})}
                        />
                        <button onClick={() => handleRestock(item)} className="bg-emerald-500 text-white p-2 rounded-xl"><Check size={20}/></button>
                        <button onClick={() => setRestockRows(prev => {const c={...prev}; delete c[item.id]; return c})} className="bg-slate-100 text-slate-400 p-2 rounded-xl"><X size={20}/></button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setRestockRows({...restockRows, [item.id]: { qty: 1 }})}
                        className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-2xl font-bold text-sm hover:bg-indigo-600 hover:text-white transition-all"
                      >
                        Restock
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Issue Tab */}
        {activeTab === 'issue' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-6">
                  <button 
                    onClick={() => setIssueMode('consume')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${issueMode === 'consume' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Consumption
                  </button>
                  <button 
                    onClick={() => setIssueMode('sell')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${issueMode === 'sell' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Sale
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select 
                    className="p-4 bg-slate-50 rounded-2xl outline-none font-medium text-sm"
                    value={buildingId}
                    onChange={e => setBuildingId(e.target.value)}
                  >
                    <option value="">Select Building</option>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <input 
                    className="p-4 bg-slate-50 rounded-2xl outline-none font-medium text-sm"
                    placeholder="Unit / Room #"
                    value={unitNumber}
                    onChange={e => setUnitNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {stocks.map(s => (
                  <button 
                    key={s.id} 
                    onClick={() => toggleItem(s.id)}
                    disabled={s.quantity === 0}
                    className={`p-4 rounded-3xl border-2 text-left transition-all ${selectedItems[s.id] ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'bg-white border-transparent hover:border-slate-200'} ${s.quantity === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="font-bold text-sm mb-1 truncate">{s.name}</div>
                    <div className="text-xs font-bold text-slate-400">{s.quantity} {s.unit} avail.</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-100 h-fit sticky top-8">
              <h3 className="text-xl font-black mb-6 flex items-center justify-between">
                Cart Summary
                <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs">{Object.keys(selectedItems).length} items</span>
              </h3>
              
              <div className="space-y-4 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(selectedItems).map(([id, item]) => {
                  const stock = stocks.find(s => s.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-bold text-sm truncate">{stock?.name}</div>
                        <div className="text-xs text-slate-400">{item.unitPrice} SAR/unit</div>
                      </div>
                      <div className="flex items-center bg-slate-50 rounded-xl px-2">
                        <input 
                          type="number" 
                          className="w-10 bg-transparent text-center font-bold p-2 outline-none"
                          value={item.qty}
                          onChange={e => setSelectedItems({...selectedItems, [id]: {...item, qty: parseInt(e.target.value) || 1}})}
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(selectedItems).length === 0 && (
                  <div className="text-center py-10">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <ShoppingCart size={24} />
                    </div>
                    <p className="text-sm font-bold text-slate-400">Cart is empty</p>
                  </div>
                )}
              </div>

              {issueMode === 'sell' && (
                <div className="border-t pt-6 mb-8">
                  <div className="flex justify-between items-end">
                    <div className="text-slate-400 font-bold text-xs uppercase">Total Payable</div>
                    <div className="text-3xl font-black text-indigo-600">{sellTotal} <span className="text-sm">SAR</span></div>
                  </div>
                </div>
              )}

              <button 
                onClick={handleIssue}
                disabled={loading || !Object.keys(selectedItems).length}
                className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-[24px] font-black text-lg transition-all flex items-center justify-center gap-3 disabled:opacity-30 shadow-2xl"
              >
                {loading ? <RefreshCw className="animate-spin" /> : 'Confirm Order'}
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Log Tab */}
        {activeTab === 'log' && (
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="p-6 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="p-6 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Item</th>
                    <th className="p-6 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Movement</th>
                    <th className="p-6 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {entries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-6 text-sm text-slate-500 font-medium">
                        {e.date?.seconds ? new Date(e.date.seconds * 1000).toLocaleDateString() : 'Pending...'}
                      </td>
                      <td className="p-6 font-bold text-slate-800">{e.stockName}</td>
                      <td className="p-6 text-center">
                        <span className={`px-4 py-1.5 rounded-full font-black text-xs ${e.qty > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {e.qty > 0 ? '+' : ''}{e.qty}
                        </span>
                      </td>
                      <td className="p-6 text-sm text-slate-500 italic max-w-xs truncate">{e.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;