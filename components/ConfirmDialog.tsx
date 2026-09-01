import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmingLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmingLabel,
  danger = false,
  onConfirm,
  onCancel
}) => {
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) SoundService.play('open');
    if (!open) setConfirming(false);
  }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (confirming) return;
    SoundService.play(danger ? 'delete' : 'submit');
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const busyLabel = confirmingLabel || t('common.processing');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4">
      <div className="absolute inset-0 bg-black/40" onClick={confirming ? undefined : onCancel}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-bounce-in">
        <h4 className="font-bold text-slate-800 mb-2">{title}</h4>
        <div className="text-slate-600 text-sm mb-6">{message}</div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => { SoundService.play('close'); onCancel(); }}
            disabled={confirming}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className={`px-4 py-2 rounded-xl font-bold text-white inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {confirming && <RefreshCw size={14} className="animate-spin" />}
            {confirming ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
