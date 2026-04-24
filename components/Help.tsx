import React, { useState } from 'react';
import {
  Book, MessageCircle, HelpCircle, Zap, FileSignature, PlusCircle, Users, Building,
  PieChart, ArrowRightLeft, Settings, Shield, LayoutDashboard, History, CalendarDays,
  ClipboardList, Car, Briefcase, Receipt, FolderOpen, Bell, Upload, Search,
  Globe, ChevronDown, ChevronRight, Monitor, Mic, UserCheck, Star, Info,
  CreditCard, Download, Cloud, Lock, Smartphone, Printer, BarChart3, Wallet,
  Package, Truck, Calculator, FileText, Target, CheckCircle2, KeyRound
} from 'lucide-react';

type Lang = 'en' | 'ml';

interface GuideSection {
  id: string;
  icon: any;
  title: { en: string; ml: string };
  subtitle: { en: string; ml: string };
  color: string;
  steps: { en: string; ml: string }[];
  tips?: { en: string; ml: string }[];
}

const allSections: GuideSection[] = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: { en: 'Dashboard', ml: 'ഡാഷ്‌ബോർഡ്' },
    subtitle: { en: 'Your command center — see everything at a glance', ml: 'നിങ്ങളുടെ കമാൻഡ് സെന്റർ — എല്ലാം ഒറ്റ നോട്ടത്തിൽ കാണുക' },
    color: 'emerald',
    steps: [
      { en: 'Open the app — Dashboard loads automatically as the home page.', ml: 'ആപ്പ് തുറക്കുക — ഡാഷ്‌ബോർഡ് ഹോം പേജായി സ്വയം ലോഡ് ചെയ്യും.' },
      { en: 'View total income, expenses, and net profit cards at the top.', ml: 'മൊത്തം വരുമാനം, ചെലവുകൾ, അറ്റ ലാഭ കാർഡുകൾ മുകളിൽ കാണുക.' },
      { en: 'See active contracts, pending payments, and occupancy rate.', ml: 'സജീവ കരാറുകൾ, തീർപ്പാക്കാത്ത പേയ്‌മെന്റുകൾ, ഒക്യുപൻസി നിരക്ക് കാണുക.' },
      { en: 'Charts show monthly trends, building-wise revenue, and expense breakdowns.', ml: 'ചാർട്ടുകൾ മാസിക ട്രെൻഡുകൾ, ബിൽഡിംഗ് തിരിച്ചുള്ള വരുമാനം, ചെലവ് വിശദാംശങ്ങൾ കാണിക്കുന്നു.' },
      { en: 'Click any card to navigate directly to that section.', ml: 'ഏതെങ്കിലും കാർഡിൽ ക്ലിക്ക് ചെയ്ത് ആ സെക്ഷനിലേക്ക് നേരിട്ട് പോകുക.' },
    ],
    tips: [
      { en: 'Dashboard auto-refreshes with real-time data from Firestore.', ml: 'ഫയർസ്റ്റോറിൽ നിന്ന് റിയൽ-ടൈം ഡാറ്റ ഉപയോഗിച്ച് ഡാഷ്‌ബോർഡ് സ്വയം റിഫ്രഷ് ചെയ്യുന്നു.' },
    ],
  },
  {
    id: 'entry',
    icon: PlusCircle,
    title: { en: 'Add Income / Expense', ml: 'വരുമാനം / ചെലവ് ചേർക്കുക' },
    subtitle: { en: 'Record every financial transaction accurately', ml: 'എല്ലാ സാമ്പത്തിക ഇടപാടുകളും കൃത്യമായി രേഖപ്പെടുത്തുക' },
    color: 'blue',
    steps: [
      { en: 'Click "Add Entry" from the sidebar or bottom navigation.', ml: 'സൈഡ്‌ബാറിൽ നിന്നോ ബോട്ടം നാവിഗേഷനിൽ നിന്നോ "Add Entry" ക്ലിക്ക് ചെയ്യുക.' },
      { en: 'Choose type: Income or Expense.', ml: 'തരം തിരഞ്ഞെടുക്കുക: വരുമാനം അല്ലെങ്കിൽ ചെലവ്.' },
      { en: 'Select the building and unit (flat) from dropdowns.', ml: 'ഡ്രോപ്‌ഡൗണിൽ നിന്ന് കെട്ടിടവും യൂണിറ്റും (ഫ്ലാറ്റ്) തിരഞ്ഞെടുക്കുക.' },
      { en: 'Pick the category — Rent, Water, Electricity, Maintenance, Salary, etc.', ml: 'വിഭാഗം തിരഞ്ഞെടുക്കുക — വാടക, വെള്ളം, വൈദ്യുതി, പരിപാലനം, ശമ്പളം, മുതലായവ.' },
      { en: 'Enter the amount, date, and payment method (Cash, Bank Transfer, Cheque).', ml: 'തുക, തീയതി, പേയ്‌മെന്റ് രീതി (ക്യാഷ്, ബാങ്ക് ട്രാൻസ്ഫർ, ചെക്ക്) നൽകുക.' },
      { en: 'Add optional notes or attach a receipt photo.', ml: 'ഓപ്ഷണൽ കുറിപ്പുകൾ ചേർക്കുക അല്ലെങ്കിൽ രസീത് ഫോട്ടോ അറ്റാച്ച് ചെയ്യുക.' },
      { en: 'Click "Save" — a ZATCA-compliant QR code is auto-generated for VAT invoices.', ml: '"Save" ക്ലിക്ക് ചെയ്യുക — VAT ഇൻവോയ്‌സുകൾക്ക് ZATCA അനുസൃത QR കോഡ് സ്വയം ജനറേറ്റ് ആകും.' },
    ],
    tips: [
      { en: 'Non-admin users\' entries go to Approval Center before being finalized.', ml: 'അഡ്മിൻ അല്ലാത്ത ഉപയോക്താക്കളുടെ എൻട്രികൾ അന്തിമമാക്കുന്നതിന് മുമ്പ് അംഗീകാര കേന്ദ്രത്തിലേക്ക് പോകുന്നു.' },
      { en: 'Income entries linked to contracts auto-update payment tracking.', ml: 'കരാറുകളുമായി ബന്ധിപ്പിച്ച വരുമാന എൻട്രികൾ പേയ്‌മെന്റ് ട്രാക്കിംഗ് സ്വയം അപ്‌ഡേറ്റ് ചെയ്യുന്നു.' },
    ],
  },
  {
    id: 'history',
    icon: History,
    title: { en: 'Transaction History', ml: 'ഇടപാട് ചരിത്രം' },
    subtitle: { en: 'Search, filter, and manage all past transactions', ml: 'എല്ലാ മുൻ ഇടപാടുകളും തിരയുക, ഫിൽട്ടർ ചെയ്യുക, മാനേജ് ചെയ്യുക' },
    color: 'violet',
    steps: [
      { en: 'Go to "Transactions" from the sidebar.', ml: 'സൈഡ്‌ബാറിൽ നിന്ന് "Transactions" ലേക്ക് പോകുക.' },
      { en: 'Use the search bar to find transactions by customer, building, or amount.', ml: 'ഉപഭോക്താവ്, കെട്ടിടം, അല്ലെങ്കിൽ തുക അനുസരിച്ച് ഇടപാടുകൾ കണ്ടെത്താൻ സെർച്ച് ബാർ ഉപയോഗിക്കുക.' },
      { en: 'Filter by date range, type (income/expense), building, or category.', ml: 'തീയതി ശ്രേണി, തരം (വരുമാനം/ചെലവ്), കെട്ടിടം, വിഭാഗം എന്നിവ അനുസരിച്ച് ഫിൽട്ടർ ചെയ്യുക.' },
      { en: 'Click any transaction to view full details, edit, or delete it.', ml: 'മുഴുവൻ വിശദാംശങ്ങൾ കാണാൻ, എഡിറ്റ് ചെയ്യാൻ, അല്ലെങ്കിൽ ഡിലീറ്റ് ചെയ്യാൻ ഏതെങ്കിലും ഇടപാടിൽ ക്ലിക്ക് ചെയ്യുക.' },
      { en: 'Use "Save Filter" to bookmark frequently used filter combinations.', ml: 'ഇടയ്ക്കിടെ ഉപയോഗിക്കുന്ന ഫിൽട്ടർ കോമ്പിനേഷനുകൾ ബുക്ക്‌മാർക്ക് ചെയ്യാൻ "Save Filter" ഉപയോഗിക്കുക.' },
      { en: 'Print or export transactions as PDF reports.', ml: 'ഇടപാടുകൾ PDF റിപ്പോർട്ടുകളായി പ്രിന്റ് ചെയ്യുക അല്ലെങ്കിൽ എക്സ്പോർട്ട് ചെയ്യുക.' },
    ],
  },
  {
    id: 'contracts',
    icon: FileSignature,
    title: { en: 'Contracts & Leases', ml: 'കരാറുകളും ലീസുകളും' },
    subtitle: { en: 'Create, manage, and track rental agreements', ml: 'വാടക കരാറുകൾ സൃഷ്ടിക്കുക, മാനേജ് ചെയ്യുക, ട്രാക്ക് ചെയ്യുക' },
    color: 'amber',
    steps: [
      { en: 'Navigate to "Contracts" from the sidebar.', ml: 'സൈഡ്‌ബാറിൽ നിന്ന് "Contracts" ലേക്ക് നാവിഗേറ്റ് ചെയ്യുക.' },
      { en: 'Click "New Contract" to create a lease agreement.', ml: 'ഒരു ലീസ് കരാർ സൃഷ്ടിക്കാൻ "New Contract" ക്ലിക്ക് ചെയ്യുക.' },
      { en: 'Select customer (tenant), building, and unit.', ml: 'ഉപഭോക്താവ് (വാടകക്കാരൻ), കെട്ടിടം, യൂണിറ്റ് എന്നിവ തിരഞ്ഞെടുക്കുക.' },
      { en: 'Set rent amount, contract duration (start & end dates).', ml: 'വാടക തുക, കരാർ കാലാവധി (ആരംഭ & അവസാന തീയതികൾ) സജ്ജീകരിക്കുക.' },
      { en: 'Add extra charges: water, internet, insurance, service fees.', ml: 'അധിക ചാർജുകൾ ചേർക്കുക: വെള്ളം, ഇന്റർനെറ്റ്, ഇൻഷുറൻസ്, സർവീസ് ഫീസ്.' },
      { en: 'The system auto-calculates installment schedule (monthly/quarterly/yearly).', ml: 'സിസ്റ്റം ഇൻസ്റ്റാൾമെന്റ് ഷെഡ്യൂൾ (മാസികം/ത്രൈമാസികം/വാർഷികം) സ്വയം കണക്കാക്കുന്നു.' },
      { en: 'Track payment status — paid, pending, overdue — for each installment.', ml: 'ഓരോ ഇൻസ്റ്റാൾമെന്റിനും പേയ്‌മെന്റ് സ്റ്റാറ്റസ് ട്രാക്ക് ചെയ്യുക — പേയ്ഡ്, പെൻഡിംഗ്, ഓവർഡ്യൂ.' },
      { en: 'Renew or finalize contracts with one click.', ml: 'ഒറ്റ ക്ലിക്കിൽ കരാറുകൾ പുതുക്കുക അല്ലെങ്കിൽ അന്തിമമാക്കുക.' },
    ],
    tips: [
      { en: 'Finalizing a contract requires admin approval for non-admin users.', ml: 'അഡ്മിൻ അല്ലാത്ത ഉപയോക്താക്കൾക്ക് ഒരു കരാർ അന്തിമമാക്കുന്നതിന് അഡ്മിൻ അനുമതി ആവശ്യമാണ്.' },
      { en: 'Auto-rent feature can generate monthly rent entries automatically.', ml: 'ഓട്ടോ-റെന്റ് ഫീച്ചർ മാസിക വാടക എൻട്രികൾ സ്വയം ജനറേറ്റ് ചെയ്യാൻ കഴിയും.' },
    ],
  },
  {
    id: 'customers',
    icon: Users,
    title: { en: 'Customer Management', ml: 'ഉപഭോക്തൃ മാനേജ്മെന്റ്' },
    subtitle: { en: 'Manage tenant profiles, IDs, and contact info', ml: 'വാടകക്കാരുടെ പ്രൊഫൈലുകൾ, ഐഡികൾ, ബന്ധപ്പെടാനുള്ള വിവരങ്ങൾ മാനേജ് ചെയ്യുക' },
    color: 'cyan',
    steps: [
      { en: 'Go to "Customers" under the Database menu.', ml: 'ഡാറ്റാബേസ് മെനുവിൽ "Customers" ലേക്ക് പോകുക.' },
      { en: 'Click "Add Customer" to register a new tenant.', ml: 'പുതിയ വാടകക്കാരനെ രജിസ്റ്റർ ചെയ്യാൻ "Add Customer" ക്ലിക്ക് ചെയ്യുക.' },
      { en: 'Enter Arabic and English names, nationality, Iqama/ID number.', ml: 'അറബിക്, ഇംഗ്ലീഷ് പേരുകൾ, ദേശീയത, ഇഖാമ/ഐഡി നമ്പർ നൽകുക.' },
      { en: 'Add phone number, email, and emergency contact.', ml: 'ഫോൺ നമ്പർ, ഇമെയിൽ, എമർജൻസി കോൺടാക്ട് ചേർക്കുക.' },
      { en: 'Assign to a building and unit, or leave unassigned.', ml: 'ഒരു കെട്ടിടത്തിലേക്കും യൂണിറ്റിലേക്കും അസൈൻ ചെയ്യുക, അല്ലെങ്കിൽ അസൈൻ ചെയ്യാതെ വിടുക.' },
      { en: 'Use the blacklist feature to flag problematic tenants.', ml: 'പ്രശ്‌നക്കാരായ വാടകക്കാരെ ഫ്ലാഗ് ചെയ്യാൻ ബ്ലാക്ക്‌ലിസ്റ്റ് ഫീച്ചർ ഉപയോഗിക്കുക.' },
      { en: 'Search customers by name, ID, phone, or building.', ml: 'പേര്, ഐഡി, ഫോൺ, അല്ലെങ്കിൽ കെട്ടിടം അനുസരിച്ച് ഉപഭോക്താക്കളെ തിരയുക.' },
    ],
    tips: [
      { en: 'Bulk Import: Admin can import multiple customers from PDF/Excel files.', ml: 'ബൾക്ക് ഇമ്പോർട്ട്: PDF/Excel ഫയലുകളിൽ നിന്ന് ഒന്നിലധികം ഉപഭോക്താക്കളെ ഇമ്പോർട്ട് ചെയ്യാൻ അഡ്മിന് കഴിയും.' },
    ],
  },
  {
    id: 'properties',
    icon: Building,
    title: { en: 'Properties & Buildings', ml: 'പ്രോപ്പർട്ടികളും കെട്ടിടങ്ങളും' },
    subtitle: { en: 'Setup buildings, units, rents, and bank accounts', ml: 'കെട്ടിടങ്ങൾ, യൂണിറ്റുകൾ, വാടകകൾ, ബാങ്ക് അക്കൗണ്ടുകൾ സജ്ജീകരിക്കുക' },
    color: 'orange',
    steps: [
      { en: 'Navigate to "Properties" under Database.', ml: 'ഡാറ്റാബേസിന് കീഴിലുള്ള "Properties" ലേക്ക് നാവിഗേറ്റ് ചെയ്യുക.' },
      { en: 'Click "Add Building" to register a new property.', ml: 'ഒരു പുതിയ പ്രോപ്പർട്ടി രജിസ്റ്റർ ചെയ്യാൻ "Add Building" ക്ലിക്ക് ചെയ്യുക.' },
      { en: 'Enter building name, address, and owner details.', ml: 'കെട്ടിടത്തിന്റെ പേര്, വിലാസം, ഉടമയുടെ വിവരങ്ങൾ നൽകുക.' },
      { en: 'Add units (apartments/shops) with default rent amounts.', ml: 'ഡിഫോൾട്ട് വാടക തുകകളോടെ യൂണിറ്റുകൾ (അപ്പാർട്ട്‌മെന്റുകൾ/കടകൾ) ചേർക്കുക.' },
      { en: 'Assign a bank account for each building for fund tracking.', ml: 'ഫണ്ട് ട്രാക്കിംഗിനായി ഓരോ കെട്ടിടത്തിനും ഒരു ബാങ്ക് അക്കൗണ്ട് അസൈൻ ചെയ്യുക.' },
      { en: 'Track building lease details if property is rented from a landlord.', ml: 'പ്രോപ്പർട്ടി ഒരു ഉടമസ്ഥനിൽ നിന്ന് വാടകയ്ക്ക് എടുത്തതാണെങ്കിൽ ബിൽഡിംഗ് ലീസ് വിശദാംശങ്ങൾ ട്രാക്ക് ചെയ്യുക.' },
    ],
  },
  {
    id: 'directory',
    icon: FolderOpen,
    title: { en: 'Building Directory', ml: 'ബിൽഡിംഗ് ഡയറക്ടറി' },
    subtitle: { en: 'Visual overview of all units and tenants', ml: 'എല്ലാ യൂണിറ്റുകളുടെയും വാടകക്കാരുടെയും വിഷ്വൽ അവലോകനം' },
    color: 'teal',
    steps: [
      { en: 'Open "Directory" under Database.', ml: 'ഡാറ്റാബേസിന് കീഴിൽ "Directory" തുറക്കുക.' },
      { en: 'See all buildings with color-coded occupancy status.', ml: 'കളർ-കോഡഡ് ഒക്യുപൻസി സ്റ്റാറ്റസോടെ എല്ലാ കെട്ടിടങ്ങളും കാണുക.' },
      { en: 'Green = Occupied, Red = Vacant, Yellow = Partially occupied.', ml: 'പച്ച = താമസമുള്ളത്, ചുവപ്പ് = ഒഴിഞ്ഞത്, മഞ്ഞ = ഭാഗികമായി താമസമുള്ളത്.' },
      { en: 'Click a unit to see tenant details, contract info, and payment history.', ml: 'വാടകക്കാരന്റെ വിശദാംശങ്ങൾ, കരാർ വിവരങ്ങൾ, പേയ്‌മെന്റ് ചരിത്രം കാണാൻ ഒരു യൂണിറ്റിൽ ക്ലിക്ക് ചെയ്യുക.' },
    ],
  },
  {
    id: 'car-registry',
    icon: Car,
    title: { en: 'Car Registry', ml: 'കാർ രജിസ്ട്രി' },
    subtitle: { en: 'Track tenant vehicles and parking assignments', ml: 'വാടകക്കാരുടെ വാഹനങ്ങളും പാർക്കിംഗ് അസൈൻമെന്റുകളും ട്രാക്ക് ചെയ്യുക' },
    color: 'slate',
    steps: [
      { en: 'Go to "Car Registry" under Database.', ml: 'ഡാറ്റാബേസിന് കീഴിൽ "Car Registry" ലേക്ക് പോകുക.' },
      { en: 'Add vehicle details: plate number, make, model, color.', ml: 'വാഹന വിശദാംശങ്ങൾ ചേർക്കുക: പ്ലേറ്റ് നമ്പർ, മേക്ക്, മോഡൽ, നിറം.' },
      { en: 'Link vehicles to specific tenants and buildings.', ml: 'നിർദ്ദിഷ്ട വാടകക്കാരുമായും കെട്ടിടങ്ങളുമായും വാഹനങ്ങൾ ലിങ്ക് ചെയ്യുക.' },
      { en: 'Search by plate number to quickly identify vehicle owners.', ml: 'വാഹന ഉടമകളെ വേഗത്തിൽ തിരിച്ചറിയാൻ പ്ലേറ്റ് നമ്പർ അനുസരിച്ച് തിരയുക.' },
    ],
  },
  {
    id: 'vendors',
    icon: Truck,
    title: { en: 'Vendor Management', ml: 'വെണ്ടർ മാനേജ്‌മെന്റ്' },
    subtitle: { en: 'Manage suppliers and service providers', ml: 'സപ്ലയർമാരെയും സർവീസ് പ്രൊവൈഡർമാരെയും മാനേജ് ചെയ്യുക' },
    color: 'indigo',
    steps: [
      { en: 'Navigate to "Vendors" under Database.', ml: 'ഡാറ്റാബേസിന് കീഴിൽ "Vendors" ലേക്ക് നാവിഗേറ്റ് ചെയ്യുക.' },
      { en: 'Add vendor with name, contact, trade license, and bank details.', ml: 'പേര്, കോൺടാക്ട്, ട്രേഡ് ലൈസൻസ്, ബാങ്ക് വിശദാംശങ്ങൾ എന്നിവയോടെ വെണ്ടർ ചേർക്കുക.' },
      { en: 'Categorize vendors: Plumber, Electrician, Cleaning, etc.', ml: 'വെണ്ടർമാരെ വർഗ്ഗീകരിക്കുക: പ്ലംബർ, ഇലക്ട്രീഷ്യൻ, ക്ലീനിംഗ് മുതലായവ.' },
      { en: 'Track payment history and outstanding dues per vendor.', ml: 'ഓരോ വെണ്ടറിനും പേയ്‌മെന്റ് ചരിത്രവും കുടിശ്ശികയും ട്രാക്ക് ചെയ്യുക.' },
    ],
  },
  {
    id: 'calendar',
    icon: CalendarDays,
    title: { en: 'Calendar View', ml: 'കലണ്ടർ വ്യൂ' },
    subtitle: { en: 'See rent dues, contract expirations, and events visually', ml: 'വാടക ഡ്യൂകൾ, കരാർ കാലാവധി, ഇവന്റുകൾ എന്നിവ ദൃശ്യപരമായി കാണുക' },
    color: 'rose',
    steps: [
      { en: 'Open "Calendar" from the Menu group.', ml: 'മെനു ഗ്രൂപ്പിൽ നിന്ന് "Calendar" തുറക്കുക.' },
      { en: 'View monthly calendar with highlighted dates for dues and expirations.', ml: 'ഡ്യൂകൾക്കും കാലാവധിക്കും ഹൈലൈറ്റ് ചെയ്ത തീയതികളോടെ മാസിക കലണ്ടർ കാണുക.' },
      { en: 'Click any date to see all events: payment reminders, contract renewals.', ml: 'എല്ലാ ഇവന്റുകളും കാണാൻ ഏതെങ്കിലും തീയതിയിൽ ക്ലിക്ക് ചെയ്യുക: പേയ്‌മെന്റ് റിമൈൻഡറുകൾ, കരാർ പുതുക്കലുകൾ.' },
      { en: 'Color-coded markers indicate income, expense, and contract events.', ml: 'കളർ-കോഡഡ് മാർക്കറുകൾ വരുമാനം, ചെലവ്, കരാർ ഇവന്റുകൾ സൂചിപ്പിക്കുന്നു.' },
    ],
  },
  {
    id: 'tasks',
    icon: ClipboardList,
    title: { en: 'Task Manager', ml: 'ടാസ്‌ക് മാനേജർ' },
    subtitle: { en: 'Create, assign, and track maintenance & office tasks', ml: 'പരിപാലന & ഓഫീസ് ടാസ്കുകൾ സൃഷ്ടിക്കുക, അസൈൻ ചെയ്യുക, ട്രാക്ക് ചെയ്യുക' },
    color: 'purple',
    steps: [
      { en: 'Go to "Tasks" from the Menu group.', ml: 'മെനു ഗ്രൂപ്പിൽ നിന്ന് "Tasks" ലേക്ക് പോകുക.' },
      { en: 'Click "Add Task" — enter title, description, priority (Low/Medium/High/Urgent).', ml: '"Add Task" ക്ലിക്ക് ചെയ്യുക — ടൈറ്റിൽ, വിവരണം, മുൻ‌ഗണന (Low/Medium/High/Urgent) നൽകുക.' },
      { en: 'Assign to an employee and set a due date.', ml: 'ഒരു ജീവനക്കാരന് അസൈൻ ചെയ്ത് ഡ്യൂ ഡേറ്റ് സജ്ജീകരിക്കുക.' },
      { en: 'Track task status: To Do → In Progress → Completed.', ml: 'ടാസ്‌ക് സ്റ്റാറ്റസ് ട്രാക്ക് ചെയ്യുക: To Do → In Progress → Completed.' },
      { en: 'Link tasks to specific buildings or units for context.', ml: 'സന്ദർഭത്തിനായി നിർദ്ദിഷ്ട കെട്ടിടങ്ങളിലേക്കോ യൂണിറ്റുകളിലേക്കോ ടാസ്‌കുകൾ ലിങ്ക് ചെയ്യുക.' },
    ],
  },
  {
    id: 'monitoring',
    icon: BarChart3,
    title: { en: 'Monitoring & Analytics', ml: 'മോണിറ്ററിംഗ് & അനലിറ്റിക്സ്' },
    subtitle: { en: 'Real-time operational insights and performance metrics', ml: 'റിയൽ-ടൈം ഓപ്പറേഷണൽ ഇൻസൈറ്റുകളും പ്രകടന മെട്രിക്സും' },
    color: 'fuchsia',
    steps: [
      { en: 'Open "Monitoring" under Analytics.', ml: 'അനലിറ്റിക്സിന് കീഴിൽ "Monitoring" തുറക്കുക.' },
      { en: 'View P&L reports showing profit and loss per building and overall.', ml: 'ഓരോ കെട്ടിടത്തിനും മൊത്തത്തിലും ലാഭനഷ്ടം കാണിക്കുന്ന P&L റിപ്പോർട്ടുകൾ കാണുക.' },
      { en: 'Analyze expense breakdowns by category with interactive charts.', ml: 'ഇന്ററാക്ടീവ് ചാർട്ടുകൾ ഉപയോഗിച്ച് വിഭാഗം അനുസരിച്ച് ചെലവ് വിശദാംശങ്ങൾ വിശകലനം ചെയ്യുക.' },
      { en: 'Track occupancy rates, collection efficiency, and outstanding payments.', ml: 'ഒക്യുപൻസി നിരക്കുകൾ, കളക്ഷൻ കാര്യക്ഷമത, കുടിശ്ശിക പേയ്‌മെന്റുകൾ ട്രാക്ക് ചെയ്യുക.' },
      { en: 'Generate Zakat calculations automatically.', ml: 'സക്കാത്ത് കണക്കുകൂട്ടലുകൾ സ്വയം ജനറേറ്റ് ചെയ്യുക.' },
      { en: 'Print or export any report as a branded PDF.', ml: 'ഏതെങ്കിലും റിപ്പോർട്ട് ബ്രാൻഡഡ് PDF ആയി പ്രിന്റ് ചെയ്യുക അല്ലെങ്കിൽ എക്സ്പോർട്ട് ചെയ്യുക.' },
    ],
  },
  {
    id: 'vat',
    icon: Receipt,
    title: { en: 'VAT Report', ml: 'VAT റിപ്പോർട്ട്' },
    subtitle: { en: 'ZATCA-compliant VAT reporting and filing', ml: 'ZATCA അനുസൃത VAT റിപ്പോർട്ടിംഗും ഫയലിംഗും' },
    color: 'red',
    steps: [
      { en: 'Go to "VAT Report" under Analytics.', ml: 'അനലിറ്റിക്സിന് കീഴിൽ "VAT Report" ലേക്ക് പോകുക.' },
      { en: 'Select the reporting period (quarterly/annual).', ml: 'റിപ്പോർട്ടിംഗ് കാലയളവ് (ത്രൈമാസികം/വാർഷികം) തിരഞ്ഞെടുക്കുക.' },
      { en: 'View input VAT, output VAT, and net VAT payable.', ml: 'ഇൻപുട്ട് VAT, ഔട്ട്‌പുട്ട് VAT, നെറ്റ് VAT പേയബിൾ കാണുക.' },
      { en: 'All invoices include ZATCA-compliant QR codes automatically.', ml: 'എല്ലാ ഇൻവോയ്‌സുകളിലും ZATCA അനുസൃത QR കോഡുകൾ സ്വയം ഉൾപ്പെടുന്നു.' },
      { en: 'Export VAT summary for submission to ZATCA portal.', ml: 'ZATCA പോർട്ടലിലേക്ക് സമർപ്പിക്കാൻ VAT സംഗ്രഹം എക്സ്പോർട്ട് ചെയ്യുക.' },
    ],
  },
  {
    id: 'transfers',
    icon: ArrowRightLeft,
    title: { en: 'Treasury & Transfers', ml: 'ട്രഷറി & ട്രാൻസ്ഫറുകൾ' },
    subtitle: { en: 'Transfer funds between building accounts', ml: 'കെട്ടിട അക്കൗണ്ടുകൾക്കിടയിൽ ഫണ്ടുകൾ ട്രാൻസ്ഫർ ചെയ്യുക' },
    color: 'sky',
    steps: [
      { en: 'Open "Treasury" under Operations.', ml: 'ഓപ്പറേഷൻസിന് കീഴിൽ "Treasury" തുറക്കുക.' },
      { en: 'Select source account (building) and destination account.', ml: 'സോഴ്‌സ് അക്കൗണ്ട് (കെട്ടിടം) ഉം ഡെസ്റ്റിനേഷൻ അക്കൗണ്ടും തിരഞ്ഞെടുക്കുക.' },
      { en: 'Enter transfer amount and reason.', ml: 'ട്രാൻസ്ഫർ തുകയും കാരണവും നൽകുക.' },
      { en: 'View complete transfer history with timestamps.', ml: 'ടൈംസ്റ്റാമ്പുകളോടെ മുഴുവൻ ട്രാൻസ്ഫർ ചരിത്രം കാണുക.' },
    ],
  },
  {
    id: 'borrowings',
    icon: Wallet,
    title: { en: 'Borrowing Tracker', ml: 'ബോറോയിംഗ് ട്രാക്കർ' },
    subtitle: { en: 'Track employee loans and salary deductions', ml: 'ജീവനക്കാരുടെ ലോണുകളും ശമ്പള കിഴിവുകളും ട്രാക്ക് ചെയ്യുക' },
    color: 'lime',
    steps: [
      { en: 'Navigate to "Borrowings" under Operations.', ml: 'ഓപ്പറേഷൻസിന് കീഴിലുള്ള "Borrowings" ലേക്ക് നാവിഗേറ്റ് ചെയ്യുക.' },
      { en: 'Record a new loan given to an employee.', ml: 'ഒരു ജീവനക്കാരന് നൽകിയ പുതിയ ലോൺ രേഖപ്പെടുത്തുക.' },
      { en: 'Set repayment schedule and monthly deduction amounts.', ml: 'തിരിച്ചടവ് ഷെഡ്യൂളും മാസിക കിഴിവ് തുകകളും സജ്ജീകരിക്കുക.' },
      { en: 'Track remaining balance and payment history per employee.', ml: 'ഓരോ ജീവനക്കാരന്റെയും ബാക്കി തുകയും പേയ്‌മെന്റ് ചരിത്രവും ട്രാക്ക് ചെയ്യുക.' },
      { en: 'Auto-deduct from salary entries when configured.', ml: 'കോൺഫിഗർ ചെയ്യുമ്പോൾ ശമ്പള എൻട്രികളിൽ നിന്ന് സ്വയം കിഴിവ് ചെയ്യുക.' },
    ],
  },
  {
    id: 'staff',
    icon: UserCheck,
    title: { en: 'Staff & Employees', ml: 'സ്റ്റാഫ് & ജീവനക്കാർ' },
    subtitle: { en: 'Manage team members, roles, and portfolios', ml: 'ടീം അംഗങ്ങൾ, റോളുകൾ, പോർട്ട്‌ഫോളിയോകൾ മാനേജ് ചെയ്യുക' },
    color: 'emerald',
    steps: [
      { en: 'Admin: Go to "Staff" under Settings to add/manage employees.', ml: 'അഡ്മിൻ: ജീവനക്കാരെ ചേർക്കാൻ/മാനേജ് ചെയ്യാൻ സെറ്റിംഗ്സിന് കീഴിലുള്ള "Staff" ലേക്ക് പോകുക.' },
      { en: 'Set roles: Admin, Manager, Staff, Engineer.', ml: 'റോളുകൾ സജ്ജീകരിക്കുക: അഡ്മിൻ, മാനേജർ, സ്റ്റാഫ്, എഞ്ചിനീയർ.' },
      { en: 'View "Staff Portfolio" under Operations for building assignments.', ml: 'ബിൽഡിംഗ് അസൈൻമെന്റുകൾക്കായി ഓപ്പറേഷൻസിന് കീഴിലുള്ള "Staff Portfolio" കാണുക.' },
      { en: 'Engineers get limited access — only Stock Management by default.', ml: 'എഞ്ചിനീയർമാർക്ക് പരിമിതമായ ആക്‌സസ് ലഭിക്കുന്നു — ഡിഫോൾട്ടായി സ്റ്റോക്ക് മാനേജ്‌മെന്റ് മാത്രം.' },
      { en: 'Track employee performance and assigned buildings.', ml: 'ജീവനക്കാരുടെ പ്രകടനവും അസൈൻ ചെയ്ത കെട്ടിടങ്ങളും ട്രാക്ക് ചെയ്യുക.' },
    ],
  },
  {
    id: 'stocks',
    icon: Package,
    title: { en: 'Stock Management', ml: 'സ്റ്റോക്ക് മാനേജ്‌മെന്റ്' },
    subtitle: { en: 'Track inventory, supplies, and maintenance materials', ml: 'ഇൻവെന്ററി, സപ്ലൈസ്, മെയിന്റനൻസ് മെറ്റീരിയലുകൾ ട്രാക്ക് ചെയ്യുക' },
    color: 'yellow',
    steps: [
      { en: 'Open "Stock Management" under Operations.', ml: 'ഓപ്പറേഷൻസിന് കീഴിൽ "Stock Management" തുറക്കുക.' },
      { en: 'Add stock items: name, category, quantity, unit price.', ml: 'സ്റ്റോക്ക് ഐറ്റങ്ങൾ ചേർക്കുക: പേര്, വിഭാഗം, അളവ്, യൂണിറ്റ് വില.' },
      { en: 'Record stock in (purchase) and stock out (usage) transactions.', ml: 'സ്റ്റോക്ക് ഇൻ (വാങ്ങൽ), സ്റ്റോക്ക് ഔട്ട് (ഉപയോഗം) ഇടപാടുകൾ രേഖപ്പെടുത്തുക.' },
      { en: 'Set minimum stock levels for auto-alerts when running low.', ml: 'കുറവാകുമ്പോൾ ഓട്ടോ-അലേർട്ടുകൾക്കായി മിനിമം സ്റ്റോക്ക് ലെവലുകൾ സജ്ജീകരിക്കുക.' },
      { en: 'Engineers and admins have full stock access.', ml: 'എഞ്ചിനീയർമാർക്കും അഡ്മിൻമാർക്കും പൂർണ്ണ സ്റ്റോക്ക് ആക്‌സസ് ഉണ്ട്.' },
    ],
  },
  {
    id: 'approvals',
    icon: Shield,
    title: { en: 'Approval Center', ml: 'അംഗീകാര കേന്ദ്രം' },
    subtitle: { en: 'Review and approve pending changes (Admin/Manager only)', ml: 'തീർപ്പാക്കാത്ത മാറ്റങ്ങൾ അവലോകനം ചെയ്ത് അംഗീകരിക്കുക (അഡ്മിൻ/മാനേജർ മാത്രം)' },
    color: 'red',
    steps: [
      { en: 'Navigate to "Approvals" (visible for Admin & Manager roles only).', ml: '"Approvals" ലേക്ക് നാവിഗേറ്റ് ചെയ്യുക (അഡ്മിൻ & മാനേജർ റോളുകൾക്ക് മാത്രം ദൃശ്യം).' },
      { en: 'See all pending requests: new entries, edits, deletions, contract finalizations.', ml: 'എല്ലാ തീർപ്പാക്കാത്ത അഭ്യർത്ഥനകളും കാണുക: പുതിയ എൻട്രികൾ, എഡിറ്റുകൾ, ഡിലീഷനുകൾ, കരാർ ഫൈനലൈസേഷനുകൾ.' },
      { en: 'Review the details and click Approve or Reject.', ml: 'വിശദാംശങ്ങൾ അവലോകനം ചെയ്ത് Approve അല്ലെങ്കിൽ Reject ക്ലിക്ക് ചെയ്യുക.' },
      { en: 'Badge count on the sidebar shows pending approval count.', ml: 'സൈഡ്‌ബാറിലെ ബാഡ്ജ് കൗണ്ട് തീർപ്പാക്കാത്ത അംഗീകാര എണ്ണം കാണിക്കുന്നു.' },
    ],
    tips: [
      { en: 'Push notifications alert admins when new approvals arrive.', ml: 'പുതിയ അംഗീകാരങ്ങൾ വരുമ്പോൾ പുഷ് നോട്ടിഫിക്കേഷനുകൾ അഡ്മിൻമാരെ അലേർട്ട് ചെയ്യുന്നു.' },
    ],
  },
  {
    id: 'notifications',
    icon: Bell,
    title: { en: 'Notifications', ml: 'അറിയിപ്പുകൾ' },
    subtitle: { en: 'Stay updated with real-time alerts and reminders', ml: 'റിയൽ-ടൈം അലേർട്ടുകളും റിമൈൻഡറുകളും ഉപയോഗിച്ച് അപ്‌ഡേറ്റ് ആയിരിക്കുക' },
    color: 'orange',
    steps: [
      { en: 'Click the bell icon in the top header bar.', ml: 'ടോപ്പ് ഹെഡർ ബാറിലെ ബെൽ ഐക്കൺ ക്ലിക്ക് ചെയ്യുക.' },
      { en: 'View all notifications: payment reminders, contract expirations, approvals.', ml: 'എല്ലാ അറിയിപ്പുകളും കാണുക: പേയ്‌മെന്റ് റിമൈൻഡറുകൾ, കരാർ കാലാവധി, അംഗീകാരങ്ങൾ.' },
      { en: 'Mark individual notifications as read, or mark all as read.', ml: 'വ്യക്തിഗത അറിയിപ്പുകൾ വായിച്ചതായി അടയാളപ്പെടുത്തുക, അല്ലെങ്കിൽ എല്ലാം വായിച്ചതായി അടയാളപ്പെടുത്തുക.' },
      { en: 'Dismiss notifications or clear them all at once.', ml: 'അറിയിപ്പുകൾ ഡിസ്‌മിസ് ചെയ്യുക അല്ലെങ്കിൽ ഒറ്റയടിക്ക് എല്ലാം ക്ലിയർ ചെയ്യുക.' },
      { en: 'Enable push notifications in browser for real-time alerts even when app is minimized.', ml: 'ആപ്പ് മിനിമൈസ് ചെയ്‌താലും റിയൽ-ടൈം അലേർട്ടുകൾക്കായി ബ്രൗസറിൽ പുഷ് നോട്ടിഫിക്കേഷനുകൾ എനേബിൾ ചെയ്യുക.' },
    ],
  },
  {
    id: 'quick-actions',
    icon: Zap,
    title: { en: 'Quick Actions (Ctrl+K)', ml: 'ക്വിക്ക് ആക്ഷൻസ് (Ctrl+K)' },
    subtitle: { en: 'Command palette — navigate anywhere instantly', ml: 'കമാൻഡ് പാലറ്റ് — എവിടെയും തൽക്ഷണം നാവിഗേറ്റ് ചെയ്യുക' },
    color: 'violet',
    steps: [
      { en: 'Press Ctrl+K (or Cmd+K on Mac) anywhere in the app.', ml: 'ആപ്പിൽ എവിടെയും Ctrl+K (Mac-ൽ Cmd+K) അമർത്തുക.' },
      { en: 'Or click the lightning bolt icon in the header.', ml: 'അല്ലെങ്കിൽ ഹെഡറിലെ ലൈറ്റ്‌നിംഗ് ബോൾട്ട് ഐക്കൺ ക്ലിക്ക് ചെയ്യുക.' },
      { en: 'Type to search: page names, features, or actions.', ml: 'തിരയാൻ ടൈപ്പ് ചെയ്യുക: പേജ് നാമങ്ങൾ, ഫീച്ചറുകൾ, അല്ലെങ്കിൽ ആക്ഷനുകൾ.' },
      { en: 'Select a result to navigate instantly to that page.', ml: 'ആ പേജിലേക്ക് തൽക്ഷണം നാവിഗേറ്റ് ചെയ്യാൻ ഒരു ഫലം തിരഞ്ഞെടുക്കുക.' },
    ],
    tips: [
      { en: 'Works like Spotlight (Mac) or Windows Search — fastest way to navigate.', ml: 'Spotlight (Mac) അല്ലെങ്കിൽ Windows Search പോലെ പ്രവർത്തിക്കുന്നു — നാവിഗേറ്റ് ചെയ്യാനുള്ള ഏറ്റവും വേഗതയേറിയ മാർഗം.' },
    ],
  },
  {
    id: 'voice',
    icon: Mic,
    title: { en: 'Voice Assistant', ml: 'വോയ്‌സ് അസിസ്റ്റന്റ്' },
    subtitle: { en: 'Control the app with voice commands', ml: 'വോയ്‌സ് കമാൻഡുകൾ ഉപയോഗിച്ച് ആപ്പ് നിയന്ത്രിക്കുക' },
    color: 'pink',
    steps: [
      { en: 'Look for the microphone icon floating at the bottom of the screen.', ml: 'സ്‌ക്രീനിന്റെ അടിയിൽ ഫ്ലോട്ടിംഗ് മൈക്രോഫോൺ ഐക്കൺ നോക്കുക.' },
      { en: 'Click and speak naturally: "Show dashboard", "Add expense", etc.', ml: 'ക്ലിക്ക് ചെയ്ത് സ്വാഭാവികമായി സംസാരിക്കുക: "Show dashboard", "Add expense", മുതലായവ.' },
      { en: 'The assistant understands navigation commands and basic actions.', ml: 'അസിസ്റ്റന്റ് നാവിഗേഷൻ കമാൻഡുകളും അടിസ്ഥാന ആക്ഷനുകളും മനസ്സിലാക്കുന്നു.' },
      { en: 'Grant microphone permission when prompted by your browser.', ml: 'ബ്രൗസർ ആവശ്യപ്പെടുമ്പോൾ മൈക്രോഫോൺ അനുമതി നൽകുക.' },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: { en: 'Settings & Preferences', ml: 'സെറ്റിംഗ്സ് & മുൻഗണനകൾ' },
    subtitle: { en: 'Customize your experience — dark mode, language, branding', ml: 'നിങ്ങളുടെ അനുഭവം ഇഷ്ടാനുസൃതമാക്കുക — ഡാർക്ക് മോഡ്, ഭാഷ, ബ്രാൻഡിംഗ്' },
    color: 'gray',
    steps: [
      { en: 'Navigate to "Settings" from the sidebar.', ml: 'സൈഡ്‌ബാറിൽ നിന്ന് "Settings" ലേക്ക് നാവിഗേറ്റ് ചെയ്യുക.' },
      { en: 'Profile Settings: Change your name, email, profile photo.', ml: 'പ്രൊഫൈൽ സെറ്റിംഗ്സ്: നിങ്ങളുടെ പേര്, ഇമെയിൽ, പ്രൊഫൈൽ ഫോട്ടോ മാറ്റുക.' },
      { en: 'Appearance: Toggle Dark Mode, Compact Mode for denser layouts.', ml: 'ദൃശ്യരൂപം: ഡാർക്ക് മോഡ്, കൂടുതൽ ഇടതിങ്ങിയ ലേഔട്ടുകൾക്കായി കോമ്പാക്ട് മോഡ് ടോഗിൾ ചെയ്യുക.' },
      { en: 'System Settings (Admin): Company name, currency (SAR/USD/INR), budget limits.', ml: 'സിസ്റ്റം സെറ്റിംഗ്സ് (അഡ്മിൻ): കമ്പനിയുടെ പേര്, കറൻസി (SAR/USD/INR), ബജറ്റ് പരിധികൾ.' },
      { en: 'Change app language using the language toggle in the header.', ml: 'ഹെഡറിലെ ഭാഷ ടോഗിൾ ഉപയോഗിച്ച് ആപ്പ് ഭാഷ മാറ്റുക.' },
      { en: 'Enable/disable sound effects for navigation and actions.', ml: 'നാവിഗേഷനും ആക്ഷനുകൾക്കും സൗണ്ട് ഇഫക്ടുകൾ എനേബിൾ/ഡിസേബിൾ ചെയ്യുക.' },
    ],
  },
  {
    id: 'backup',
    icon: Cloud,
    title: { en: 'Backup & Restore', ml: 'ബാക്കപ്പ് & റീസ്റ്റോർ' },
    subtitle: { en: 'Protect your data with local and cloud backups', ml: 'ലോക്കൽ, ക്ലൗഡ് ബാക്കപ്പുകൾ ഉപയോഗിച്ച് നിങ്ങളുടെ ഡാറ്റ സംരക്ഷിക്കുക' },
    color: 'blue',
    steps: [
      { en: 'Admin: Go to Settings → "Local Backup" or "Cloud Backup".', ml: 'അഡ്മിൻ: സെറ്റിംഗ്സ് → "Local Backup" അല്ലെങ്കിൽ "Cloud Backup" ലേക്ക് പോകുക.' },
      { en: 'Local Backup: Export all data as a JSON file to your computer.', ml: 'ലോക്കൽ ബാക്കപ്പ്: എല്ലാ ഡാറ്റയും JSON ഫയലായി നിങ്ങളുടെ കമ്പ്യൂട്ടറിലേക്ക് എക്സ്പോർട്ട് ചെയ്യുക.' },
      { en: 'Cloud Backup: Connect Google Drive and backup to the cloud.', ml: 'ക്ലൗഡ് ബാക്കപ്പ്: Google Drive കണക്ട് ചെയ്ത് ക്ലൗഡിലേക്ക് ബാക്കപ്പ് ചെയ്യുക.' },
      { en: 'Restore: Upload a backup file or restore from Google Drive.', ml: 'റീസ്റ്റോർ: ഒരു ബാക്കപ്പ് ഫയൽ അപ്‌ലോഡ് ചെയ്യുക അല്ലെങ്കിൽ Google Drive-ൽ നിന്ന് റീസ്റ്റോർ ചെയ്യുക.' },
      { en: 'Schedule automatic backups for daily or weekly intervals.', ml: 'ദൈനംദിന അല്ലെങ്കിൽ ആഴ്ചതോറും ഇടവേളകളിൽ ഓട്ടോമാറ്റിക് ബാക്കപ്പുകൾ ഷെഡ്യൂൾ ചെയ്യുക.' },
    ],
    tips: [
      { en: 'Always backup before making major data changes or updates.', ml: 'വലിയ ഡാറ്റ മാറ്റങ്ങളോ അപ്‌ഡേറ്റുകളോ ചെയ്യുന്നതിന് മുമ്പ് എല്ലായ്‌പ്പോഴും ബാക്കപ്പ് ചെയ്യുക.' },
    ],
  },
  {
    id: 'bulk-import',
    icon: Upload,
    title: { en: 'Bulk Import', ml: 'ബൾക്ക് ഇമ്പോർട്ട്' },
    subtitle: { en: 'Import customers from PDF or Excel files', ml: 'PDF അല്ലെങ്കിൽ Excel ഫയലുകളിൽ നിന്ന് ഉപഭോക്താക്കളെ ഇമ്പോർട്ട് ചെയ്യുക' },
    color: 'teal',
    steps: [
      { en: 'Admin Only: Go to Settings → "Bulk Import".', ml: 'അഡ്മിൻ മാത്രം: സെറ്റിംഗ്സ് → "Bulk Import" ലേക്ക് പോകുക.' },
      { en: 'Upload a PDF or Excel file with customer data.', ml: 'ഉപഭോക്തൃ ഡാറ്റയുള്ള PDF അല്ലെങ്കിൽ Excel ഫയൽ അപ്‌ലോഡ് ചെയ്യുക.' },
      { en: 'Preview extracted data and map columns to fields.', ml: 'എക്‌സ്‌ട്രാക്ട് ചെയ്ത ഡാറ്റ പ്രിവ്യൂ ചെയ്ത് കോളങ്ങൾ ഫീൽഡുകളിലേക്ക് മാപ്പ് ചെയ്യുക.' },
      { en: 'Click "Import" to add all valid records at once.', ml: 'എല്ലാ സാധുവായ റെക്കോർഡുകളും ഒരേ സമയം ചേർക്കാൻ "Import" ക്ലിക്ക് ചെയ്യുക.' },
    ],
  },
  {
    id: 'invoices',
    icon: FileText,
    title: { en: 'Invoices & Printing', ml: 'ഇൻവോയ്‌സുകൾ & പ്രിന്റിംഗ്' },
    subtitle: { en: 'Generate professional invoices with QR codes', ml: 'QR കോഡുകളോടെ പ്രൊഫഷണൽ ഇൻവോയ്‌സുകൾ ജനറേറ്റ് ചെയ്യുക' },
    color: 'emerald',
    steps: [
      { en: 'From any income transaction, click "View Invoice".', ml: 'ഏതെങ്കിലും വരുമാന ഇടപാടിൽ നിന്ന് "View Invoice" ക്ലിക്ക് ചെയ്യുക.' },
      { en: 'Invoice shows: company letterhead, tenant details, amount, VAT breakdown.', ml: 'ഇൻവോയ്‌സ് കാണിക്കുന്നു: കമ്പനി ലെറ്റർഹെഡ്, വാടകക്കാരന്റെ വിശദാംശങ്ങൾ, തുക, VAT വിശദാംശങ്ങൾ.' },
      { en: 'ZATCA-compliant QR code is embedded automatically.', ml: 'ZATCA അനുസൃത QR കോഡ് സ്വയം ഉൾപ്പെടുത്തിയിരിക്കുന്നു.' },
      { en: 'Click "Print" to get a PDF version or send via email.', ml: 'PDF പതിപ്പ് ലഭിക്കാനോ ഇമെയിൽ വഴി അയയ്ക്കാനോ "Print" ക്ലിക്ക് ചെയ്യുക.' },
    ],
  },
  {
    id: 'tenant-portal',
    icon: KeyRound,
    title: { en: 'Tenant Portal', ml: 'ടെനന്റ് പോർട്ടൽ' },
    subtitle: { en: 'Self-service portal for tenants to view their info', ml: 'വാടകക്കാർക്ക് അവരുടെ വിവരങ്ങൾ കാണാനുള്ള സെൽഫ്-സർവീസ് പോർട്ടൽ' },
    color: 'sky',
    steps: [
      { en: 'Tenants access through a separate login URL (#/tenant).', ml: 'വാടകക്കാർ ഒരു പ്രത്യേക ലോഗിൻ URL (#/tenant) വഴി ആക്‌സസ് ചെയ്യുന്നു.' },
      { en: 'Login with phone number or credentials provided by admin.', ml: 'അഡ്മിൻ നൽകിയ ഫോൺ നമ്പർ അല്ലെങ്കിൽ ക്രെഡൻഷ്യലുകൾ ഉപയോഗിച്ച് ലോഗിൻ ചെയ്യുക.' },
      { en: 'View contract details, payment history, and outstanding dues.', ml: 'കരാർ വിശദാംശങ്ങൾ, പേയ്‌മെന്റ് ചരിത്രം, കുടിശ്ശിക ഡ്യൂ‌കൾ കാണുക.' },
      { en: 'Download receipts and invoices directly.', ml: 'രസീതുകളും ഇൻവോയ്‌സുകളും നേരിട്ട് ഡൗൺലോഡ് ചെയ്യുക.' },
    ],
  },
  {
    id: 'language',
    icon: Globe,
    title: { en: 'Language & RTL Support', ml: 'ഭാഷ & RTL പിന്തുണ' },
    subtitle: { en: 'Switch between English, Arabic, and more', ml: 'ഇംഗ്ലീഷ്, അറബിക് എന്നിവയ്ക്കിടയിൽ മാറുക' },
    color: 'indigo',
    steps: [
      { en: 'Click the globe icon in the top header bar.', ml: 'ടോപ്പ് ഹെഡർ ബാറിലെ ഗ്ലോബ് ഐക്കൺ ക്ലിക്ക് ചെയ്യുക.' },
      { en: 'Select your preferred language from the dropdown.', ml: 'ഡ്രോപ്‌ഡൗണിൽ നിന്ന് നിങ്ങൾ ഇഷ്ടപ്പെടുന്ന ഭാഷ തിരഞ്ഞെടുക്കുക.' },
      { en: 'Arabic enables RTL (Right-to-Left) layout automatically.', ml: 'അറബിക് RTL (വലത്-ഇടത്) ലേഔട്ട് സ്വയം എനേബിൾ ചെയ്യുന്നു.' },
      { en: 'All labels, menus, and forms switch to the selected language.', ml: 'എല്ലാ ലേബലുകൾ, മെനുകൾ, ഫോമുകൾ തിരഞ്ഞെടുത്ത ഭാഷയിലേക്ക് മാറുന്നു.' },
    ],
  },
  {
    id: 'mobile',
    icon: Smartphone,
    title: { en: 'Mobile & PWA', ml: 'മൊബൈൽ & PWA' },
    subtitle: { en: 'Use Amlak on your phone like a native app', ml: 'നേറ്റീവ് ആപ്പ് പോലെ നിങ്ങളുടെ ഫോണിൽ Amlak ഉപയോഗിക്കുക' },
    color: 'purple',
    steps: [
      { en: 'Open the app URL in your phone\'s browser (Chrome/Safari).', ml: 'നിങ്ങളുടെ ഫോണിന്റെ ബ്രൗസറിൽ (Chrome/Safari) ആപ്പ് URL തുറക്കുക.' },
      { en: 'Tap "Add to Home Screen" from the browser menu.', ml: 'ബ്രൗസർ മെനുവിൽ നിന്ന് "Add to Home Screen" ടാപ്പ് ചെയ്യുക.' },
      { en: 'The app installs as a PWA — works offline and feels like a native app.', ml: 'ആപ്പ് PWA ആയി ഇൻസ്റ്റാൾ ചെയ്യുന്നു — ഓഫ്‌ലൈനായി പ്രവർത്തിക്കുന്നു, നേറ്റീവ് ആപ്പ് പോലെ അനുഭവപ്പെടുന്നു.' },
      { en: 'Bottom navigation bar provides quick access to main features on mobile.', ml: 'മൊബൈലിൽ പ്രധാന ഫീച്ചറുകളിലേക്ക് ദ്രുത ആക്‌സസ് ബോട്ടം നാവിഗേഷൻ ബാർ നൽകുന്നു.' },
      { en: 'Tap the menu icon for full navigation on mobile.', ml: 'മൊബൈലിൽ പൂർണ്ണ നാവിഗേഷനായി മെനു ഐക്കൺ ടാപ്പ് ചെയ്യുക.' },
    ],
  },
  {
    id: 'security',
    icon: Lock,
    title: { en: 'Security & Login', ml: 'സുരക്ഷ & ലോഗിൻ' },
    subtitle: { en: 'Authentication, roles, and data protection', ml: 'ഓതന്റിക്കേഷൻ, റോളുകൾ, ഡാറ്റ സംരക്ഷണം' },
    color: 'red',
    steps: [
      { en: 'Login with your email and password (Firebase Authentication).', ml: 'നിങ്ങളുടെ ഇമെയിലും പാസ്‌വേഡും ഉപയോഗിച്ച് ലോഗിൻ ചെയ്യുക (Firebase ഓതന്റിക്കേഷൻ).' },
      { en: 'Four user roles: Admin, Manager, Staff, Engineer.', ml: 'നാല് ഉപയോക്തൃ റോളുകൾ: അഡ്മിൻ, മാനേജർ, സ്റ്റാഫ്, എഞ്ചിനീയർ.' },
      { en: 'Admin has full access to all features and settings.', ml: 'അഡ്മിന് എല്ലാ ഫീച്ചറുകളിലേക്കും സെറ്റിംഗ്സിലേക്കും പൂർണ്ണ ആക്‌സസ് ഉണ്ട്.' },
      { en: 'Staff/Manager need approval for edits and deletions.', ml: 'എഡിറ്റുകൾക്കും ഡിലീഷനുകൾക്കും സ്റ്റാഫ്/മാനേജർക്ക് അംഗീകാരം ആവശ്യമാണ്.' },
      { en: 'Engineer role is restricted to Stock Management only.', ml: 'എഞ്ചിനീയർ റോൾ സ്റ്റോക്ക് മാനേജ്‌മെന്റിൽ മാത്രം പരിമിതപ്പെടുത്തിയിരിക്കുന്നു.' },
      { en: 'All data is stored in Firebase Firestore with security rules.', ml: 'എല്ലാ ഡാറ്റയും സുരക്ഷാ നിയമങ്ങളോടെ Firebase Firestore-ൽ സംഭരിച്ചിരിക്കുന്നു.' },
    ],
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; light: string; badge: string }> = {
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', light: 'bg-emerald-50', badge: 'bg-emerald-600' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', light: 'bg-blue-50', badge: 'bg-blue-600' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', light: 'bg-violet-50', badge: 'bg-violet-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', light: 'bg-amber-50', badge: 'bg-amber-600' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', light: 'bg-cyan-50', badge: 'bg-cyan-600' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', light: 'bg-orange-50', badge: 'bg-orange-600' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', light: 'bg-teal-50', badge: 'bg-teal-600' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', light: 'bg-slate-50', badge: 'bg-slate-600' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', light: 'bg-indigo-50', badge: 'bg-indigo-600' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', light: 'bg-rose-50', badge: 'bg-rose-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', light: 'bg-purple-50', badge: 'bg-purple-600' },
  fuchsia: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200', light: 'bg-fuchsia-50', badge: 'bg-fuchsia-600' },
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', light: 'bg-red-50', badge: 'bg-red-600' },
  sky: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200', light: 'bg-sky-50', badge: 'bg-sky-600' },
  lime: { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-200', light: 'bg-lime-50', badge: 'bg-lime-600' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', light: 'bg-pink-50', badge: 'bg-pink-600' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', light: 'bg-gray-50', badge: 'bg-gray-600' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', light: 'bg-yellow-50', badge: 'bg-yellow-600' },
};

const Help: React.FC = () => {
  const [lang, setLang] = useState<Lang>('en');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setOpenSections(new Set(allSections.map(s => s.id)));
  const collapseAll = () => setOpenSections(new Set());

  const filtered = allSections.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title[lang].toLowerCase().includes(q) ||
      s.subtitle[lang].toLowerCase().includes(q) ||
      s.steps.some(step => step[lang].toLowerCase().includes(q))
    );
  });

  const t = (en: string, ml: string) => lang === 'en' ? en : ml;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in pb-24">
      {/* HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-8 md:p-10 mb-8 shadow-2xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-8 w-32 h-32 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-4 left-8 w-40 h-40 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                <Book size={36} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                  {t('Amlak User Guide', 'Amlak ഉപയോക്തൃ ഗൈഡ്')}
                </h1>
                <p className="text-emerald-100 text-sm md:text-base font-medium mt-1">
                  {t('Complete guide to every feature — step by step', 'എല്ലാ ഫീച്ചറിന്റെയും സമ്പൂർണ്ണ ഗൈഡ് — ഘട്ടം ഘട്ടമായി')}
                </p>
              </div>
            </div>

            {/* Language Toggle */}
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-2xl p-1.5 self-start md:self-center">
              <button
                onClick={() => setLang('en')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  lang === 'en'
                    ? 'bg-white text-emerald-700 shadow-lg scale-105'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >English</button>
              <button
                onClick={() => setLang('ml')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  lang === 'ml'
                    ? 'bg-white text-emerald-700 shadow-lg scale-105'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                മലയാളം
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
              <Target size={16} className="text-emerald-200" />
              <span className="text-white text-sm font-semibold">{allSections.length} {t('Features', 'ഫീച്ചറുകൾ')}</span>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-200" />
              <span className="text-white text-sm font-semibold">{t('Step-by-step instructions', 'ഘട്ടം ഘട്ടമായുള്ള നിർദ്ദേശങ്ങൾ')}</span>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
              <Globe size={16} className="text-emerald-200" />
              <span className="text-white text-sm font-semibold">{t('Bilingual: EN + ML', 'ദ്വിഭാഷ: EN + ML')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH + CONTROLS */}
      <div className="ios-card p-4 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('Search features...', 'ഫീച്ചറുകൾ തിരയുക...')}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-200"
          >
            {t('Expand All', 'എല്ലാം വിടർത്തുക')}
          </button>
          <button
            onClick={collapseAll}
            className="px-4 py-2.5 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors border border-slate-200"
          >
            {t('Collapse All', 'എല്ലാം ചുരുക്കുക')}
          </button>
        </div>
      </div>

      {/* TABLE OF CONTENTS */}
      <div className="ios-card p-6 mb-8">
        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
          <FolderOpen size={20} className="text-emerald-600" />
          {t('Table of Contents', 'ഉള്ളടക്ക പട്ടിക')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {allSections.map((section, idx) => {
            const colors = colorMap[section.color] || colorMap.emerald;
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => {
                  setOpenSections(prev => new Set(prev).add(section.id));
                  document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 hover:scale-[1.02] ${colors.light} border ${colors.border} hover:shadow-md group`}
              >
                <span className={`flex-shrink-0 w-6 h-6 ${colors.badge} text-white rounded-lg flex items-center justify-center text-[10px] font-black`}>
                  {idx + 1}
                </span>
                <Icon size={14} className={`${colors.text} flex-shrink-0`} />
                <span className={`text-xs font-bold ${colors.text} truncate`}>{section.title[lang]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FEATURE SECTIONS */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="ios-card p-12 text-center">
            <Search size={40} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">{t('No features match your search.', 'നിങ്ങളുടെ തിരയലിന് ഒരു ഫീച്ചറും പൊരുത്തപ്പെടുന്നില്ല.')}</p>
          </div>
        )}

        {filtered.map((section) => {
          const isOpen = openSections.has(section.id);
          const colors = colorMap[section.color] || colorMap.emerald;
          const Icon = section.icon;
          const sectionNumber = allSections.indexOf(section) + 1;

          return (
            <div
              key={section.id}
              id={`section-${section.id}`}
              className={`ios-card overflow-hidden transition-all duration-300 ${isOpen ? 'shadow-lg ring-1 ' + colors.border : 'hover:shadow-md'}`}
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50/50 transition-colors group"
              >
                <div className={`relative flex-shrink-0 p-3 ${colors.bg} rounded-2xl transition-transform duration-300 ${isOpen ? 'scale-110' : 'group-hover:scale-105'}`}>
                  <Icon size={22} className={colors.text} />
                  <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 ${colors.badge} text-white rounded-full flex items-center justify-center text-[9px] font-black`}>
                    {sectionNumber}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-slate-800">{section.title[lang]}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{section.subtitle[lang]}</p>
                </div>
                <div className={`flex-shrink-0 p-1.5 rounded-lg transition-all duration-300 ${isOpen ? `${colors.bg} rotate-90` : 'bg-slate-100 group-hover:bg-slate-200'}`}>
                  <ChevronRight size={16} className={isOpen ? colors.text : 'text-slate-400'} />
                </div>
              </button>

              {/* Section Body */}
              {isOpen && (
                <div className={`px-5 pb-6 border-t ${colors.border} animate-fade-in`}>
                  {/* Steps */}
                  <div className="mt-5 space-y-3">
                    <h4 className={`text-xs font-black uppercase tracking-widest ${colors.text} mb-3 flex items-center gap-2`}>
                      <CheckCircle2 size={13} />
                      {t('How to use', 'എങ്ങനെ ഉപയോഗിക്കാം')}
                    </h4>
                    {section.steps.map((step, stepIdx) => (
                      <div key={stepIdx} className="flex items-start gap-3 group">
                        <div className={`flex-shrink-0 w-7 h-7 rounded-xl ${colors.badge} text-white flex items-center justify-center text-xs font-black mt-0.5 shadow-sm`}>
                          {stepIdx + 1}
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed pt-0.5 flex-1">
                          {step[lang]}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Tips */}
                  {section.tips && section.tips.length > 0 && (
                    <div className={`mt-5 p-4 ${colors.light} rounded-2xl border ${colors.border}`}>
                      <h4 className={`text-xs font-black uppercase tracking-widest ${colors.text} mb-2.5 flex items-center gap-2`}>
                        <Star size={13} />
                        {t('Pro Tips', 'പ്രോ ടിപ്പുകൾ')}
                      </h4>
                      {section.tips.map((tip, tipIdx) => (
                        <div key={tipIdx} className="flex items-start gap-2 mt-1.5">
                          <p className="text-xs text-slate-600 leading-relaxed">{tip[lang]}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* KEYBOARD SHORTCUTS */}
      <div className="ios-card p-6 mt-8">
        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
          <Zap size={20} className="text-amber-500" />
          {t('Keyboard Shortcuts', 'കീബോർഡ് ഷോർട്ട്‌കട്ടുകൾ')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { keys: 'Ctrl + K', action: { en: 'Open Quick Actions palette', ml: 'ക്വിക്ക് ആക്ഷൻസ് പാലറ്റ് തുറക്കുക' } },
            { keys: 'Ctrl + /', action: { en: 'Search transactions', ml: 'ഇടപാടുകൾ തിരയുക' } },
            { keys: 'Ctrl + N', action: { en: 'New entry', ml: 'പുതിയ എൻട്രി' } },
            { keys: 'Ctrl + P', action: { en: 'Print current page', ml: 'നിലവിലെ പേജ് പ്രിന്റ് ചെയ്യുക' } },
          ].map((shortcut, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <kbd className="px-3 py-1.5 bg-white rounded-lg text-xs font-mono font-bold text-slate-700 shadow-sm border border-slate-300 whitespace-nowrap">
                {shortcut.keys}
              </kbd>
              <span className="text-sm text-slate-600">{shortcut.action[lang]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* USER ROLES SUMMARY */}
      <div className="ios-card p-6 mt-6">
        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
          <Shield size={20} className="text-purple-600" />
          {t('User Roles & Permissions', 'ഉപയോക്തൃ റോളുകളും അനുമതികളും')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              role: { en: 'Admin', ml: 'അഡ്മിൻ' },
              desc: { en: 'Full access to all features, settings, employee management, and backups.', ml: 'എല്ലാ ഫീച്ചറുകൾ, സെറ്റിംഗ്സ്, ജീവനക്കാരുടെ മാനേജ്‌മെന്റ്, ബാക്കപ്പുകൾ എന്നിവയിലേക്ക് പൂർണ്ണ ആക്‌സസ്.' },
              color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            },
            {
              role: { en: 'Manager', ml: 'മാനേജർ' },
              desc: { en: 'Can approve requests. Most features available. No system settings.', ml: 'അഭ്യർത്ഥനകൾ അംഗീകരിക്കാൻ കഴിയും. മിക്ക ഫീച്ചറുകളും ലഭ്യമാണ്. സിസ്റ്റം സെറ്റിംഗ്സ് ഇല്ല.' },
              color: 'bg-blue-100 text-blue-700 border-blue-200',
            },
            {
              role: { en: 'Staff', ml: 'സ്റ്റാഫ്' },
              desc: { en: 'Record entries and view data. Edits/deletes need approval.', ml: 'എൻട്രികൾ രേഖപ്പെടുത്തുക, ഡാറ്റ കാണുക. എഡിറ്റുകൾ/ഡിലീറ്റുകൾക്ക് അംഗീകാരം ആവശ്യമാണ്.' },
              color: 'bg-amber-100 text-amber-700 border-amber-200',
            },
            {
              role: { en: 'Engineer', ml: 'എഞ്ചിനീയർ' },
              desc: { en: 'Limited access: Stock Management only. Ideal for maintenance teams.', ml: 'പരിമിതമായ ആക്‌സസ്: സ്റ്റോക്ക് മാനേജ്‌മെന്റ് മാത്രം. മെയിന്റനൻസ് ടീമുകൾക്ക് അനുയോജ്യം.' },
              color: 'bg-purple-100 text-purple-700 border-purple-200',
            },
          ].map((r, idx) => (
            <div key={idx} className={`p-4 rounded-2xl border ${r.color}`}>
              <h4 className="font-black text-sm mb-1">{r.role[lang]}</h4>
              <p className="text-xs leading-relaxed opacity-80">{r.desc[lang]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div className="ios-card p-6 mt-6 text-center bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
        <MessageCircle size={28} className="text-emerald-500 mx-auto mb-3" />
        <p className="text-sm text-slate-700 font-medium">
          {t(
            'Need more help? Contact your system administrator or email',
            'കൂടുതൽ സഹായം വേണോ? നിങ്ങളുടെ സിസ്റ്റം അഡ്മിനിസ്ട്രേറ്ററുമായി ബന്ധപ്പെടുക അല്ലെങ്കിൽ ഇമെയിൽ ചെയ്യുക'
          )}
        </p>
        <a href="mailto:support@amlak.app" className="inline-block mt-2 px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-lg">
          support@amlak.app
        </a>
        <p className="text-xs text-slate-400 mt-4">
          Amlak Premium · {t('Powered by RR Group', 'RR Group ആണ് പവർ ചെയ്യുന്നത്')} · v2.0
        </p>
      </div>
    </div>
  );
};

export default Help;
