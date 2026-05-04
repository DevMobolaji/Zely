
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, 
    ShieldCheck, 
    Upload, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    Calendar, 
    CreditCard, 
    MapPin, 
    User 
} from 'lucide-react';
import { kycService } from '../../services/kycService';
import { Tier2Payload } from '../../types';
import { useToast } from '../../context/ToastContext';
import CustomDatePicker from '../../components/common/CustomDatePicker';
import CustomSelect from '../../components/common/CustomSelect';

const KYCTier2Form: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Tier2Payload>({
        bvn: '',
        nin: '',
        dateOfBirth: '',
        governmentId: {
            type: 'NATIONAL_ID_CARD',
            number: '',
            documentUrl: ''
        },
        address: {
            street: '',
            city: '',
            state: '',
            country: 'NG',
            proofOfAddressUrl: ''
        }
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};
        
        if (!/^\d{11}$/.test(formData.bvn)) newErrors.bvn = 'BVN must be exactly 11 digits';
        if (!/^\d{11}$/.test(formData.nin)) newErrors.nin = 'NIN must be exactly 11 digits';
        
        if (!formData.dateOfBirth) {
            newErrors.dateOfBirth = 'Date of birth is required';
        } else {
            const dob = new Date(formData.dateOfBirth);
            if (dob >= new Date()) newErrors.dateOfBirth = 'Date of birth must be in the past';
        }

        if (formData.governmentId.number.length < 3 || formData.governmentId.number.length > 50) {
            newErrors.idNumber = 'ID number must be between 3 and 50 characters';
        }

        if (formData.address.street.length < 3 || formData.address.street.length > 200) {
            newErrors.street = 'Street must be between 3 and 200 characters';
        }

        if (formData.address.city.length < 2 || formData.address.city.length > 100) {
            newErrors.city = 'City must be between 2 and 100 characters';
        }

        if (formData.address.state.length < 2 || formData.address.state.length > 100) {
            newErrors.state = 'State must be between 2 and 100 characters';
        }

        if (!formData.governmentId.documentUrl) newErrors.documentUrl = 'ID document upload is required';
        if (!formData.address.proofOfAddressUrl) newErrors.proofOfAddressUrl = 'Proof of address upload is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) {
            showToast('Please correct the errors in the form', 'error');
            return;
        }

        setLoading(true);
        try {
            await kycService.upgradeToTier2(formData);
            showToast('Tier 2 application submitted successfully', 'success');
            navigate('/kyc');
        } catch (err: any) {
            showToast(err.message || 'Submission failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (field: 'document' | 'address') => {
        // API Call Preparation (Commented out for production use later)
        /*
        try {
            // const fileInput = document.createElement('input');
            // fileInput.type = 'file';
            // fileInput.accept = 'image/*,.pdf';
            // fileInput.onchange = async (e) => {
            //    const file = (e.target as HTMLInputElement).files?.[0];
            //    if (!file) return;
            //    
            //    const formData = new FormData();
            //    formData.append('file', file);
            //    
            //    const uploadRes = await fetch('/api/user/kyc/upload', {
            //        method: 'POST',
            //        body: formData
            //    });
            //    if (!uploadRes.ok) throw new Error('Upload failed');
            //    const { url } = await uploadRes.json();
            //    
            //    if (field === 'document') {
            //        setFormData(prev => ({ ...prev, governmentId: { ...prev.governmentId, documentUrl: url } }));
            //    } else {
            //        setFormData(prev => ({ ...prev, address: { ...prev.address, proofOfAddressUrl: url } }));
            //    }
            //    showToast(`${field === 'document' ? 'ID Document' : 'Proof of Address'} uploaded`, 'success');
            // };
            // fileInput.click();
            // return; // Early return to use real flow
        } catch(e) {
            console.error(e);
            showToast('error', 'Failed to upload document');
        }
        */

        // For simulation, we'll just set a mock URL
        const mockUrl = `https://storage.example.com/kyc/${field}_${Math.random().toString(36).substr(2, 9)}.jpg`;
        
        if (field === 'document') {
            setFormData(prev => ({
                ...prev,
                governmentId: { ...prev.governmentId, documentUrl: mockUrl }
            }));
            setErrors(prev => ({ ...prev, documentUrl: '' }));
        } else {
            setFormData(prev => ({
                ...prev,
                address: { ...prev.address, proofOfAddressUrl: mockUrl }
            }));
            setErrors(prev => ({ ...prev, proofOfAddressUrl: '' }));
        }
        
        showToast(`${field === 'document' ? 'ID Document' : 'Proof of Address'} uploaded`, 'success');
    };

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button 
                    onClick={() => navigate('/kyc')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Upgrade to Tier 2</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Higher limits, more freedom</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Section 1: Identity Numbers */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 text-blue-600 mb-2">
                        <User size={18} />
                        <h2 className="font-bold">Identity Details</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bank Verification Number (BVN)</label>
                            <input 
                                type="text"
                                maxLength={11}
                                value={formData.bvn}
                                onChange={e => setFormData({ ...formData, bvn: e.target.value.replace(/\D/g, '') })}
                                placeholder="12345678901"
                                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border ${errors.bvn ? 'border-red-500' : 'border-gray-100 dark:border-gray-700'} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
                            />
                            {errors.bvn && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {errors.bvn}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">National ID Number (NIN)</label>
                            <input 
                                type="text"
                                maxLength={11}
                                value={formData.nin}
                                onChange={e => setFormData({ ...formData, nin: e.target.value.replace(/\D/g, '') })}
                                placeholder="98765432109"
                                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border ${errors.nin ? 'border-red-500' : 'border-gray-100 dark:border-gray-700'} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
                            />
                            {errors.nin && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {errors.nin}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Date of Birth</label>
                            <CustomDatePicker 
                                value={formData.dateOfBirth}
                                onChange={value => setFormData({ ...formData, dateOfBirth: value })}
                                className={errors.dateOfBirth ? 'ring-2 ring-red-500/50 rounded-xl' : ''}
                            />
                            {errors.dateOfBirth && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {errors.dateOfBirth}</p>}
                        </div>
                    </div>
                </div>

                {/* Section 2: Government ID */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 text-blue-600 mb-2">
                        <CreditCard size={18} />
                        <h2 className="font-bold">Government-issued ID</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">ID Type</label>
                            <CustomSelect 
                                value={formData.governmentId.type}
                                onChange={value => setFormData({ 
                                    ...formData, 
                                    governmentId: { ...formData.governmentId, type: value as any } 
                                })}
                                options={[
                                    { value: 'NATIONAL_ID_CARD', label: 'National ID Card' },
                                    { value: 'DRIVERS_LICENSE', label: "Driver's License" },
                                    { value: 'INTERNATIONAL_PASSPORT', label: 'International Passport' },
                                    { value: 'VOTERS_CARD', label: "Voter's Card" }
                                ]}
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">ID Number</label>
                            <input 
                                type="text"
                                value={formData.governmentId.number}
                                onChange={e => setFormData({ 
                                    ...formData, 
                                    governmentId: { ...formData.governmentId, number: e.target.value } 
                                })}
                                placeholder="ABC1234567"
                                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border ${errors.idNumber ? 'border-red-500' : 'border-gray-100 dark:border-gray-700'} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
                            />
                            {errors.idNumber && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {errors.idNumber}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">Upload ID Document (Front)</label>
                            <div 
                                onClick={() => handleFileUpload('document')}
                                className={`border-2 border-dashed ${formData.governmentId.documentUrl ? 'border-green-500 bg-green-50/10' : errors.documentUrl ? 'border-red-500 bg-red-50/10' : 'border-gray-200 dark:border-gray-800 hover:border-blue-500 hover:bg-blue-50/10'} rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center gap-3`}
                            >
                                {formData.governmentId.documentUrl ? (
                                    <>
                                        <CheckCircle2 size={32} className="text-green-600" />
                                        <p className="text-sm font-bold text-green-700 uppercase tracking-wider">Document Uploaded</p>
                                        <p className="text-xs text-gray-500">Click to replace</p>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={32} className="text-gray-400" />
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">Click to upload document</p>
                                            <p className="text-xs text-gray-500">PNG, JPG or PDF up to 5MB</p>
                                        </div>
                                    </>
                                )}
                            </div>
                            {errors.documentUrl && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle size={12} /> {errors.documentUrl}</p>}
                        </div>
                    </div>
                </div>

                {/* Section 3: Address */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 text-blue-600 mb-2">
                        <MapPin size={18} />
                        <h2 className="font-bold">Residential Address</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Street Address</label>
                            <input 
                                type="text"
                                value={formData.address.street}
                                onChange={e => setFormData({ 
                                    ...formData, 
                                    address: { ...formData.address, street: e.target.value } 
                                })}
                                placeholder="12 Lekki Phase 1"
                                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border ${errors.street ? 'border-red-500' : 'border-gray-100 dark:border-gray-700'} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
                            />
                            {errors.street && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {errors.street}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">City</label>
                            <input 
                                type="text"
                                value={formData.address.city}
                                onChange={e => setFormData({ 
                                    ...formData, 
                                    address: { ...formData.address, city: e.target.value } 
                                })}
                                placeholder="Lagos"
                                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border ${errors.city ? 'border-red-500' : 'border-gray-100 dark:border-gray-700'} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
                            />
                            {errors.city && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {errors.city}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">State</label>
                            <input 
                                type="text"
                                value={formData.address.state}
                                onChange={e => setFormData({ 
                                    ...formData, 
                                    address: { ...formData.address, state: e.target.value } 
                                })}
                                placeholder="Lagos"
                                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border ${errors.state ? 'border-red-500' : 'border-gray-100 dark:border-gray-700'} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
                            />
                            {errors.state && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {errors.state}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">Upload Proof of Address (Utility Bill, Bank Statement)</label>
                            <div 
                                onClick={() => handleFileUpload('address')}
                                className={`border-2 border-dashed ${formData.address.proofOfAddressUrl ? 'border-green-500 bg-green-50/10' : errors.proofOfAddressUrl ? 'border-red-500 bg-red-50/10' : 'border-gray-200 dark:border-gray-800 hover:border-blue-500 hover:bg-blue-50/10'} rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center gap-3`}
                            >
                                {formData.address.proofOfAddressUrl ? (
                                    <>
                                        <CheckCircle2 size={32} className="text-green-600" />
                                        <p className="text-sm font-bold text-green-700 uppercase tracking-wider">Proof Uploaded</p>
                                        <p className="text-xs text-gray-500">Click to replace</p>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={32} className="text-gray-400" />
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">Click to upload proof</p>
                                            <p className="text-xs text-gray-500">Must be dated within last 3 months</p>
                                        </div>
                                    </>
                                )}
                            </div>
                            {errors.proofOfAddressUrl && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle size={12} /> {errors.proofOfAddressUrl}</p>}
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                    {loading ? (
                        <>
                            <Loader2 size={24} className="animate-spin" /> Submitting Application...
                        </>
                    ) : (
                        <>
                            <ShieldCheck size={24} /> Submit Application
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};

export default KYCTier2Form;
