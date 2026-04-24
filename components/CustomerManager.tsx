
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { isValidSaudiIdOrIqama } from '../utils/saudiIdValidation';
import { isValidSaudiMobile, isValidEmail, isValidSaudiVAT, isValidSaudiCR } from '../utils/validators';
import ReactDOM from 'react-dom';
import { Customer } from '../types';
import { getCustomers, saveCustomer, deleteCustomer } from '../services/firestoreService';
import { formatNameWithRoom } from '../utils/customerDisplay';
import { Save, UserPlus, Search, Briefcase, Phone, CreditCard, Trash2, Car, Plus, X, Upload, Download, Mail, Bell, CheckCircle, RotateCcw, Edit2, FileSpreadsheet, FileText, FileSignature, Receipt, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import SoundService from '../services/soundService';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Import worker as URL
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Tesseract from 'tesseract.js';
import * as XLSX from 'xlsx';
import { useLanguage } from '../i18n';

// Configure PDF.js worker from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const CustomerManager: React.FC = () => {
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();
  const { showSuccess, showError, showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [view, setView_] = useState<'LIST' | 'FORM'>('LIST');
  const setView = (v: 'LIST' | 'FORM') => { SoundService.play('tab'); setView_(v); };
  const [showDeleted, setShowDeleted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [importStatus, setImportStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const makeEmptyCustomer = (): Partial<Customer> => ({
    nameAr: '',
    nameEn: '',
    nationality: 'Saudi Arabia',
    workAddress: '',
    idNo: '',
    idSource: 'Al Jubail',
    idType: 'National ID',
    mobileNo: '',
    email: '',
    emailNotifications: true,
    smsNotifications: true,
    vatNumber: '',
    isVatRegistered: false,
    crNumber: '',
    nationalAddress: { buildingNo: '', streetName: '', district: '', city: '', postalCode: '', additionalNo: '' },
    isBlacklisted: false,
    notes: '',
    carPlates: []
  });
  const normalizeCustomer = (c: Customer): Partial<Customer> => ({
    ...makeEmptyCustomer(),
    ...c,
    nameEn: c.nameEn || '',
    nameAr: c.nameAr || '',
    nationality: c.nationality || 'Saudi Arabia',
    workAddress: c.workAddress || '',
    idNo: c.idNo || '',
    idSource: c.idSource || 'Al Jubail',
    idType: c.idType || 'National ID',
    mobileNo: c.mobileNo || '',
    email: c.email || '',
    emailNotifications: c.emailNotifications !== false,
    smsNotifications: c.smsNotifications !== false,
    vatNumber: c.vatNumber || '',
    isVatRegistered: c.isVatRegistered || false,
    crNumber: c.crNumber || '',
    nationalAddress: c.nationalAddress || { buildingNo: '', streetName: '', district: '', city: '', postalCode: '', additionalNo: '' },
    isBlacklisted: !!c.isBlacklisted,
    notes: c.notes || '',
    carPlates: c.carPlates || [],
    roomNumber: c.roomNumber || '',
  });
  const [formData, setFormData] = useState<Partial<Customer>>(makeEmptyCustomer());
  const [tempPlate, setTempPlate] = useState('');
  const [nationalities, setNationalities] = useState<string[]>([
    'Saudi Arabia', 'Egypt', 'Pakistan', 'India', 'Philippines', 'Bangladesh', 'Yemen', 'Jordan', 'Syria', 'Sudan', 'Palestine', 'Lebanon', 'Iraq', 'Other'
  ]);
  const [newNationality, setNewNationality] = useState('');
  const [confirmModal, setConfirmModal] = useState<{open: boolean; title: string; message: string; danger: boolean; action: (() => Promise<void>) | null}>({open: false, title: 'Confirm', message: '', danger: false, action: null});

  const openConfirm = (message: string, onConfirm: () => Promise<void>, opts?: { title?: string; danger?: boolean }) => {
    setConfirmModal({open: true, title: opts?.title || 'Confirm', message, danger: !!opts?.danger, action: onConfirm});
  };
  const closeConfirm = () => {
    setConfirmModal({open: false, title: 'Confirm', message: '', danger: false, action: null});
  };
  const executeConfirm = async () => {
    if (confirmModal.action) {
      try { await confirmModal.action(); } catch (e) { console.error('Confirm action failed:', e); }
    }
    closeConfirm();
  };

  // Active customers (not deleted, not blacklisted)
  const activeCustomers = useMemo(() => customers.filter((c: Customer & { deleted?: boolean }) => !(c as any).deleted && !c.isBlacklisted), [customers]);

  useEffect(() => { 
    (async () => { 
      const data = await getCustomers({ includeDeleted: true }); 
      setCustomers(data || []); 
      setFilteredCustomers(data || []); 
    })(); 
  }, []);

  useEffect(() => {
    // Filter by deleted status first
    const visibleCustomers = customers.filter((c: Customer & { deleted?: boolean }) => showDeleted ? (c as any).deleted === true : !(c as any).deleted);
    
    if (!searchTerm) { setFilteredCustomers(visibleCustomers); } 
    else {
        const lower = searchTerm.toLowerCase();
        setFilteredCustomers(visibleCustomers.filter((c: Customer) => 
          (c.nameEn?.toLowerCase() || '').includes(lower) || (c.nameAr || '').includes(lower) || (c.mobileNo || '').includes(lower) || (c.idNo || '').includes(lower) || (c.code || '').toString().includes(lower)
        ));
    }
  }, [searchTerm, customers, showDeleted]);

  const resetForm = () => {
    setFormData(makeEmptyCustomer());
    setTempPlate('');
    setNewNationality('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    
    // Strict mobile validation
    if (formData.mobileNo && formData.mobileNo.trim()) {
      const mobile = formData.mobileNo.trim();
      if (!isValidSaudiMobile(mobile)) {
        showError('Invalid mobile number. Must be 05XXXXXXXX or 5XXXXXXXX (Saudi format, 9 or 10 digits).');
        return;
      }
      const duplicateMobile = customers.find((c: Customer) => 
        c.mobileNo === mobile && c.id !== formData.id
      );
      if (duplicateMobile) {
        showError(`Mobile number ${formData.mobileNo} already exists for customer: ${duplicateMobile.nameEn || duplicateMobile.nameAr}`);
        return;
      }
    }
    
    // Check for duplicate ID number (only if not editing the same customer)
    if (formData.idNo && formData.idNo.trim()) {
      const duplicateId = customers.find((c: Customer) => 
        c.idNo === (formData.idNo || '').trim() && c.id !== formData.id
      );
      if (duplicateId) {
        showError(`ID number ${formData.idNo} already exists for customer: ${duplicateId.nameEn || duplicateId.nameAr}`);
        return;
      }
      // Validate Saudi ID/Iqama
      if (!isValidSaudiIdOrIqama(formData.idNo.trim())) {
        showError(`Invalid Saudi National ID or Iqama: ${formData.idNo}`);
        return;
      }
    }

    // Strict VAT/CR validation if VAT registered
    if (formData.isVatRegistered) {
      const vat = (formData.vatNumber || '').trim();
      if (!vat) {
        showError('VAT Number is required for VAT registered customers.');
        return;
      }
      if (!isValidSaudiVAT(vat)) {
        showError('Invalid VAT Number. Must be 15 digits, start with 3.');
        return;
      }
      const cr = (formData.crNumber || '').trim();
      if (!cr) {
        showError('CR Number is required for VAT registered customers.');
        return;
      }
      if (!isValidSaudiCR(cr)) {
        showError('Invalid CR Number. Must be 10 digits, start with 1, 2, or 7.');
        return;
      }
    }

    // Strict email validation (if provided)
    if (formData.email && formData.email.trim()) {
      if (!isValidEmail(formData.email.trim())) {
        showError('Invalid email address.');
        return;
      }
    }

    // Auto-generate customer code for new customers (based on active customers only)
    let customerCode = formData.code;
    if (!formData.id) { // New customer
      const maxCode = activeCustomers.reduce((max: number, c: Customer) => {
        const code = parseInt(c.code) || 0;
        return code > max ? code : max;
      }, 0);
      customerCode = String(maxCode + 1).padStart(2, '0'); // 01, 02, 03, etc.
    }
    
    const newCustomer: Customer = {
      ...formData as Customer,
      id: formData.id || crypto.randomUUID(),
      code: customerCode || '01'
    };
    await saveCustomer(newCustomer);
    const data = await getCustomers({ includeDeleted: true });
    setCustomers(data || []);
    setFilteredCustomers(data || []);
    setView('LIST');
    resetForm();
  };

  const handleDelete = async (id: string, name: string) => {
    openConfirm(`Move customer "${name}" to trash?`, async () => {
      const customer = customers.find((c: Customer) => c.id === id);
      if (!customer) return;
      const updated = { ...customer, deleted: true, deletedAt: Date.now() } as any;
      await saveCustomer(updated);
      const data = await getCustomers({ includeDeleted: true });
      setCustomers(data || []);
      if (view === 'FORM' && formData.id === id) {
        setView('LIST');
        resetForm();
      }
      showToast(`Customer "${name}" moved to trash.`, 'info', 6000, 'Undo', async () => {
        const restored = { ...updated, deleted: false, deletedAt: undefined } as any;
        await saveCustomer(restored);
        const refreshed = await getCustomers({ includeDeleted: true });
        setCustomers(refreshed || []);
        showSuccess(`Customer "${name}" restored.`);
      });
    });
  };

  const handleRestore = async (id: string, name: string) => {
    openConfirm(`Restore customer "${name}"?`, async () => {
      const customer = customers.find((c: Customer) => c.id === id);
      if (!customer) return;
      const updated = { ...customer, deleted: false, deletedAt: undefined } as any;
      await saveCustomer(updated);
      const data = await getCustomers({ includeDeleted: true });
      setCustomers(data || []);
      showSuccess(`Customer "${name}" restored.`);
    });
  };

  const handlePermanentDelete = async (id: string, name: string) => {
    openConfirm(`PERMANENTLY delete customer "${name}"? This cannot be undone!`, async () => {
      await deleteCustomer(id);
      const data = await getCustomers({ includeDeleted: true });
      setCustomers(data || []);
      showSuccess(`Customer "${name}" permanently deleted.`);
    }, { danger: true });
  };

  const handleRestoreAll = async () => {
    const deleted = customers.filter((c: Customer & { deleted?: boolean }) => (c as any).deleted);
    if (deleted.length === 0) {
      showError('Trash is empty.');
      return;
    }
    openConfirm(`Restore all ${deleted.length} customers from trash?`, async () => {
      for (const c of deleted) {
        const updated = { ...c, deleted: false, deletedAt: undefined } as any;
        await saveCustomer(updated);
      }
      const data = await getCustomers({ includeDeleted: true });
      setCustomers(data || []);
      showSuccess('All trashed customers restored.');
    });
  };

  const handleDeleteAllTrash = async () => {
    const deleted = customers.filter((c: Customer & { deleted?: boolean }) => (c as any).deleted);
    if (deleted.length === 0) {
      showError('Trash is empty.');
      return;
    }
    openConfirm(`PERMANENTLY delete all ${deleted.length} trashed customers? This cannot be undone!`, async () => {
      for (const c of deleted) {
        await deleteCustomer(c.id);
      }
      const data = await getCustomers({ includeDeleted: true });
      setCustomers(data || []);
      showSuccess('All trashed customers permanently deleted.');
    }, { danger: true });
  };

  const handleDeleteAllCustomers = async () => {
    openConfirm(`PERMANENTLY delete ALL ${customers.length} customers? This cannot be undone!`, async () => {
      try {
        setImportStatus('Deleting all customers...');
        let deletedCount = 0;
        for (const customer of customers) {
          try {
            await deleteCustomer(customer.id);
            deletedCount++;
          } catch (err) {
            console.error('Failed to delete customer:', customer.id, err);
          }
        }
        const data = await getCustomers({ includeDeleted: true });
        setCustomers(data || []);
        setFilteredCustomers(data || []);
        setImportStatus(`✓ Permanently deleted all ${deletedCount} customers`);
        setTimeout(() => setImportStatus(''), 5000);
      } catch (error) {
        console.error('Error deleting all customers:', error);
        setImportStatus('✗ Error deleting customers. Please try again.');
      }
    }, { danger: true, title: 'Delete All Customers' });
  };

  const handleDeleteByCodeRange = async (startCode: number, endCode: number) => {
    const targetCustomers = customers.filter((c: Customer) => {
      const code = parseInt(c.code) || 0;
      return code >= startCode && code <= endCode;
    });

    if (targetCustomers.length === 0) {
      showError(`No customers found with codes between ${startCode} and ${endCode}`);
      return;
    }

    openConfirm(
      `PERMANENTLY delete customers ${startCode}-${endCode}? This will delete ${targetCustomers.length} records and cannot be undone!`,
      async () => {
        try {
          setImportStatus(`Deleting customers ${startCode}-${endCode}...`);
          let deletedCount = 0;
          for (const customer of targetCustomers) {
            try {
              await deleteCustomer(customer.id);
              deletedCount++;
            } catch (err) {
              console.error('Failed to delete customer:', customer.id, err);
            }
          }
          const data = await getCustomers({ includeDeleted: true });
          setCustomers(data || []);
          setFilteredCustomers(data || []);
          setImportStatus(`✓ Permanently deleted ${deletedCount} customers (codes ${startCode}-${endCode})`);
          setTimeout(() => setImportStatus(''), 5000);
        } catch (error) {
          console.error('Delete by code range error:', error);
          setImportStatus('✗ Failed to delete customers');
          setTimeout(() => setImportStatus(''), 5000);
        }
      },
      { danger: true, title: 'Delete Customers' }
    );
  };

  // Import customers from backup file (JSON, CSV, or custom BKP format)
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportStatus('Processing...');
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        let importedCustomers: Partial<Customer>[] = [];
        
        const fileName = file.name.toLowerCase();

        // If BKP/JSON looks binary (e.g., zipped/encrypted), stop early with a clear message
        const looksBinary = /[\u0000-\u0008\u000E-\u001F\u007F-\u009F]/.test(content);
        if ((fileName.endsWith('.bkp') || fileName.endsWith('.json')) && looksBinary) {
          throw new Error('File appears to be binary or zipped. Please export it as JSON/CSV before importing.');
        }
        
        if (fileName.endsWith('.json') || fileName.endsWith('.bkp')) {
          // Parse JSON or BKP (assuming BKP is JSON-based)
          const data = JSON.parse(content);
          
          // Handle different JSON structures
          if (Array.isArray(data)) {
            importedCustomers = data;
          } else if (data.customers) {
            importedCustomers = data.customers;
          } else if (data.data?.customers) {
            importedCustomers = data.data.customers;
          } else if (data.tenants) {
            // Common format from other property software
            importedCustomers = data.tenants.map((t: any) => ({
              nameEn: t.name || t.tenant_name || t.full_name || '',
              nameAr: t.name_ar || t.arabic_name || '',
              mobileNo: t.phone || t.mobile || t.contact || '',
              email: t.email || '',
              idNo: t.id_number || t.civil_id || t.iqama || '',
              nationality: t.nationality || 'Saudi Arabia',
              workAddress: t.address || t.work_address || '',
            }));
          }
        } else if (fileName.endsWith('.csv')) {
          // Parse CSV
          const lines = content.split('\n');
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            if (values.length < 2) continue;
            
            const customer: Partial<Customer> = {};
            headers.forEach((header, idx) => {
              const value = values[idx] || '';
              if (header.includes('name') && header.includes('en')) customer.nameEn = value;
              else if (header.includes('name') && header.includes('ar')) customer.nameAr = value;
              else if (header === 'name' || header === 'full_name') customer.nameEn = value;
              else if (header.includes('mobile') || header.includes('phone')) customer.mobileNo = value;
              else if (header.includes('email')) customer.email = value;
              else if (header.includes('id') && (header.includes('no') || header.includes('number'))) customer.idNo = value;
              else if (header.includes('national')) customer.nationality = value;
              else if (header.includes('address')) customer.workAddress = value;
              else if (header.includes('vat')) customer.vatNumber = value;
            });
            
            if (customer.nameEn || customer.nameAr) {
              importedCustomers.push(customer);
            }
          }
        }
        
        // Save imported customers
        let successCount = 0;
        for (const cust of importedCustomers) {
          try {
            const newCustomer: Customer = {
              id: crypto.randomUUID(),
              code: '0',
              nameAr: cust.nameAr || '',
              nameEn: cust.nameEn || cust.nameAr || '',
              nationality: cust.nationality || 'Saudi Arabia',
              workAddress: cust.workAddress || '',
              idNo: cust.idNo || '',
              idSource: cust.idSource || 'Riyadh',
              idType: cust.idType || 'National ID',
              mobileNo: cust.mobileNo || '',
              email: cust.email || '',
              emailNotifications: true,
              smsNotifications: true,
              vatNumber: cust.vatNumber || '',
              isBlacklisted: cust.isBlacklisted || false,
              notes: cust.notes || '',
              carPlates: cust.carPlates || [],
            };
            await saveCustomer(newCustomer);
            successCount++;
          } catch (err) {
            console.error('Failed to import customer:', err);
          }
        }
        
        setImportStatus(`✓ Imported ${successCount} of ${importedCustomers.length} customers`);
        const data = await getCustomers({ includeDeleted: true });
        setCustomers(data || []);
        setFilteredCustomers(data || []);
        
        setTimeout(() => setImportStatus(''), 5000);
      } catch (error) {
        console.error('Import error:', error);
        setImportStatus('✗ Import failed. Check file format.');
        setTimeout(() => setImportStatus(''), 5000);
      }
    };
    
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Import customers from Excel file (columns D, E, F, G: name, nationality, idNo, mobile)
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    setImportStatus('Reading Excel file...');

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = evt.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          
          // Get Sheet1
          const sheetName = 'Sheet1';
          const worksheet = workbook.Sheets[sheetName];
          
          if (!worksheet) {
            setImportStatus('✗ Sheet1 not found in Excel file');
            setTimeout(() => setImportStatus(''), 5000);
            return;
          }

          // Convert to JSON, starting from row 1 (index 0)
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          let successCount = 0;
          let skipCount = 0;
          let errorCount = 0;
          
          // Calculate initial max code once
          const initialMaxCode = customers.reduce((max: number, c: Customer) => {
            const code = parseInt(c.code) || 0;
            return code > max ? code : max;
          }, 0);

          // Process each row (skip header row if exists)
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            // Columns: D=3, E=4, F=5, G=6 (0-indexed)
            const nameEn = row[3]?.toString().trim() || '';
            const nationality = row[4]?.toString().trim() || 'Saudi Arabia';
            const idNo = row[5]?.toString().trim() || '';
            const mobileNo = row[6]?.toString().trim() || '';

            // Skip empty rows
            if (!nameEn && !idNo && !mobileNo) continue;

            // Check for duplicate by ID number
            if (idNo) {
              const duplicate = customers.find((c: Customer) => c.idNo === idNo);
              if (duplicate) {
                skipCount++;
                continue;
              }
            }

            try {
              // Auto-generate customer code (sequential from max)
              const customerCode = String(initialMaxCode + successCount + 1).padStart(2, '0');

              const newCustomer: Customer = {
                id: crypto.randomUUID(),
                code: customerCode,
                nameEn: nameEn,
                nameAr: '',
                nationality: nationality,
                workAddress: '',
                idNo: idNo,
                idSource: 'Al Jubail',
                idType: 'National ID',
                mobileNo: mobileNo,
                email: '',
                emailNotifications: true,
                smsNotifications: true,
                vatNumber: '',
                isBlacklisted: false,
                notes: 'Imported from Excel',
                carPlates: [],
              };

              await saveCustomer(newCustomer);
              successCount++;
            } catch (err) {
              console.error('Failed to save customer:', err);
              errorCount++;
            }
          }

          // Refresh customer list
          const updatedData = await getCustomers({ includeDeleted: true });
          setCustomers(updatedData || []);
          setFilteredCustomers(updatedData || []);

          let statusMsg = `✓ Imported ${successCount} customers`;
          if (skipCount > 0) statusMsg += ` (${skipCount} duplicates skipped)`;
          if (errorCount > 0) statusMsg += ` (${errorCount} errors)`;
          
          setImportStatus(statusMsg);
          setTimeout(() => setImportStatus(''), 7000);
        } catch (error) {
          console.error('Excel processing error:', error);
          setImportStatus('✗ Failed to process Excel file');
          setTimeout(() => setImportStatus(''), 5000);
        }
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('Excel import error:', error);
      setImportStatus('✗ Failed to read Excel file');
      setTimeout(() => setImportStatus(''), 5000);
    }

    if (excelInputRef.current) excelInputRef.current.value = '';
  };

  // Import customers from PDF file (Smart column-based import with auto-code generation)
  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    setImportStatus('Reading PDF file...');

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = evt.target?.result as ArrayBuffer;
          const loadingTask = pdfjsLib.getDocument({ data } as any);
          const pdf = await loadingTask.promise;

          // Helper function to check if text is garbled/corrupted
          const isGarbled = (text: string): boolean => {
            const garbledPattern = /[ÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿªº¸·»¬µ´]/;
            const hasGarbledChars = garbledPattern.test(text);
            const specialCharCount = (text.match(/[^a-zA-Z0-9\s\-+()]/g) || []).length;
            const ratio = specialCharCount / text.length;
            return hasGarbledChars || ratio > 0.2;
          };

          const looksLikeMobile = (s: string) => /\b(\+?966|0)\d{8,9}\b/.test(s) || /\b\d{10}\b/.test(s);
          const looksLikeId = (s: string) => /\b\d{10}\b/.test(s);

          let fullText = '';
          let textItems: any[] = [];
          
          setImportStatus('Extracting text from PDF...');
          
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            
            // Store items with positions for better parsing
            textItems.push(...content.items.map((it: any) => ({
              text: it.str,
              x: it.transform[4],
              y: it.transform[5],
              width: it.width || 0
            })));
            
            // Group text by approximate Y position to identify rows in tables
            // Items with similar Y coordinates are likely on the same row
            const itemsByLine: Map<number, any[]> = new Map();
            const yThreshold = 2; // Items within 2 units of Y are on same line
            
            for (const item of content.items) {
              if ((item as any).transform && typeof (item as any).transform[5] === 'number') {
                const y = Math.round((item as any).transform[5] / yThreshold) * yThreshold;
                if (!itemsByLine.has(y)) {
                  itemsByLine.set(y, []);
                }
                itemsByLine.get(y)!.push(item);
              }
            }
            
            // Sort lines by Y position (top to bottom) and join items in each line
            const sortedLines = Array.from(itemsByLine.entries())
              .sort((a, b) => b[0] - a[0]) // Sort descending (top first)
              .map(([_, items]) => 
                items
                  .sort((a, b) => (a as any).transform[4] - (b as any).transform[4]) // Sort by X position
                  .map(it => (it as any).str || '')
                  .join(' ')
              );
            
            fullText += sortedLines.join('\n') + '\n';
          }

          console.log('Extracted text length:', fullText.length);
          console.log('Text sample:', fullText.substring(0, 500));

          // Split by multiple lines/spaces to handle table rows better
          // Try to identify table rows by looking for patterns with numbers (contract no, dates, etc)
          const rawTextLines = fullText
            .split(/[\n\r]+/)
            .map(line => line.trim())
            .filter(line => line.length > 10);
          
          console.log('Raw text lines found:', rawTextLines.length);
          rawTextLines.slice(0, 5).forEach((line, idx) => {
            console.log(`  Line ${idx}:`, line.substring(0, 100));
          });

          if (fullText.trim().length < 50) {
            setImportStatus('No embedded text found, running OCR...');
            
            // OCR fallback for scanned PDFs
            console.log('Starting OCR fallback...');
            try {
              // Create Tesseract worker
              const worker = await Tesseract.createWorker('eng', 1, {
                logger: (m: any) => {
                  console.log('Tesseract:', m);
                  if (m.status === 'recognizing text') {
                    setImportStatus(`OCR: ${Math.round(m.progress * 100)}%`);
                  } else if (m.status) {
                    setImportStatus(`OCR: ${m.status}`);
                  }
                },
                errorHandler: (err: any) => {
                  console.error('Tesseract error:', err);
                }
              });
              
              let ocrText = '';
              const pagesToProcess = Math.min(pdf.numPages, 5); // Process up to 5 pages
              
              for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
                setImportStatus(`Processing page ${pageNum}/${pagesToProcess}...`);
                console.log(`OCR page ${pageNum}/${pagesToProcess}`);
                
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2.5 }); // Higher scale for better quality
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  console.warn(`No canvas context for page ${pageNum}`);
                  continue;
                }
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({ canvasContext: ctx, viewport } as any).promise;
                console.log(`Rendered page ${pageNum}, canvas size: ${canvas.width}x${canvas.height}`);
                
                const { data } = await worker.recognize(canvas);
                const pageText = data.text || '';
                console.log(`Page ${pageNum} OCR result length: ${pageText.length}`);
                console.log(`Page ${pageNum} sample:`, pageText.substring(0, 200));
                
                ocrText += pageText + '\n';
              }
              
              await worker.terminate();
              
              fullText = ocrText;
              console.log('Total OCR extracted text length:', fullText.length);
              console.log('OCR text sample:', fullText.substring(0, 500));
            } catch (ocrError: any) {
              console.error('OCR failed:', ocrError);
              console.error('OCR error details:', ocrError?.message, ocrError?.stack);
              setImportStatus(`✗ OCR failed: ${ocrError?.message || 'Unknown error'}`);
              setTimeout(() => setImportStatus(''), 8000);
              return;
            }
          }

          const rawLines = fullText
            .split(/\n/)
            .map(l => l.trim())
            .filter(l => l.length > 5 && !isGarbled(l));

          type CustomerData = { 
            nameEn?: string; 
            nameAr?: string;
            mobileNo?: string; 
            status?: string; 
            idNo?: string;
            nationality?: string;
            email?: string;
          };
          const parsedRows: CustomerData[] = [];

          console.log('Parsing', rawLines.length, 'lines');
          console.log('Sample lines:', rawLines.slice(0, 10));
          
          // Strategy 0: Better table row detection - look for actual data rows not headers
          // Skip lines with company/header keywords
          const headerPatterns = ['cont', 'customer', 'code', 'date', 'rr millennium', 'email', 'جوال', 'statue', 'inst', 'period'];
          const potentialDataRows = rawLines.filter(line => {
            const lower = line.toLowerCase();
            return !headerPatterns.some(pattern => lower.includes(pattern));
          });
          
          console.log('Potential data rows:', potentialDataRows.length);
          potentialDataRows.slice(0, 3).forEach((row, idx) => {
            console.log(`  Data row ${idx}:`, row.substring(0, 120));
          });
          
          // Strategy 1: Look for table patterns with customer names and phone numbers
          for (const line of potentialDataRows) {
            // Try to extract name and phone from each line
            const mobileMatch = line.match(/\b(0?5\d{7,8}|966\d{8,9}|\+966\d{8,9})\b/);
            
            if (mobileMatch) {
              // Found a phone number, try to extract name
              const parts = line.split(/\s+/);
              let nameEn = '';
              let mobileNo = mobileMatch[0];
              
              // Look for words that might be a name (2-4 words before phone number)
              const phoneIndex = line.indexOf(mobileNo);
              const beforePhone = line.substring(0, phoneIndex).trim();
              const nameWords = beforePhone.split(/\s+/).filter(w => 
                w.length > 2 && 
                !/^\d+$/.test(w) && 
                !['code', 'tel', 'mobile', 'phone', 'cont', 'date', 're', 'type', 'main', 'sub'].includes(w.toLowerCase())
              );
              
              if (nameWords.length >= 1) {
                nameEn = nameWords.slice(-4).join(' '); // Take last 4 words as name
                console.log('Found:', nameEn, '→', mobileNo);
                parsedRows.push({
                  nameEn: nameEn,
                  mobileNo: mobileNo
                });
              }
            }
          }
          
          console.log('Strategy 1 result:', parsedRows.length, 'customers found');
          
          console.log('Strategy 1 found:', parsedRows.length, 'customers');

          // Strategy 2: Try to identify header row and parse table-like structure
          if (parsedRows.length === 0) {
            let headerLine: string | null = null;
            let headerIndex = -1;
            
            // Look for a line that looks like headers
            for (let i = 0; i < rawLines.length; i++) {
              const line = rawLines[i].toLowerCase();
              if (
                (line.includes('name') || line.includes('customer')) &&
                (line.includes('mobile') || line.includes('phone') || line.includes('tel'))
              ) {
                headerLine = rawLines[i];
                headerIndex = i;
                break;
              }
            }

            if (headerLine && headerIndex >= 0) {
            // Parse based on detected headers
            const headers = headerLine.split(/\t|,|\|/).map(h => h.trim().toLowerCase());
            
            // Map column names to field names (flexible matching)
            const columnMap: Record<string, string> = {};
            headers.forEach((header, idx) => {
              if (header.includes('name') && (header.includes('english') || header.includes('en') || !header.includes('arabic'))) {
                columnMap[idx] = 'nameEn';
              } else if (header.includes('name') && (header.includes('arabic') || header.includes('ar'))) {
                columnMap[idx] = 'nameAr';
              } else if (header.includes('mobile') || header.includes('phone') || header.includes('contact')) {
                columnMap[idx] = 'mobileNo';
              } else if (header.includes('id') || header.includes('iqama') || header.includes('civil')) {
                columnMap[idx] = 'idNo';
              } else if (header.includes('status')) {
                columnMap[idx] = 'status';
              } else if (header.includes('national')) {
                columnMap[idx] = 'nationality';
              } else if (header.includes('email') || header.includes('mail')) {
                columnMap[idx] = 'email';
              }
              // Ignore any 'code' or 'customer code' columns
            });

            // Parse data rows (skip header)
            for (let i = headerIndex + 1; i < rawLines.length; i++) {
              const line = rawLines[i];
              if (isGarbled(line)) continue;
              
              const parts = line.split(/\t|,|\|/).map(p => p.trim()).filter(Boolean);
              if (parts.length < 2) continue; // Need at least 2 fields
              
              const row: CustomerData = {};
              parts.forEach((value, idx) => {
                const field = columnMap[idx];
                if (field && value && !isGarbled(value)) {
                  (row as any)[field] = value;
                }
              });

              // Only add if we have minimum required fields
              if (row.nameEn && (row.mobileNo || row.idNo)) {
                parsedRows.push(row);
              }
            }
            }
          }

          // Strategy 3: Label-based parsing (key: value format)
          if (parsedRows.length === 0) {
            let buffer: CustomerData = {};
            for (const line of rawLines) {
              const lower = line.toLowerCase();
              
              // Skip lines that look like codes/numbers only
              if (/^\d+$/.test(line.trim())) continue;
              
              if (lower.includes('name') && !lower.includes('code')) {
                const val = line.split(':').slice(1).join(':').trim() || line.replace(/name/i, '').trim();
                if (!isGarbled(val) && val.length > 1) {
                  if (lower.includes('arabic') || lower.includes('ar')) {
                    buffer.nameAr = val;
                  } else {
                    buffer.nameEn = val;
                  }
                }
              } else if (lower.includes('contact') || lower.includes('phone') || lower.includes('mobile')) {
                const val = (line.split(':').slice(1).join(':').match(/\+?\d+/)?.[0] || '').trim();
                if (looksLikeMobile(val)) buffer.mobileNo = val;
              } else if (lower.includes('status')) {
                const val = line.split(':').slice(1).join(':').trim() || line.replace(/status/i, '').trim();
                if (!isGarbled(val)) buffer.status = val;
              } else if (lower.includes('id') || lower.includes('iqama') || lower.includes('civil')) {
                const val = (line.split(':').slice(1).join(':').match(/\d+/)?.[0] || '').trim();
                if (looksLikeId(val)) buffer.idNo = val;
              } else if (lower.includes('national')) {
                const val = line.split(':').slice(1).join(':').trim() || line.replace(/national/i, '').trim();
                if (!isGarbled(val)) buffer.nationality = val;
              } else if (lower.includes('email')) {
                const val = line.split(':').slice(1).join(':').trim();
                if (val.includes('@')) buffer.email = val;
              }

              // Save when we have minimum required fields
              if (buffer.nameEn && (buffer.mobileNo || buffer.idNo)) {
                parsedRows.push({ ...buffer });
                buffer = {};
              }
            }
          }

          // Strategy 4: OCR fallback for scanned PDFs
          if (parsedRows.length === 0) {
            setImportStatus('No embedded text found, running OCR...');

            let ocrText = '';
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) continue;
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              await page.render({ canvasContext: ctx, viewport } as any).promise;

              const result = await Tesseract.recognize(canvas, 'eng');
              ocrText += (result.data.text || '') + '\n';
            }

            // Re-run the same parsing logic on OCR text
            const ocrLines = ocrText.split(/\n|;|\r/).map(l => l.trim()).filter(l => l.length > 0);
            let buffer: CustomerData = {};
            for (const line of ocrLines) {
              const lower = line.toLowerCase();
              if (/^\d+$/.test(line.trim())) continue;
              
              if (lower.includes('name') && !lower.includes('code')) {
                const val = line.split(':').slice(1).join(':').trim() || line.replace(/name/i, '').trim();
                if (!isGarbled(val) && val.length > 1) buffer.nameEn = val;
              } else if (lower.includes('contact') || lower.includes('phone') || lower.includes('mobile')) {
                const val = (line.split(':').slice(1).join(':').match(/\+?\d+/)?.[0] || '').trim();
                if (looksLikeMobile(val)) buffer.mobileNo = val;
              } else if (lower.includes('id') || lower.includes('iqama')) {
                const val = (line.split(':').slice(1).join(':').match(/\d+/)?.[0] || '').trim();
                if (looksLikeId(val)) buffer.idNo = val;
              }

              if (buffer.nameEn && (buffer.mobileNo || buffer.idNo)) {
                parsedRows.push({ ...buffer });
                buffer = {};
              }
            }
          }

          if (parsedRows.length === 0) {
            setImportStatus('✗ Could not parse any customer data from PDF');
            setTimeout(() => setImportStatus(''), 7000);
            return;
          }

          // Generate sequential codes starting from max existing code
          const initialMaxCode = customers.reduce((max: number, c: Customer) => {
            const code = parseInt(c.code) || 0;
            return code > max ? code : max;
          }, 0);

          let successCount = 0;
          let skipCount = 0;
          let errorCount = 0;

          for (const row of parsedRows) {
            // Check duplicate by ID number or mobile
            if (row.idNo) {
              const duplicateId = customers.find((c: Customer) => c.idNo === row.idNo);
              if (duplicateId) { skipCount++; continue; }
            }
            if (row.mobileNo) {
              const duplicateMobile = customers.find((c: Customer) => c.mobileNo === row.mobileNo);
              if (duplicateMobile) { skipCount++; continue; }
            }

            try {
              // Auto-generate sequential customer code (IGNORE any code from PDF)
              const customerCode = String(initialMaxCode + successCount + 1).padStart(2, '0');
              
              // Map status to isBlacklisted
              const isBlacklisted = row.status && 
                (row.status.toLowerCase().includes('blacklist') || 
                 row.status.toLowerCase() === 'inactive');

              const newCustomer: Customer = {
                id: crypto.randomUUID(),
                code: customerCode,
                nameEn: row.nameEn || '',
                nameAr: row.nameAr || '',
                nationality: row.nationality || 'Saudi Arabia',
                workAddress: '',
                idNo: row.idNo || '',
                idSource: 'Al Jubail',
                idType: 'National ID',
                mobileNo: row.mobileNo || '',
                email: row.email || '',
                emailNotifications: true,
                smsNotifications: true,
                vatNumber: '',
                isBlacklisted: !!isBlacklisted,
                notes: `Imported from PDF${row.status ? ` (Status: ${row.status})` : ''}`,
                carPlates: [],
              };
              
              await saveCustomer(newCustomer);
              successCount++;
            } catch (err) {
              console.error('Failed to save customer from PDF:', err);
              errorCount++;
            }
          }

          const updatedData = await getCustomers({ includeDeleted: true });
          setCustomers(updatedData || []);
          setFilteredCustomers(updatedData || []);

          let statusMsg = `✓ Imported ${successCount} customers from PDF`;
          if (skipCount > 0) statusMsg += ` (${skipCount} duplicates skipped)`;
          if (errorCount > 0) statusMsg += ` (${errorCount} errors)`;
          setImportStatus(statusMsg);
          setTimeout(() => setImportStatus(''), 7000);

        } catch (error) {
          console.error('PDF processing error:', error);
          setImportStatus('✗ Failed to process PDF file');
          setTimeout(() => setImportStatus(''), 5000);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('PDF import error:', error);
      setImportStatus('✗ Failed to read PDF file');
      setTimeout(() => setImportStatus(''), 5000);
    }

    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  // Export customers to JSON
  const handleExport = () => {
    const dataStr = JSON.stringify({ customers, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInputChange = (field: keyof Customer, value: any) => {
    setFormData((prev: Partial<Customer>) => ({ ...prev, [field]: value }));
  };

    const addPlate = () => {
      if(tempPlate && !formData.carPlates?.includes(tempPlate)) {
        setFormData((prev: Partial<Customer>) => ({ ...prev, carPlates: [...(prev.carPlates || []), tempPlate] }));
        setTempPlate('');
      }
    };

    const removePlate = (p: string) => {
      setFormData((prev: Partial<Customer>) => ({ ...prev, carPlates: prev.carPlates?.filter((plate: string) => plate !== p) }));
    };

  // Auto-detect ID type based on ID number pattern
  const detectIdType = (idNo: string): string => {
    if (!idNo || !idNo.trim()) return 'National ID';
    
    const firstChar = idNo.trim()[0];
    
    if (firstChar === '1') return 'National ID';
    if (firstChar === '2') return 'Iqama';
    if (firstChar === '7') return 'Commercial Reg (CR)';
    if (/[A-Za-z]/.test(firstChar)) return 'Passport';
    
    return 'National ID'; // Default
  };

  // Handle ID number change with auto ID type detection
  const handleIdNoChange = (value: string) => {
    const detectedType = detectIdType(value);
    setFormData((prev: Partial<Customer>) => ({
      ...prev,
      idNo: value,
      idType: detectedType
    }));
  };

  // Handle English name change - auto-transliterate to Arabic
  const handleNameEnChange = (value: string) => {
    // Step 1: Dictionary of common Arabic names (English → Arabic)
    const nameDict: Record<string, string> = {
      // Male names
      'mohammed': 'محمد', 'muhammad': 'محمد', 'mohamad': 'محمد', 'mohammad': 'محمد', 'mohd': 'محمد',
      'ahmed': 'أحمد', 'ahmad': 'أحمد', 'ahmd': 'أحمد',
      'ali': 'علي',
      'khalid': 'خالد', 'khaled': 'خالد',
      'omar': 'عمر', 'umar': 'عمر',
      'abdullah': 'عبدالله', 'abdulla': 'عبدالله',
      'abdulrahman': 'عبدالرحمن', 'abdelrahman': 'عبدالرحمن',
      'abdulaziz': 'عبدالعزيز', 'abdelaziz': 'عبدالعزيز',
      'abdulhamid': 'عبدالحميد', 'abdelhamid': 'عبدالحميد',
      'abdulrahim': 'عبدالرحيم', 'abdelrahim': 'عبدالرحيم',
      'fahad': 'فهد', 'fahd': 'فهد',
      'faisal': 'فيصل', 'faysal': 'فيصل',
      'sultan': 'سلطان',
      'salman': 'سلمان',
      'nawaf': 'نواف',
      'turki': 'تركي',
      'bandar': 'بندر',
      'majed': 'ماجد', 'majid': 'ماجد',
      'saud': 'سعود',
      'nasser': 'ناصر', 'nasir': 'ناصر',
      'hamad': 'حمد', 'hamed': 'حامد', 'hamid': 'حامد',
      'rashid': 'راشد', 'rashed': 'راشد',
      'walid': 'وليد', 'waleed': 'وليد',
      'saad': 'سعد',
      'talal': 'طلال',
      'mansour': 'منصور', 'mansur': 'منصور',
      'ibrahim': 'إبراهيم',
      'ismail': 'إسماعيل',
      'hassan': 'حسن', 'hasan': 'حسن',
      'hussain': 'حسين', 'hussein': 'حسين', 'husain': 'حسين',
      'yasser': 'ياسر', 'yasir': 'ياسر',
      'nayef': 'نايف', 'naif': 'نايف',
      'ziad': 'زياد', 'zyad': 'زياد',
      'rakan': 'ركان',
      'marwan': 'مروان',
      'adel': 'عادل', 'adil': 'عادل',
      'osama': 'أسامة', 'usama': 'أسامة',
      'samer': 'سامر', 'samir': 'سامر',
      'tariq': 'طارق', 'tarek': 'طارق', 'tarik': 'طارق',
      'hani': 'هاني',
      'wael': 'وائل',
      'kareem': 'كريم', 'karim': 'كريم',
      'yousef': 'يوسف', 'yusuf': 'يوسف',
      'fawzi': 'فوزي',
      'shaker': 'شاكر',
      'sami': 'سامي',
      'badr': 'بدر',
      'mazen': 'مازن', 'mazin': 'مازن',
      'anas': 'أنس',
      'bilal': 'بلال',
      'emad': 'عماد', 'imad': 'عماد',
      'taha': 'طه',
      'zakariya': 'زكريا',
      'zuhair': 'زهير',
      'mubarak': 'مبارك',
      'riyad': 'رياض', 'riyadh': 'رياض',
      'nawwaf': 'نواف',
      'fawwaz': 'فواز', 'fawaz': 'فواز',
      'suhail': 'سهيل', 'suhayl': 'سهيل',
      'shadi': 'شادي',
      'murad': 'مراد',
      'wissam': 'وسام', 'wisam': 'وسام',
      'ayman': 'أيمن',
      'bassam': 'بسام',
      'nabil': 'نبيل',
      'raed': 'رائد', 'raid': 'رائد',
      'hazem': 'حازم', 'hazim': 'حازم',
      'haitham': 'هيثم', 'haytham': 'هيثم',
      'bassel': 'باسل', 'basil': 'باسل',
      'amr': 'عمرو',
      'khair': 'خير',
      'hatim': 'حاتم', 'hatem': 'حاتم',
      'maamoun': 'مأمون', 'mamoun': 'مأمون',
      'moussa': 'موسى', 'musa': 'موسى',
      'issa': 'عيسى', 'eisa': 'عيسى',
      'yahya': 'يحيى',
      'saleh': 'صالح', 'salih': 'صالح',
      'shakir': 'شاكر',
      'sabir': 'صابر', 'saber': 'صابر',
      'adnan': 'عدنان',
      'akram': 'أكرم',
      'ammar': 'عمار',
      'aqil': 'عاقل',
      'asad': 'أسد',
      'asim': 'عاصم',
      'aws': 'أوس',
      'awad': 'عوض',
      'dawud': 'داود', 'dawood': 'داود',
      'faris': 'فارس',
      'ghazi': 'غازي',
      'harun': 'هارون', 'haroun': 'هارون',
      'jabir': 'جابر', 'jaber': 'جابر',
      'jamil': 'جميل', 'jameel': 'جميل',
      'jihad': 'جهاد',
      'kamil': 'كامل', 'kameel': 'كامل',
      'luay': 'لؤي', 'louay': 'لؤي',
      'lutfi': 'لطفي',
      'mahir': 'ماهر', 'maher': 'ماهر',
      'mahmoud': 'محمود', 'mahmood': 'محمود',
      'maruf': 'معروف',
      'munir': 'منير', 'monir': 'منير',
      'mustafa': 'مصطفى', 'mostafa': 'مصطفى',
      'nadir': 'نادر',
      'nizam': 'نظام',
      'qasim': 'قاسم', 'kasim': 'قاسم',
      'rabi': 'ربيع',
      'rami': 'رامي',
      'rida': 'رضا', 'reda': 'رضا',
      'sabri': 'صبري',
      'safwan': 'صفوان',
      'saqr': 'صقر',
      'shafiq': 'شفيق',
      'tahir': 'طاهر',
      'talha': 'طلحة',
      'ubaid': 'عبيد',
      'wathiq': 'واثق',
      'yazan': 'يزن',
      'zaki': 'زكي',
      // Female names
      'fatima': 'فاطمة', 'fatimah': 'فاطمة', 'fatma': 'فاطمة',
      'aisha': 'عائشة', 'ayesha': 'عائشة', 'aysha': 'عائشة',
      'sara': 'سارة', 'sarah': 'سارة',
      'maryam': 'مريم', 'mariam': 'مريم', 'maryem': 'مريم',
      'khadija': 'خديجة', 'khadijah': 'خديجة',
      'nora': 'نورة', 'noura': 'نورة', 'nura': 'نورة',
      'reem': 'ريم', 'rima': 'ريما',
      'lama': 'لمى',
      'dina': 'دينا', 'deena': 'دينا',
      'hana': 'هناء', 'hanna': 'هناء', 'hanaa': 'هناء',
      'rania': 'رانيا', 'raniya': 'رانيا',
      'nawal': 'نوال',
      'salma': 'سلمى',
      'zainab': 'زينب', 'zaynab': 'زينب',
      'amira': 'أميرة', 'ameera': 'أميرة',
      'asma': 'أسماء', 'asmaa': 'أسماء',
      'eman': 'إيمان', 'iman': 'إيمان',
      'ghada': 'غادة',
      'hind': 'هند',
      'huda': 'هدى',
      'layla': 'ليلى', 'leila': 'ليلى', 'lila': 'ليلى',
      'manal': 'منال',
      'mona': 'منى', 'muna': 'منى',
      'rand': 'رند',
      'rasha': 'رشا',
      'rawan': 'روان',
      'wafa': 'وفاء',
      'yara': 'يارا',
      'shahd': 'شهد',
      'shaima': 'شيماء', 'shaimaa': 'شيماء',
      'abeer': 'عبير', 'abir': 'عبير',
      'afaf': 'عفاف',
      'alia': 'عالية', 'aliya': 'عالية',
      'aseel': 'أصيل', 'asil': 'أصيل',
      'aziza': 'عزيزة',
      'bayan': 'بيان',
      'bushra': 'بشرى',
      'dalal': 'دلال',
      'dalia': 'داليا', 'dalya': 'داليا',
      'dana': 'دانا',
      'dua': 'دعاء', 'duaa': 'دعاء',
      'fadwa': 'فدوى',
      'farah': 'فرح',
      'ghaida': 'غيداء',
      'hadeel': 'هديل', 'hadil': 'هديل',
      'haifa': 'هيفاء',
      'hala': 'هالة',
      'haneen': 'حنين', 'hanin': 'حنين',
      'inas': 'إيناس',
      'jihan': 'جيهان',
      'joudy': 'جودي', 'judi': 'جودي',
      'jumana': 'جمانة',
      'lana': 'لانا',
      'lina': 'لينا',
      'lubna': 'لبنى',
      'luna': 'لونا',
      'mais': 'ميس',
      'maha': 'مها',
      'maysa': 'ميساء',
      'maysoon': 'ميسون',
      'mira': 'ميرا',
      'najwa': 'نجوى',
      'nada': 'ندى',
      'nadia': 'نادية',
      'nahla': 'نهلة',
      'nailah': 'نائلة', 'naila': 'نائلة',
      'nisreen': 'نسرين', 'nisrin': 'نسرين',
      'nouf': 'نوف',
      'nujood': 'نجود',
      'raneem': 'رنيم', 'ranim': 'رنيم',
      'rola': 'رولا', 'rula': 'رولا',
      'ruba': 'ربى',
      'ruqayya': 'رقية', 'ruqayyah': 'رقية',
      'ruwayda': 'رويدة',
      'saba': 'صبا',
      'samar': 'سمر',
      'samia': 'سامية', 'samiya': 'سامية',
      'sana': 'سناء', 'sanaa': 'سناء',
      'shaden': 'شادن', 'shadan': 'شادن',
      'shireen': 'شيرين', 'shirin': 'شيرين',
      'suad': 'سعاد',
      'suha': 'سهى',
      'sukaina': 'سكينة',
      'tahani': 'تهاني',
      'taghreed': 'تغريد',
      'widad': 'وداد',
      'wijdan': 'وجدان',
      'wurud': 'ورود',
      'zahra': 'زهرة', 'zuhra': 'زهرة',
      // Prefixes / connectors
      'bin': 'بن', 'bint': 'بنت', 'ibn': 'ابن', 'al': 'آل',
      'abd': 'عبد', 'abdu': 'عبد',
    };

    // Step 2: Phonetic fallback with digraph support
    const phonetic = (word: string): string => {
      const digraphs: [string, string][] = [
        ['sh', 'ش'], ['kh', 'خ'], ['gh', 'غ'], ['th', 'ث'], ['dh', 'ذ'],
        ['ch', 'ش'], ['ph', 'ف'], ['ee', 'ي'], ['oo', 'و'],
        ['ou', 'و'], ['ai', 'اي'], ['ay', 'اي'], ['aw', 'او'],
        ['aa', 'آ'], ['ei', 'ي'], ['iy', 'ي'], ['uw', 'و'],
      ];
      const singles: Record<string, string> = {
        'a': 'ا', 'b': 'ب', 'c': 'ك', 'd': 'د', 'e': 'ي',
        'f': 'ف', 'g': 'ج', 'h': 'ح', 'i': 'ي', 'j': 'ج',
        'k': 'ك', 'l': 'ل', 'm': 'م', 'n': 'ن', 'o': 'و',
        'p': 'ب', 'q': 'ق', 'r': 'ر', 's': 'س', 't': 'ت',
        'u': 'و', 'v': 'ف', 'w': 'و', 'x': 'كس', 'y': 'ي', 'z': 'ز',
      };
      const w = word.toLowerCase();
      let result = '';
      let i = 0;
      while (i < w.length) {
        let matched = false;
        for (const [dg, ar] of digraphs) {
          if (w.slice(i, i + dg.length) === dg) {
            result += ar;
            i += dg.length;
            matched = true;
            break;
          }
        }
        if (!matched) {
          // Drop silent terminal 'e'
          if (w[i] === 'e' && i === w.length - 1) { i++; }
          else { result += singles[w[i]] ?? ''; i++; }
        }
      }
      return result;
    };

    // Step 3: Process word by word
    const arabicName = value.trim().split(/\s+/).map(word => {
      if (!word) return '';
      const lower = word.toLowerCase();
      if (nameDict[lower]) return nameDict[lower];
      // Handle al- / el- prefix (e.g. "Al-Rashidi")
      const hyphenBase = lower.replace(/^(al|el)-/, '');
      if (hyphenBase !== lower && nameDict[hyphenBase]) return 'ال' + nameDict[hyphenBase];
      return phonetic(word);
    }).join(' ');

    setFormData((prev: Partial<Customer>) => ({
      ...prev,
      nameEn: value,
      nameAr: arabicName
    }));
  };

  // Visual Style - White Inputs
  const inputStyle = "w-full bg-white text-slate-900 border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm font-bold text-sm transition-all";

  return (
    <div className="premium-card mobile-tab-shell tab-customers min-h-[600px] animate-fade-in overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-slate-50/30">
        <div className="space-y-1">
            <h2 className="text-base sm:text-xl font-black text-slate-800 flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm"><UserPlus className="text-white" size={18} /></div>
            {view === 'LIST' ? t('customer.database') : t('customer.newProfile')}
            </h2>
            {view === 'LIST' && (
              <div className="flex items-center gap-2 text-[12px] sm:text-sm">
                <span className="bg-emerald-500 text-white px-2.5 sm:px-3 py-1 rounded-lg font-bold">
                  {activeCustomers.length}
                </span>
                <span className="text-slate-600 font-medium">{t('customer.activeCount')}</span>
              </div>
            )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {view === 'LIST' && (
            <>
              {/* Import/Export Buttons */}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".json,.csv,.bkp"
                className="hidden"
              />
              <input 
                type="file" 
                ref={pdfInputRef}
                onChange={handlePdfImport}
                accept=".pdf"
                className="hidden"
              />
              <input 
                type="file" 
                ref={excelInputRef}
                onChange={handleExcelImport}
                accept=".xlsx,.xls"
                className="hidden"
              />
                <button 
                onClick={() => excelInputRef.current?.click()} 
                className="bg-emerald-500 text-white px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl hover:bg-emerald-600 shadow-sm font-bold flex items-center gap-2 text-sm"
                title="Import from Excel (Sheet1, columns D-G)"
              >
                <FileSpreadsheet size={16} className="sm:w-[18px] sm:h-[18px]" /> <span className="hidden sm:inline">{t('customer.importExcel')}</span><span className="sm:hidden">Excel</span>
              </button>
              <button 
                onClick={() => pdfInputRef.current?.click()} 
                className="bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl hover:bg-indigo-700 shadow-sm font-bold flex items-center gap-2 text-sm"
                title="Import from PDF (Sheet-like rows or labeled fields)"
              >
                <FileText size={16} className="sm:w-[18px] sm:h-[18px]" /> <span className="hidden sm:inline">{t('customer.importPdf')}</span><span className="sm:hidden">PDF</span>
              </button>
              <button 
                onClick={() => setShowDeleted(!showDeleted)}
                className={`${showDeleted ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-600'} border px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl hover:opacity-80 shadow-sm font-bold flex items-center gap-2 text-sm whitespace-nowrap`}
                title="View deleted customers"
              >
                <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" /> {showDeleted ? 'Active' : `Trash (${customers.filter(c => (c as any).deleted).length})`}
              </button>
              <button onClick={() => { resetForm(); setView('FORM'); }} className="bg-emerald-500 text-white px-4 sm:px-5 py-2 rounded-lg sm:rounded-xl hover:bg-emerald-600 shadow-lg font-bold flex items-center gap-2 text-sm"><UserPlus size={16} className="sm:w-[18px] sm:h-[18px]" /> <span className="hidden sm:inline">{t('customer.addCustomer')}</span><span className="sm:hidden">{t('common.add')}</span></button>
            </>
          )}
          {view === 'FORM' && (
            <button onClick={() => { resetForm(); setView('LIST'); }} className="text-slate-500 font-medium px-4 py-2 hover:bg-slate-100 rounded-lg w-full sm:w-auto text-sm">{t('customer.cancelBack')}</button>
          )}
        </div>
      </div>

      {/* Inline Confirm Modal - rendered via portal to escape backdrop-blur stacking context */}
      {confirmModal.open && ReactDOM.createPortal(
        <div className="fixed inset-0 flex items-start justify-center pt-[12vh] p-4" style={{backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99999}}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative" style={{zIndex: 100000}}>
            <h4 className="font-bold text-slate-800 mb-2">{confirmModal.title}</h4>
            <div className="text-slate-600 text-sm mb-6">{confirmModal.message}</div>
            <div className="flex justify-end gap-3">
              <button onClick={closeConfirm} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">{t('common.cancel')}</button>
              <button onClick={executeConfirm} className={`px-4 py-2 rounded-xl font-bold text-white ${confirmModal.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-500 hover:bg-emerald-600'}`}>{t('common.confirm')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="p-4 sm:p-6 md:p-8">
        {view === 'LIST' ? (
          <>
            {/* Import Status Message */}
            {importStatus && (
              <div className={`mb-4 p-3 sm:p-4 rounded-lg sm:rounded-xl flex items-center gap-2 sm:gap-3 text-[12px] sm:text-sm ${importStatus.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : importStatus.startsWith('✗') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                {importStatus.startsWith('✓') ? <CheckCircle size={18} /> : importStatus.startsWith('✗') ? <X size={18} /> : <FileSpreadsheet size={18} />}
                {importStatus}
              </div>
            )}
            
            <div className="mb-4 sm:mb-6 relative form-with-icon">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder={t('customer.database').toLowerCase().replace('database', 'customers...')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pm-input w-full pl-10 sm:pl-12" />
            </div>
            {showDeleted && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button onClick={handleRestoreAll} className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">{t('history.restoreAll')}</button>
                <button onClick={handleDeleteAllTrash} className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">{t('history.deleteAll')}</button>
              </div>
            )}

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3 mb-4 animate-stagger">
              {(filteredCustomers || []).length > 0 ? ([...(filteredCustomers || [])].sort((a, b) => {
                const aCode = parseInt(a.code) || 0;
                const bCode = parseInt(b.code) || 0;
                if ((aCode === 0 && bCode !== 0) || (aCode !== 0 && bCode === 0)) {
                  return bCode === 0 ? -1 : 1;
                }
                return bCode - aCode;
              }).map(c => (
                <div key={c.id} className="border border-slate-100 rounded-xl p-3 bg-white space-y-2 hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-[11px] font-mono text-slate-500">#{c.code}</div>
                      <div className="font-bold text-slate-800 text-sm leading-tight">{formatNameWithRoom(c.nameEn, c.roomNumber)}</div>
                      <div className="text-[11px] text-slate-500 font-arabic">{formatNameWithRoom(c.nameAr, c.roomNumber)}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${c.isBlacklisted ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {c.isBlacklisted ? 'Blacklisted' : t('common.active')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-[11px] text-slate-600">
                    {c.mobileNo && <div className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" />{c.mobileNo}</div>}
                    {c.email && <div className="flex items-center gap-1.5 text-emerald-600"><Mail size={12} className="text-emerald-400" />{c.email}</div>}
                    {c.emailNotifications && <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded"><Bell size={10}/>{t('customer.notifOn')}</span>}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <div className="flex items-center gap-1"><CreditCard size={12} className="text-slate-400" />{c.idNo || 'N/A'}</div>
                    <div className="flex items-center gap-1"><Car size={12} className="text-slate-400" /><span className="font-bold">{c.carPlates?.length || 0}</span> {t('customer.cars')}</div>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    {showDeleted ? (
                      <>
                        <button onClick={() => handleRestore(c.id, c.nameEn)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[11px] font-bold">{t('history.restore')}</button>
                        <button onClick={() => handlePermanentDelete(c.id, c.nameEn)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg text-[11px] font-bold">{t('common.delete')}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setFormData(normalizeCustomer(c as Customer)); setView('FORM'); }} className="p-1.5 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold">{t('common.view')}</button>
                        <button onClick={() => navigate('/contracts', { state: { filterCustomerId: c.id, filterCustomerName: c.nameEn } })} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[11px] font-bold flex items-center gap-1"><FileSignature size={11}/>{t('nav.contracts')}</button>
                        <button onClick={() => navigate('/history', { state: { filterCustomer: c.id } })} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold flex items-center gap-1"><CreditCard size={11}/>{t('nav.history')}</button>
                        <button onClick={() => handleDelete(c.id, c.nameEn)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg text-[11px] font-bold">{t('history.trash')}</button>
                      </>
                    )}
                  </div>
                </div>
              ))) : (
                <div className="px-3 py-6 text-center text-slate-400 text-sm">{t('customer.noCustomersFound')}</div>
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] sm:text-xs">
                    <th className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 font-bold text-slate-500 uppercase">{t('customer.code')}</th>
                    <th className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 font-bold text-slate-500 uppercase">{t('customer.nameRoom')}</th>
                    <th className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 font-bold text-slate-500 uppercase">{t('customer.contact')}</th>
                    <th className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 font-bold text-slate-500 uppercase">{t('common.status')}</th>
                    <th className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 font-bold text-slate-500 uppercase hidden sm:table-cell">{t('customer.idDetails')}</th>
                    <th className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 font-bold text-slate-500 uppercase hidden md:table-cell">{t('customer.vehicles')}</th>
                    <th className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 font-bold text-slate-500 uppercase text-right">{t('common.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] sm:text-sm">
                  {(filteredCustomers || []).length > 0 ? ([...(filteredCustomers || [])].sort((a, b) => {
                      const aCode = parseInt(a.code) || 0;
                      const bCode = parseInt(b.code) || 0;
                      
                      // If one has code 0 and other doesn't, put 0 at the end
                      if ((aCode === 0 && bCode !== 0) || (aCode !== 0 && bCode === 0)) {
                        return bCode === 0 ? -1 : 1;
                      }
                      
                      // Otherwise sort in descending order (higher code first)
                      return bCode - aCode;
                    }).map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-[11px] sm:text-sm font-mono text-slate-500 whitespace-nowrap">#{c.code}</td>
                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4">
                          <div className="font-bold text-slate-800 text-sm sm:text-base leading-tight">{formatNameWithRoom(c.nameEn, c.roomNumber)}</div>
                          <div className="text-[11px] sm:text-xs text-slate-500 font-arabic">{formatNameWithRoom(c.nameAr, c.roomNumber)}</div>
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4">
                          <div className="flex flex-col gap-1">
                            {c.mobileNo && <div className="flex items-center gap-1.5 text-[11px] sm:text-sm text-slate-600"><Phone size={12} className="text-slate-400" />{c.mobileNo}</div>}
                            {c.email && <div className="flex items-center gap-1.5 text-[11px] sm:text-sm text-emerald-600"><Mail size={12} className="text-emerald-400" />{c.email}</div>}
                            {c.emailNotifications && <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded"><Bell size={10}/>{t('customer.notifOn')}</span>}
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4">
                          <div className="flex flex-col gap-1">
                            {c.isBlacklisted ? <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-red-100 text-red-800">{t('customer.blacklisted')}</span> : <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800">{t('common.active')}</span>}
                            {(c as any).isVatRegistered && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200"><Receipt size={10}/>{t('history.vat')}</span>}
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-[11px] sm:text-sm text-slate-600 hidden sm:table-cell"><div className="flex items-center gap-2"><CreditCard size={14} className="text-slate-400" />{c.idNo}</div></td>
                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-[11px] sm:text-sm text-slate-600 hidden md:table-cell"><div className="flex items-center gap-1"><Car size={14} className="text-slate-400" /><span className="font-bold">{c.carPlates?.length || 0}</span> {t('customer.cars')}</div></td>
                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-right">
                          {showDeleted ? (
                            <div className="flex gap-1.5 sm:gap-2 justify-end">
                              <button onClick={() => handleRestore(c.id, c.nameEn)} className="p-1.5 sm:p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg" title={t('history.restore')}><RotateCcw size={14} className="sm:w-[16px] sm:h-[16px]" /></button>
                              <button onClick={() => handlePermanentDelete(c.id, c.nameEn)} className="p-1.5 sm:p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg" title={t('history.deletePermanently')}><X size={14} className="sm:w-[16px] sm:h-[16px]" /></button>
                            </div>
                          ) : (
                            <div className="flex gap-1.5 sm:gap-2 justify-end">
                              <button onClick={() => { setFormData(normalizeCustomer(c as Customer)); setView('FORM'); }} className="p-1.5 sm:p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg" title={t('common.edit')}><Edit2 size={14} className="sm:w-[16px] sm:h-[16px]" /></button>
                              <button onClick={() => navigate('/contracts', { state: { filterCustomerId: c.id, filterCustomerName: c.nameEn } })} className="p-1.5 sm:p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg" title="View Contracts"><FileSignature size={14} className="sm:w-[16px] sm:h-[16px]" /></button>
                              <button onClick={() => navigate('/history', { state: { filterCustomer: c.id } })} className="p-1.5 sm:p-2 hover:bg-purple-50 text-slate-400 hover:text-purple-600 rounded-lg" title="View Transaction History"><CreditCard size={14} className="sm:w-[16px] sm:h-[16px]" /></button>
                              <button onClick={() => handleDelete(c.id, c.nameEn)} className="p-1.5 sm:p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg" title={t('history.moveToTrash')}><Trash2 size={14} className="sm:w-[16px] sm:h-[16px]" /></button>
                            </div>
                          )}
                        </td>
                    </tr>
                    ))) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-6 text-center text-slate-400 text-sm">{t('customer.noCustomersFound')}</td>
                      </tr>
                    )}
                </tbody>
                </table>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 md:space-y-8 max-w-5xl mx-auto animate-slideUp">
             {!formData.id && (
               <div className="bg-blue-50 border border-blue-200 p-3 sm:p-4 rounded-lg sm:rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                 <div className="bg-blue-600 text-white rounded-lg px-3 sm:px-4 py-2 font-mono font-bold text-base sm:text-lg">
                   #{String(activeCustomers.reduce((max, c) => Math.max(max, parseInt(c.code) || 0), 0) + 1).padStart(2, '0')}
                 </div>
                 <div>
                   <div className="text-xs sm:text-sm font-bold text-blue-900">{t('customer.nextCode')}</div>
                   <div className="text-[10px] sm:text-xs text-blue-600">{t('customer.autoGenerated')}</div>
                 </div>
               </div>
             )}
             {formData.id && (
               <div className="bg-slate-50 border border-slate-200 p-3 sm:p-4 rounded-lg sm:rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                 <div className="bg-slate-600 text-white rounded-lg px-3 sm:px-4 py-2 font-mono font-bold text-base sm:text-lg">
                   #{formData.code}
                 </div>
                 <div>
                   <div className="text-xs sm:text-sm font-bold text-slate-900">{t('customer.customerCode')}</div>
                   <div className="text-[10px] sm:text-xs text-slate-600">{t('customer.editing')}</div>
                 </div>
               </div>
             )}

             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 md:gap-8 border-2 border-dashed border-blue-200/50 p-4 sm:p-6 rounded-lg sm:rounded-2xl md:rounded-3xl relative">
                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-2 border-b pb-2">{t('customer.basicInfo')}</h3>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">{t('customer.nameEn')}<span className="text-red-500">*</span></label><input type="text" required value={formData.nameEn} onChange={e => handleNameEnChange(e.target.value)} className={inputStyle} /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">{t('customer.nameAr')}<span className="text-slate-400 font-normal">({t('customer.optional')})</span></label><input type="text" value={formData.nameAr} onChange={e => handleInputChange('nameAr', e.target.value)} className={`${inputStyle} text-right font-arabic`} dir="rtl" placeholder="اختياري" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">{t('customer.nationality')}</label>
                            <div className="flex gap-2">
                                <select value={formData.nationality} onChange={e => handleInputChange('nationality', e.target.value)} className={inputStyle}>
                                    {nationalities.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <input 
                                    type="text" 
                                    placeholder="Add..." 
                                    value={newNationality} 
                                    onChange={e => setNewNationality(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const val = newNationality.trim();
                                            if (val && !nationalities.includes(val)) {
                                                setNationalities([...nationalities, val]);
                                                handleInputChange('nationality', val);
                                                setNewNationality('');
                                            }
                                        }
                                    }}
                                    className="w-32 px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                                />
                            </div>
                        </div>
                        <div><label className="block text-xs font-bold text-slate-600 mb-1">{t('customer.mobileNo')}</label><input type="text" value={formData.mobileNo} onChange={e => handleInputChange('mobileNo', e.target.value)} className={inputStyle} placeholder="+966..." /></div>
                    </div>
                    
                    {/* Email Field - NEW */}
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-3">
                      <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-2"><Mail size={14}/> {t('customer.emailSection')}</h4>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">{t('customer.emailAddress')}</label>
                        <input 
                          type="email" 
                          value={formData.email || ''} 
                          onChange={e => handleInputChange('email', e.target.value)} 
                          className={inputStyle} 
                          placeholder="customer@gmail.com"
                        />
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={formData.emailNotifications} 
                            onChange={e => handleInputChange('emailNotifications', e.target.checked)} 
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" 
                          />
                          <span className="text-sm text-slate-700 font-medium">{t('customer.emailNotifications')}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={formData.smsNotifications} 
                            onChange={e => handleInputChange('smsNotifications', e.target.checked)} 
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" 
                          />
                          <span className="text-sm text-slate-700 font-medium">{t('customer.smsNotifications')}</span>
                        </label>
                      </div>
                      <p className="text-[10px] text-emerald-600">{t('customer.notifInfo')}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-bold text-slate-600 mb-1">{t('customer.workAddress')}</label><input type="text" value={formData.workAddress} onChange={e => handleInputChange('workAddress', e.target.value)} className={inputStyle} /></div>
                      <div><label className="block text-xs font-bold text-slate-600 mb-1">{t('customer.roomNumber')}</label><input type="text" value={formData.roomNumber || ''} onChange={e => handleInputChange('roomNumber', e.target.value)} className={inputStyle} placeholder={t('history.unitExample')} /></div>
                    </div>

                    {/* VAT Registered Section */}
                    <div className="border border-emerald-200 rounded-xl overflow-hidden">
                      <label className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${formData.isVatRegistered ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={!!formData.isVatRegistered} onChange={e => handleInputChange('isVatRegistered', e.target.checked)} className="w-4 h-4 text-emerald-600 rounded" />
                        <div className="flex-1 flex items-center gap-2">
                          <Receipt size={16} className="text-emerald-600" />
                          <span className="text-sm font-bold text-slate-800">{t('customer.vatRegistered')}</span>
                        </div>
                        {formData.isVatRegistered && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-600 text-white tracking-wide">{t('history.vat')}</span>
                        )}
                      </label>
                      {formData.isVatRegistered && (
                        <div className="p-4 border-t border-emerald-200 bg-emerald-50/50 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-emerald-700 mb-1">{t('customer.vatNumber')}<span className="text-red-500">*</span></label>
                              <input
                                type="text"
                                value={formData.vatNumber || ''}
                                onChange={e => handleInputChange('vatNumber', e.target.value.replace(/\D/g, '').slice(0, 15))}
                                maxLength={15}
                                className={`${inputStyle} ${formData.vatNumber && !isValidSaudiVAT(formData.vatNumber) ? 'border-red-400 focus:ring-red-400' : formData.vatNumber && isValidSaudiVAT(formData.vatNumber) ? 'border-emerald-400 focus:ring-emerald-500' : ''}`}
                                placeholder="e.g. 300123456789003"
                              />
                              {formData.vatNumber && !isValidSaudiVAT(formData.vatNumber) && (
                                <p className="text-[10px] text-red-500 mt-1 font-semibold">
                                  {formData.vatNumber.length !== 15 ? `${formData.vatNumber.length}/15 digits` : 'Must start with 3'}
                                </p>
                              )}
                              {formData.vatNumber && isValidSaudiVAT(formData.vatNumber) && (
                                <p className="text-[10px] text-emerald-600 mt-1 font-semibold">✓ Valid</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-emerald-700 mb-1">CR Number <span className="text-red-500">*</span></label>
                              <input
                                type="text"
                                value={formData.crNumber || ''}
                                onChange={e => handleInputChange('crNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                maxLength={10}
                                className={`${inputStyle} ${formData.crNumber && !isValidSaudiCR(formData.crNumber) ? 'border-red-400 focus:ring-red-400' : formData.crNumber && isValidSaudiCR(formData.crNumber) ? 'border-emerald-400 focus:ring-emerald-500' : ''}`}
                                placeholder="e.g. 1010123456"
                              />
                              {formData.crNumber && !isValidSaudiCR(formData.crNumber) && (
                                <p className="text-[10px] text-red-500 mt-1 font-semibold">{formData.crNumber.length}/10 digits, must start with 1, 2, or 7</p>
                              )}
                              {formData.crNumber && isValidSaudiCR(formData.crNumber) && (
                                <p className="text-[10px] text-emerald-600 mt-1 font-semibold">✓ Valid</p>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1"><MapPin size={12} /> National Address</label>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Building No.</label>
                                <input type="text" value={(formData.nationalAddress as any)?.buildingNo || ''} onChange={e => setFormData((prev: Partial<Customer>) => ({ ...prev, nationalAddress: { ...(prev as any).nationalAddress, buildingNo: e.target.value } }))} className={inputStyle} placeholder="e.g. 1234" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Street Name</label>
                                <input type="text" value={(formData.nationalAddress as any)?.streetName || ''} onChange={e => setFormData((prev: Partial<Customer>) => ({ ...prev, nationalAddress: { ...(prev as any).nationalAddress, streetName: e.target.value } }))} className={inputStyle} placeholder="e.g. King Fahd Rd" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">District</label>
                                <input type="text" value={(formData.nationalAddress as any)?.district || ''} onChange={e => setFormData((prev: Partial<Customer>) => ({ ...prev, nationalAddress: { ...(prev as any).nationalAddress, district: e.target.value } }))} className={inputStyle} placeholder="e.g. Al Olaya" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">City</label>
                                <input type="text" value={(formData.nationalAddress as any)?.city || ''} onChange={e => setFormData((prev: Partial<Customer>) => ({ ...prev, nationalAddress: { ...(prev as any).nationalAddress, city: e.target.value } }))} className={inputStyle} placeholder="e.g. Riyadh" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Postal Code</label>
                                <input type="text" value={(formData.nationalAddress as any)?.postalCode || ''} onChange={e => setFormData((prev: Partial<Customer>) => ({ ...prev, nationalAddress: { ...(prev as any).nationalAddress, postalCode: e.target.value } }))} className={inputStyle} placeholder="e.g. 12211" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Additional No. (Optional)</label>
                                <input type="text" value={(formData.nationalAddress as any)?.additionalNo || ''} onChange={e => setFormData((prev: Partial<Customer>) => ({ ...prev, nationalAddress: { ...(prev as any).nationalAddress, additionalNo: e.target.value } }))} className={inputStyle} placeholder="e.g. 1234" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-2 border-b pb-2">{t('customer.officialId')}</h3>
                    <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-100 space-y-4">
                        <div><label className="block text-xs font-bold text-slate-600 mb-1">{t('customer.idNo')}</label><input type="text" value={formData.idNo} onChange={e => handleIdNoChange(e.target.value)} className={inputStyle} placeholder="National ID / Iqama / CR / Passport" /></div>
                         <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-slate-600 mb-1">{t('customer.idType')}</label><select value={formData.idType} onChange={e => handleInputChange('idType', e.target.value)} className={inputStyle}><option>National ID</option><option>Iqama</option><option>Passport</option><option>Commercial Reg (CR)</option></select></div>
                            <div><label className="block text-xs font-bold text-slate-600 mb-1">{t('customer.idSource')}</label><input type="text" value={formData.idSource} onChange={e => handleInputChange('idSource', e.target.value)} className={inputStyle} /></div>
                        </div>
                    </div>

                    <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-100 space-y-4">
                         <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-2"><Car size={16}/> {t('customer.vehicleRegistry')}</label>
                         <div className="flex gap-2">
                             <input type="text" placeholder="e.g. ABC-1234" value={tempPlate} onChange={e => setTempPlate(e.target.value)} className={`${inputStyle} uppercase`} />
                             <button type="button" onClick={addPlate} className="bg-emerald-500 text-white p-2 rounded-lg hover:bg-emerald-600"><Plus size={18}/></button>
                         </div>
                         <div className="flex flex-wrap gap-2">
                             {formData.carPlates?.map((p, idx) => (
                                 <span key={idx} className="bg-white border border-slate-300 px-3 py-1 rounded-md text-sm font-mono font-bold flex items-center gap-2 shadow-sm text-slate-800">
                                     {p} <button type="button" onClick={() => removePlate(p)} className="text-red-500 hover:text-red-700">×</button>
                                 </span>
                             ))}
                         </div>
                    </div>

                    <div className="pt-2">
                        <label className="flex items-center gap-3 p-4 border border-red-200 bg-red-50 rounded-lg cursor-pointer transition-colors hover:bg-red-100">
                            <input type="checkbox" checked={formData.isBlacklisted} onChange={e => handleInputChange('isBlacklisted', e.target.checked)} className="w-5 h-5 rounded text-red-600 focus:ring-red-500" />
                            <span className="text-red-700 font-bold">{t('customer.addToBlacklist')}</span>
                        </label>
                    </div>
                </div>
             </div>

             <div className="pt-4 sm:pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-4">
                 <button type="button" onClick={() => { resetForm(); setView('LIST'); }} className="pm-btn pm-btn-secondary">{t('common.cancel')}</button>
                 <button type="submit" className="pm-btn pm-btn-primary flex items-center justify-center gap-1.5 sm:gap-2"><Save size={14} />{t('common.save')}</button>
             </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CustomerManager;
