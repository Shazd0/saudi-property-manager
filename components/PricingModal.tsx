import React, { useState } from 'react';
import { X, Check, Zap, Building2, Crown, Star, Shield, Headphones, Infinity } from 'lucide-react';
import logo from '../images/logo.png';

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
}

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    nameAr: 'المبتدئ',
    price: 4999,
    subtitle: 'Core property management essentials',
    icon: Building2,
    accentFrom: '#0d9488',
    accentTo: '#14b8a6',
    badgeBg: '#f0fdf4',
    badgeText: '#0f766e',
    checkColor: '#0d9488',
    popular: false,
    features: [
      'Buildings & units management',
      'Contracts & leases',
      'Income / expense entry',
      'Transaction history & reports',
      'PDF invoices & receipts',
      'Arabic & English UI',
    ],
    missing: [
      'Full accounting (GL, P&L, Balance Sheet)',
      'VAT / ZATCA reports',
      'Bank reconciliation',
      'Staff & HR management',
      'Cloud backup',
      'Owner & tenant portals',
      'Ejar / Absher / Nafath',
      'SADAD bills',
      'WhatsApp / push notifications',
      'AI assistant',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    nameAr: 'المحترف',
    price: 9999,
    subtitle: 'Complete accounting & compliance suite',
    icon: Star,
    accentFrom: '#059669',
    accentTo: '#0d9488',
    badgeBg: '#ecfdf5',
    badgeText: '#065f46',
    checkColor: '#059669',
    popular: true,
    features: [
      'Everything in Starter',
      'Full accounting (GL, P&L, Balance Sheet)',
      'VAT / ZATCA compliant reports',
      'Bank reconciliation',
      'Staff & HR management',
      'Cloud backup & restore',
      'Owner & tenant portals',
    ],
    missing: [
      'Ejar / Absher / Nafath integration',
      'SADAD bill payments',
      'Civil defense compliance',
      'WhatsApp / push notifications',
      'AI assistant',
      'Biometric login',
      'Staff chat',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    nameAr: 'المؤسسة',
    price: 19999,
    subtitle: 'Full Saudi PropTech platform — no limits',
    icon: Crown,
    accentFrom: '#065f46',
    accentTo: '#047857',
    badgeBg: '#f0fdf4',
    badgeText: '#064e3b',
    checkColor: '#047857',
    popular: false,
    features: [
      'Everything in Professional',
      'Ejar / Absher / Nafath integration',
      'SADAD bill payments',
      'Civil defense compliance',
      'WhatsApp / push notifications',
      'AI assistant',
      'Biometric login',
      'Staff chat',
    ],
    missing: [],
  },
];

const tableRows = [
  { label: 'Buildings & Units',             s: true,  p: true,  e: true  },
  { label: 'Contracts & Leases',            s: true,  p: true,  e: true  },
  { label: 'Income / Expense Entry',        s: true,  p: true,  e: true  },
  { label: 'Transaction History',           s: true,  p: true,  e: true  },
  { label: 'Full Accounting (GL, P&L, BS)', s: false, p: true,  e: true  },
  { label: 'VAT / ZATCA Reports',           s: false, p: true,  e: true  },
  { label: 'Bank Reconciliation',           s: false, p: true,  e: true  },
  { label: 'Staff & HR Management',         s: false, p: true,  e: true  },
  { label: 'Cloud Backup',                  s: false, p: true,  e: true  },
  { label: 'Owner & Tenant Portals',        s: false, p: true,  e: true  },
  { label: 'Ejar / Absher / Nafath',        s: false, p: false, e: true  },
  { label: 'SADAD Bills',                   s: false, p: false, e: true  },
  { label: 'Civil Defense Compliance',      s: false, p: false, e: true  },
  { label: 'WhatsApp / Push Notifications', s: false, p: false, e: true  },
  { label: 'AI Assistant',                  s: false, p: false, e: true  },
  { label: 'Biometric Login',               s: false, p: false, e: true  },
  { label: 'Staff Chat',                    s: false, p: false, e: true  },
];

