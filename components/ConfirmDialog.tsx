import React, { useEffect } from 'react';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel
}) => {
  const { t, isRTL } = useLanguage();
  // Play open sound when dialog appears
  useEffect(() => {
    if (open) SoundService.play('open');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-bounce-in">
        <h4 className="font-bold text-slate-800 mb-2">{title}</h4>
        <div className="text-slate-600 text-sm mb-6">{message}</div>
        <div className="flex justify-end gap-3">
          <button onClick={() => { SoundService.play('close'); onCancel(); }} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">{cancelLabel}</button>
          <button onClick={() => { SoundService.play(danger ? 'delete' : 'submit'); onConfirm(); }} className={`px-4 py-2 rounded-xl font-bold text-white ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
