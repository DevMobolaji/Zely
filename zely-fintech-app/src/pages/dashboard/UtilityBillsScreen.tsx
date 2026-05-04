import React, { useState, ChangeEvent, FormEvent } from 'react';
import { Lightbulb, Tv, ChevronRight, Smartphone, Wifi } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { accountsData } from '../../utils/mockData';

const categories = [
  { id: 'telecom', name: 'Airtime & Data', type: 'telecom', icon: Smartphone, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', description: 'MTN, Airtel, GLO, 9Mobile' },
  { id: 'electricity', name: 'Electricity', type: 'electricity', icon: Lightbulb, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', description: 'IKEDC, EKEDC, AEDC, IBEDC...' },
  { id: 'tv', name: 'Cable TV', type: 'tv', icon: Tv, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', description: 'DSTV, GOTV, Startimes' },
  { id: 'internet', name: 'Internet', type: 'internet', icon: Wifi, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', description: 'Spectranet, Smile, IPNX' },
];

const telecomProviders = ['MTN', 'Airtel', 'GLO', '9Mobile'];
const electricityProviders = ['Ikeja Electric (IKEDC)', 'Eko Electric (EKEDC)', 'Abuja Electric (AEDC)', 'Ibadan Electric (IBEDC)', 'Port-Harcourt Electric (PHED)', 'Enugu Electric (EEDC)'];
const tvProviders = ['DSTV', 'GOTV', 'Startimes', 'Showmax'];
const internetProviders = ['Spectranet', 'Smile', 'IPNX', 'Tizeti'];

const dataPlans = [
  { value: '100', label: '100MB - 1 Day (₦100)' },
  { value: '500', label: '1GB - 1 Day (₦500)' },
  { value: '1000', label: '1.5GB - 30 Days (₦1,000)' },
  { value: '2000', label: '4.5GB - 30 Days (₦2,000)' },
  { value: '5000', label: '15GB - 30 Days (₦5,000)' },
];

const tvPackages = [
  { value: '1500', label: 'Basic Package (₦1,500)' },
  { value: '3000', label: 'Standard Package (₦3,000)' },
  { value: '5000', label: 'Premium Package (₦5,000)' },
  { value: '12000', label: 'Ultra Package (₦12,000)' },
];

const UtilityBillsScreen: React.FC = () => {
  const { showToast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<typeof categories[0] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Dynamic Form State
  const [provider, setProvider] = useState('');
  const [subType, setSubType] = useState('airtime'); // airtime | data
  const [customerId, setCustomerId] = useState(''); // phone number, meter, smartcard
  const [amount, setAmount] = useState('');
  const [packageId, setPackageId] = useState('');

  // Mock user account (checking)
  const currentAccount = accountsData.find(a => a.type === 'current') || accountsData[0];

  const resetForm = () => {
    setProvider('');
    setSubType('airtime');
    setCustomerId('');
    setAmount('');
    setPackageId('');
  };

  const handleCategorySelect = (category: typeof categories[0]) => {
    setSelectedCategory(category);
    resetForm();
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();

    let paymentAmount = amount;
    if (selectedCategory?.type === 'telecom' && subType === 'data') paymentAmount = packageId;
    if (selectedCategory?.type === 'tv') paymentAmount = packageId;

    if (!provider || !customerId || !paymentAmount) return;

    setIsProcessing(true);

    // Mock processing time
    setTimeout(() => {
      setIsProcessing(false);
      showToast('success', `Successfully paid ₦${Number(paymentAmount).toLocaleString()} for ${selectedCategory?.name}`);
      setSelectedCategory(null);
      resetForm();
    }, 1500);
  };

  if (selectedCategory) {
    const CategoryIcon = selectedCategory.icon;

    let isFormValid = true;
    if (!provider || !customerId) isFormValid = false;

    if (selectedCategory.type === 'telecom') {
      if (subType === 'airtime' && !amount) isFormValid = false;
      if (subType === 'data' && !packageId) isFormValid = false;
    } else if (selectedCategory.type === 'tv') {
      if (!packageId) isFormValid = false;
    } else {
      if (!amount) isFormValid = false;
    }

    return (
      <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
        <button
          onClick={() => setSelectedCategory(null)}
          className="mb-6 flex items-center font-bold text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back to Utilities
        </button>

        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
            <div className={`w-14 h-14 ${selectedCategory.bg} ${selectedCategory.color} rounded-2xl flex items-center justify-center`}>
              <CategoryIcon className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedCategory.name}</h2>
              <p className="text-slate-500 font-medium capitalize">Bill Payment</p>
            </div>
          </div>

          <form onSubmit={handlePayment} className="space-y-6">
            {/* Sub-type selection (only for Telecom) */}
            {selectedCategory.type === 'telecom' && (
              <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => setSubType('airtime')}
                  className={`py-2 text-sm font-bold rounded-lg transition-colors ${subType === 'airtime' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Airtime
                </button>
                <button
                  type="button"
                  onClick={() => setSubType('data')}
                  className={`py-2 text-sm font-bold rounded-lg transition-colors ${subType === 'data' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Data
                </button>
              </div>
            )}

            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Select Provider
              </label>
              <select
                value={provider}
                onChange={(e: { target: { value: any; }; }) => setProvider(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-lg font-bold shadow-inner focus:ring-2 focus:ring-primary outline-none py-4 px-5 dark:text-white"
                required
              >
                <option value="" disabled>Choose provider</option>
                {selectedCategory.type === 'telecom' && telecomProviders.map(p => <option key={p} value={p}>{p}</option>)}
                {selectedCategory.type === 'electricity' && electricityProviders.map(p => <option key={p} value={p}>{p}</option>)}
                {selectedCategory.type === 'tv' && tvProviders.map(p => <option key={p} value={p}>{p}</option>)}
                {selectedCategory.type === 'internet' && internetProviders.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Customer ID (Phone / Meter / Smartcard) */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                {selectedCategory.type === 'telecom' ? 'Phone Number' :
                  selectedCategory.type === 'electricity' ? 'Meter Number' :
                    selectedCategory.type === 'tv' ? 'Smartcard / IUC Number' : 'Account Number'}
              </label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-lg font-bold shadow-inner focus:ring-2 focus:ring-primary outline-none py-4 px-5 dark:text-white"
                placeholder={selectedCategory.type === 'telecom' ? "08012345678" : "e.g. 123456789"}
                required
              />
            </div>

            {/* Amount or Package Selection */}
            {(selectedCategory.type === 'telecom' && subType === 'data') || selectedCategory.type === 'tv' ? (
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Select Package
                </label>
                <select
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-lg font-bold shadow-inner focus:ring-2 focus:ring-primary outline-none py-4 px-5 dark:text-white"
                  required
                >
                  <option value="" disabled>Choose package</option>
                  {selectedCategory.type === 'telecom' && dataPlans.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  {selectedCategory.type === 'tv' && tvPackages.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Amount (₦)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-lg font-bold shadow-inner focus:ring-2 focus:ring-primary outline-none py-4 px-5 dark:text-white"
                  placeholder="0.00"
                  required
                  min="1"
                />
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-slate-500">Paying from</p>
                <p className="font-bold text-slate-900 dark:text-white">{currentAccount.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-500">Balance</p>
                <p className="font-bold text-slate-900 dark:text-white pb-0.5">₦{currentAccount.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing || !isFormValid}
              className="w-full bg-primary hover:bg-primary-light text-white rounded-xl py-4 font-black transition-all shadow-lg shadow-primary/30 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-4"
            >
              {isProcessing ? 'Processing Payment...' : 'Pay Bill'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Utility Bills</h1>
        <p className="text-slate-500 font-medium">Pay for airtime, data, electricity and cable instantly.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map(category => {
          const Icon = category.icon;
          return (
            <div
              key={category.id}
              onClick={() => handleCategorySelect(category)}
              className="flex items-center gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] p-6 hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer group hover:-translate-y-1"
            >
              <div className={`w-16 h-16 shrink-0 ${category.bg} ${category.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <Icon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5">{category.name}</h3>
                <p className="text-sm font-medium text-slate-500 line-clamp-2">{category.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UtilityBillsScreen;
