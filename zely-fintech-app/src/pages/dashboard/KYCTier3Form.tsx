
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, 
    ShieldCheck, 
    Upload, 
    Loader2, 
    AlertCircle, 
    Camera, 
    Video, 
    CheckCircle2, 
    Info 
} from 'lucide-react';
import { kycService } from '../../services/kycService';
import { Tier3Payload } from '../../types';
import { useToast } from '../../context/ToastContext';

const KYCTier3Form: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Tier3Payload>({
        selfieUrl: '',
        livenessVideoUrl: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.selfieUrl) newErrors.selfieUrl = 'Selfie photo is required';
        if (!formData.livenessVideoUrl) newErrors.livenessVideoUrl = 'Liveness video is required';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleFileUpload = async (type: 'selfie' | 'video') => {
        // API Call Preparation (Commented out for production use later)
        /*
        try {
            // const fileInput = document.createElement('input');
            // fileInput.type = 'file';
            // fileInput.accept = type === 'selfie' ? 'image/*' : 'video/*';
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
            //    if (type === 'selfie') {
            //        setFormData(prev => ({ ...prev, selfieUrl: url }));
            //    } else {
            //        setFormData(prev => ({ ...prev, livenessVideoUrl: url }));
            //    }
            //    showToast(`${type === 'selfie' ? 'Selfie' : 'Liveness Video'} uploaded successfully`, 'success');
            // };
            // fileInput.click();
            // return; // Early return to use real flow
        } catch(e) {
            console.error(e);
            showToast('error', 'Failed to upload media');
        }
        */

        // Simulation
        const mockUrl = `https://storage.example.com/kyc/${type}_${Math.random().toString(36).substr(2, 9)}.${type === 'selfie' ? 'jpg' : 'mp4'}`;
        
        if (type === 'selfie') {
            setFormData(prev => ({ ...prev, selfieUrl: mockUrl }));
            setErrors(prev => ({ ...prev, selfieUrl: '' }));
        } else {
            setFormData(prev => ({ ...prev, livenessVideoUrl: mockUrl }));
            setErrors(prev => ({ ...prev, livenessVideoUrl: '' }));
        }
        
        showToast(`${type === 'selfie' ? 'Selfie' : 'Liveness Video'} uploaded`, 'success');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            await kycService.upgradeToTier3(formData);
            showToast('Tier 3 application submitted successfully', 'success');
            navigate('/kyc');
        } catch (err: any) {
            showToast(err.message || 'Submission failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button 
                    onClick={() => navigate('/kyc')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Upgrade to Tier 3</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Unlimited access & maximum security</p>
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/30 flex items-start gap-3 mb-8">
                <Info size={18} className="text-blue-600 mt-0.5" />
                <p className="text-xs text-blue-800/80 dark:text-blue-300/80 font-medium leading-relaxed">
                    Tier 3 verification requires biometric data to confirm your physical presence. Please ensure you are in a well-lit environment and your face is fully visible.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Selfie Upload */}
                <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Camera size={16} className="text-blue-600" /> Take a Selfie
                    </label>
                    <div 
                        onClick={() => handleFileUpload('selfie')}
                        className={`border-2 border-dashed ${formData.selfieUrl ? 'border-green-500 bg-green-50/10' : errors.selfieUrl ? 'border-red-500 bg-red-50/10' : 'border-gray-200 dark:border-gray-800 hover:border-blue-500 hover:bg-blue-50/10'} rounded-3xl aspect-[4/3] flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group`}
                    >
                        {formData.selfieUrl ? (
                            <>
                                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600">
                                    <CheckCircle2 size={40} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-green-700">Selfie captured</p>
                                    <p className="text-xs text-gray-500 mt-1">Tap to retake</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400 group-hover:text-blue-500 transition-colors">
                                    <Camera size={40} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">Click to open camera</p>
                                    <p className="text-xs text-gray-500 mt-1">Make sure your face is centered</p>
                                </div>
                            </>
                        )}
                    </div>
                    {errors.selfieUrl && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {errors.selfieUrl}</p>}
                </div>

                {/* Liveness Video Upload */}
                <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Video size={16} className="text-blue-600" /> Liveness Verification
                    </label>
                    <div 
                        onClick={() => handleFileUpload('video')}
                        className={`border-2 border-dashed ${formData.livenessVideoUrl ? 'border-green-500 bg-green-50/10' : errors.livenessVideoUrl ? 'border-red-500 bg-red-50/10' : 'border-gray-200 dark:border-gray-800 hover:border-blue-500 hover:bg-blue-50/10'} rounded-3xl aspect-[4/3] flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group`}
                    >
                        {formData.livenessVideoUrl ? (
                            <>
                                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600">
                                    <CheckCircle2 size={40} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-green-700">Video recorded</p>
                                    <p className="text-xs text-gray-500 mt-1">Tap to record again</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400 group-hover:text-blue-500 transition-colors">
                                    <Video size={40} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">Record 5s liveness video</p>
                                    <p className="text-xs text-gray-500 mt-1">Blink and turn your head slowly</p>
                                </div>
                            </>
                        )}
                    </div>
                    {errors.livenessVideoUrl && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {errors.livenessVideoUrl}</p>}
                </div>

                <div className="pt-6">
                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={24} className="animate-spin" /> Verifying...
                            </>
                        ) : (
                            <>
                                <ShieldCheck size={24} /> Submit Final Upgrade
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-gray-400 text-center mt-4 uppercase tracking-widest font-semibold">
                        Encrypted biometric transmission secured by Zely
                    </p>
                </div>
            </form>
        </div>
    );
};

export default KYCTier3Form;
