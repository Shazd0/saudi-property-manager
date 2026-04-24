import React, { useState } from 'react';
import { saveCustomer } from '../services/firestoreService';
import { isValidSaudiIdOrIqama } from '../utils/saudiIdValidation';
import { Customer } from '../types';
import { Upload, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import SoundService from '../services/soundService';
import { fmtDate } from '../utils/dateFormat';
import { useLanguage } from '../i18n';

const BulkImportCustomers: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const [textData, setTextData] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: []
  });
  const [showResults, setShowResults] = useState(false);

  const parseCustomerData = (data: string): Array<{ name: string; country: string; idNo: string; mobile: string }> => {
    const lines = data.trim().split('\n');
    const customers: Array<{ name: string; country: string; idNo: string; mobile: string }> = [];

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 4) {
        customers.push({
          name: parts[0].trim(),
          country: parts[1].trim(),
          idNo: parts[2].trim(),
          mobile: parts[3].trim()
        });
      }
    }

    return customers;
  };

  const generateCustomerCode = (name: string, index: number): string => {
    const nameParts = name.split(' ').filter(p => p.length > 0);
    const initials = nameParts.slice(0, 2).map(p => p[0].toUpperCase()).join('');
    return `${initials}${String(index + 1).padStart(4, '0')}`;
  };

  // Auto-detect ID type based on ID number pattern
  const detectIdType = (idNo: string): string => {
    if (!idNo || !idNo.trim()) return 'National ID';
    
    const firstChar = idNo.trim()[0];
    
    if (firstChar === '1') return 'National ID';
    if (firstChar === '2') return 'Iqama';
    if (firstChar === '7') return 'COMERCEL REGISTRATION(CR)';
    if (/[A-Za-z]/.test(firstChar)) return 'Passport';
    
    return 'National ID'; // Default
  };

  const handleImport = async () => {
    SoundService.play('submit');
    setImporting(true);
    setShowResults(false);

    const parsedData = parseCustomerData(textData);
    let successCount = 0;
    let failedCount = 0;
    const errorMessages: string[] = [];

    for (let i = 0; i < parsedData.length; i++) {
      const data = parsedData[i];
      try {
        // Skip if essential data is missing (at least need a name)
        if (!data.name) {
          errorMessages.push(`Row ${i + 1}: Missing customer name`);
          failedCount++;
          continue;
        }
        // Validate Saudi ID/Iqama if present
        if (data.idNo && !isValidSaudiIdOrIqama(data.idNo)) {
          errorMessages.push(`Row ${i + 1}: Invalid Saudi National ID or Iqama (${data.idNo})`);
          failedCount++;
          continue;
        }
        // Generate mobile number if missing
        const mobileNo = data.mobile || '0500000000';
        // Auto-detect ID type based on ID number pattern
        const idType = detectIdType(data.idNo);
        const customer: Customer = {
          id: crypto.randomUUID(),
          code: generateCustomerCode(data.name, i),
          nameEn: data.name,
          nameAr: data.name, // Auto-copy English name to Arabic
          nationality: data.country || 'Unknown',
          workAddress: '',
          idNo: data.idNo || '',
          idSource: 'Al Jubail', // Auto-filled
          idType: idType, // Auto-detected based on ID number
          mobileNo: mobileNo,
          email: '',
          emailNotifications: false,
          smsNotifications: false,
          isBlacklisted: false, // All customers ACTIVE by default
          rating: 3,
          notes: 'Bulk imported on ' + fmtDate(new Date())
        };
        await saveCustomer(customer);
        successCount++;
      } catch (error: any) {
        failedCount++;
        errorMessages.push(`Row ${i + 1} (${data.name}): ${error.message}`);
      }
    }

    setResults({
      success: successCount,
      failed: failedCount,
      errors: errorMessages
    });
    setShowResults(true);
    setImporting(false);
  };

  const sampleData = `AL HERZ, ALI MANSOUR A	Saudi	1019364007	0555868384
Nahar Al Khaldi	Saudi	1047673684	0551393990
RESTORENT	Saudi		0500000000`;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="ios-card p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Upload className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Bulk Import Customers</h2>
            <p className="text-slate-500 text-sm">Import multiple customers from tab-separated data</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-sm font-bold text-slate-700 mb-2 block">
              Paste Customer Data (Tab-Separated: Name, Country, ID Number, Mobile)
            </label>
            <textarea
              value={textData}
              onChange={(e) => setTextData(e.target.value)}
              placeholder={sampleData}
              className="w-full h-96 px-4 py-3 border border-slate-300 rounded-xl font-mono text-xs resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={importing}
            />
            <p className="text-xs text-slate-500 mt-2">
              Format: Name [TAB] Nationality [TAB] ID Number [TAB] Mobile Number (one per line). All imported customers will be ACTIVE.
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleImport}
              disabled={importing || !textData.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Import Customers
                </>
              )}
            </button>

            <button
              onClick={() => {
                setTextData('');
                setShowResults(false);
                setResults({ success: 0, failed: 0, errors: [] });
              }}
              disabled={importing}
              className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors disabled:opacity-50"
            >{t('history.clear')}</button>
          </div>

          {showResults && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle className="text-emerald-600" size={24} />
                  <div>
                    <div className="text-2xl font-black text-emerald-900">{results.success}</div>
                    <div className="text-xs text-emerald-600 font-bold">Successfully Imported</div>
                  </div>
                </div>

                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
                  <XCircle className="text-rose-600" size={24} />
                  <div>
                    <div className="text-2xl font-black text-rose-900">{results.failed}</div>
                    <div className="text-xs text-rose-600 font-bold">Failed</div>
                  </div>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="text-amber-600" size={20} />
                    <h3 className="font-bold text-amber-900">Import Errors</h3>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {results.errors.map((error, idx) => (
                      <div key={idx} className="text-xs text-amber-800 font-mono">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 ios-card p-6">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-blue-600" />
          Instructions
        </h3>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">1.</span>
            <span>Copy your customer data from Excel/Google Sheets (must be tab-separated)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">2.</span>
            <span>Format: Name [TAB] Nationality [TAB] ID Number [TAB] Mobile</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">3.</span>
            <span>Paste into the text area above and click "Import Customers"</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">4.</span>
            <span><strong>All customers will be ACTIVE</strong> (not blacklisted)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">5.</span>
            <span>Missing mobile numbers will use default: 0500000000</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">6.</span>
            <span>Customer codes auto-generated (e.g., "AA0001", "NH0002")</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">7.</span>
            <span>Edit individual customers later from Customer Manager</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default BulkImportCustomers;
