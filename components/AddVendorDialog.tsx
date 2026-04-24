import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AddVendorDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (vendor: { id: string; name: string; vatNumber: string }) => void;
}

const AddVendorDialog: React.FC<AddVendorDialogProps> = ({ open, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleAdd = () => {
    if (!name.trim()) {
      setError('Vendor name is required');
      return;
    }
    setError('');
    onAdd({ id: `custom-${Date.now()}`, name: name.trim(), vatNumber: vatNumber.trim() });
    setName('');
    setVatNumber('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative animate-bounce-in">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-slate-100 rounded-full hover:bg-slate-200"><X size={18} /></button>
        <h3 className="font-bold text-lg text-amber-700 mb-2">Add New Vendor</h3>
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 mb-1">Vendor Name <span className="text-rose-500">*</span></label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="e.g. Al-Jazeera Trading Co."
          />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 mb-1">VAT Number</label>
          <input
            type="text"
            value={vatNumber}
            onChange={e => setVatNumber(e.target.value)}
            className="w-full px-3 py-2 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
            placeholder="3xxxxxxxxx3 (optional)"
          />
        </div>
        {error && <div className="text-xs text-rose-600 font-bold mb-2">{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={handleAdd} className="px-4 py-2 rounded-xl font-bold bg-amber-600 text-white hover:bg-amber-700">Add Vendor</button>
        </div>
      </div>
    </div>
  );
};

export default AddVendorDialog;
