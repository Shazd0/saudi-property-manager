// SadadPaymentButton.tsx
import React, { useState } from 'react';
import { initiateSadadPayment, SadadPaymentRequest, SadadPaymentResult } from '../services/sadadService';
import { useLanguage } from '../i18n';

interface SadadPaymentButtonProps {
  amount: number;
  customerId: string;
  contractId?: string;
  description?: string;
}

const SadadPaymentButton: React.FC<SadadPaymentButtonProps> = ({ amount, customerId, contractId, description }) => {
  const { t, isRTL } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SadadPaymentResult | null>(null);

  const handlePay = async () => {
    setLoading(true);
    setResult(null);
    const res = await initiateSadadPayment({ amount, customerId, contractId, description });
    setResult(res);
    setLoading(false);
    if (res.paymentUrl) {
      window.open(res.paymentUrl, '_blank');
    }
  };

  return (
    <div>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold"
        onClick={handlePay}
        disabled={loading}
        type="button"
      >
        {loading ? 'Processing...' : 'Pay with SADAD'}
      </button>
      {result && (
        <div className="mt-2 text-sm text-emerald-700">
          {result.success ? `SADAD Number: ${result.sadadNumber}` : result.message}
        </div>
      )}
    </div>
  );
};

export default SadadPaymentButton;