const PricingModal: React.FC<PricingModalProps> = ({ open, onClose }) => {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-3xl shadow-2xl shadow-emerald-900/20"
        style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header — Amlak emerald gradient ── */}
        <div
          className="relative overflow-hidden px-6 sm:px-8 pt-8 pb-7 text-center"
          style={{ background: 'linear-gradient(135deg,#065f46 0%,#059669 45%,#0d9488 100%)' }}
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%,#fff 1px,transparent 1px),radial-gradient(circle at 80% 20%,#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(255,255,255,0.12) 0%,transparent 70%)', filter: 'blur(24px)' }} />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(255,255,255,0.08) 0%,transparent 70%)', filter: 'blur(20px)' }} />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/10 z-10"
          >
            <X size={20} />
          </button>

          <div className="relative z-10 flex justify-center mb-4">
            <img src={logo} alt="Amlak" className="w-14 h-14 object-contain drop-shadow-md" />
          </div>
          <div className="relative z-10 inline-flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-4 py-1.5 mb-4">
            <Zap size={12} className="text-emerald-200" />
            <span className="text-white/90 text-[11px] font-black uppercase tracking-widest">One-Time Purchase · No Subscription · دفعة واحدة</span>
          </div>
          <h2 className="relative z-10 text-3xl sm:text-4xl font-black text-white tracking-tight mb-1">
            Own Amlak <span className="text-emerald-200">Forever</span>
          </h2>
          <p className="relative z-10 text-white/65 text-sm">Pay once — no monthly fees, no hidden charges</p>

          <div className="relative z-10 flex flex-wrap justify-center gap-5 mt-5">
            {[
              { icon: Shield, text: 'ZATCA Compliant' },
              { icon: Headphones, text: 'Lifetime Updates' },
              { icon: Infinity, text: 'No Subscription' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 text-white/70 text-xs font-semibold">
                <Icon size={12} className="text-emerald-200" />
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* ── Plan Cards ── */}
        <div className="px-4 sm:px-8 pt-8 pb-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isSelected = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl bg-white transition-all duration-300 cursor-pointer ${
                  plan.popular
                    ? 'shadow-xl shadow-emerald-100 scale-[1.02] md:scale-[1.04]'
                    : isSelected
                    ? 'shadow-lg shadow-slate-200 scale-[1.01]'
                    : 'shadow-md shadow-slate-100 hover:shadow-lg hover:scale-[1.01]'
                }`}
                style={{
                  border: plan.popular
                    ? '2px solid #059669'
                    : isSelected
                    ? '1.5px solid #0d9488'
                    : '1.5px solid #e2e8f0',
                }}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <div
                      className="text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-lg whitespace-nowrap"
                      style={{ background: 'linear-gradient(90deg,#059669,#0d9488)', boxShadow: '0 4px 14px rgba(5,150,105,0.4)' }}
                    >
                      ⚡ Most Popular
                    </div>
                  </div>
                )}

                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="p-3 rounded-xl shadow-md"
                      style={{ background: `linear-gradient(135deg,${plan.accentFrom},${plan.accentTo})` }}
                    >
                      <Icon size={20} className="text-white" />
                    </div>
                    <span
                      className="text-[10px] font-black px-2.5 py-1 rounded-full"
                      style={{ background: plan.badgeBg, color: plan.badgeText }}
                    >
                      {plan.nameAr}
                    </span>
                  </div>

                  <h3 className="text-slate-800 font-black text-xl tracking-tight">{plan.name}</h3>
                  <p className="text-slate-400 text-xs mt-0.5 mb-5 leading-relaxed">{plan.subtitle}</p>

                  <div className="mb-6 pb-5" style={{ borderBottom: '1px dashed #e2e8f0' }}>
                    <div className="flex items-end gap-1">
                      <span className="text-slate-400 text-xs font-bold self-start mt-2">SAR</span>
                      <span
                        className="text-5xl font-black leading-none"
                        style={{ background: `linear-gradient(135deg,${plan.accentFrom},${plan.accentTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                      >
                        {plan.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] font-semibold mt-1 uppercase tracking-wide">One-time payment · دفعة واحدة</div>
                  </div>

                  <a
                    href={`https://wa.me/966500000000?text=I'm interested in the Amlak ${plan.name} plan (SAR ${plan.price.toLocaleString()})`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="block w-full text-center text-white font-black text-sm py-3 rounded-xl transition-all mb-5 hover:-translate-y-0.5"
                    style={{
                      background: `linear-gradient(135deg,${plan.accentFrom},${plan.accentTo})`,
                      boxShadow: '0 6px 18px rgba(5,150,105,0.25)',
                    }}
                  >
                    Get {plan.name} →
                  </a>

                  <div className="space-y-2.5">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-start gap-2 text-xs">
                        <Check size={13} style={{ color: plan.checkColor }} className="flex-shrink-0 mt-0.5" />
                        <span className="text-slate-600 font-medium">{f}</span>
                      </div>
                    ))}
                  </div>

                  {plan.missing.length > 0 && (
                    <div className="mt-4 pt-3" style={{ borderTop: '1px solid #f1f5f9' }}>
                      <div className="text-slate-300 text-[10px] font-bold uppercase tracking-widest mb-2">Not included</div>
                      <div className="space-y-1.5">
                        {plan.missing.map(f => (
                          <div key={f} className="flex items-start gap-2 text-[11px]">
                            <X size={11} className="text-slate-300 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-300">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Comparison Table ── */}
        <div className="px-4 sm:px-8 pb-6">
          <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
            <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100">
              <span className="text-emerald-700 text-[11px] font-black uppercase tracking-widest">Full Feature Comparison</span>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-500 font-bold w-[46%] border-b border-slate-100">Feature</th>
                  <th className="text-center px-2 py-3 font-black w-[18%] border-b border-slate-100" style={{ color: '#0d9488' }}>Starter</th>
                  <th className="text-center px-2 py-3 font-black w-[18%] border-b border-slate-100" style={{ color: '#059669' }}>Pro</th>
                  <th className="text-center px-2 py-3 font-black w-[18%] border-b border-slate-100" style={{ color: '#065f46' }}>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="px-4 py-2.5 text-slate-600 font-medium">{row.label}</td>
                    <td className="text-center px-2 py-2.5">{row.s ? <span className="font-black text-lg" style={{ color: '#0d9488' }}>✓</span> : <span className="text-slate-200 font-bold">—</span>}</td>
                    <td className="text-center px-2 py-2.5">{row.p ? <span className="font-black text-lg" style={{ color: '#059669' }}>✓</span> : <span className="text-slate-200 font-bold">—</span>}</td>
                    <td className="text-center px-2 py-2.5">{row.e ? <span className="font-black text-lg" style={{ color: '#065f46' }}>✓</span> : <span className="text-slate-200 font-bold">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-8 py-5 text-center border-t border-slate-100 bg-slate-50/50">
          <p className="text-slate-400 text-xs">
            All plans include source code delivery · للاستفسار تواصل معنا على واتساب
          </p>
          <p className="text-slate-300 text-[11px] mt-1">
            Prices in Saudi Riyal (SAR) · الأسعار بالريال السعودي · VAT may apply
          </p>
        </div>

      </div>
    </div>
  );
};

export default PricingModal;
