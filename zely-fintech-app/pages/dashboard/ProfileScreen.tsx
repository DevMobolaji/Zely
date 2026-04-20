
import React from 'react';
import { User, Mail, Phone, MapPin, ShieldCheck, Upload } from 'lucide-react';

const ProfileScreen: React.FC = () => {
    return (
        <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-2xl font-bold">My Profile & KYC</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                        <div className="relative w-32 h-32 mx-auto mb-6">
                            <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" alt="Avatar" className="w-full h-full object-cover" />
                            </div>
                            <button className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full border-4 border-white dark:border-slate-900 hover:bg-primary-light transition-colors shadow-sm">
                                <Upload className="w-4 h-4" />
                            </button>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">John Doe</h3>
                        <p className="text-sm text-slate-500 font-bold mb-4">john.doe@example.com</p>
                        <div className="flex justify-center gap-2">
                             <span className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-bold uppercase rounded-full flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> KYC Tier 2
                             </span>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="font-bold text-lg mb-6">Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" defaultValue="John Doe" className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl py-3 pl-10 pr-4 font-semibold text-sm outline-none border border-transparent focus:border-primary" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="email" defaultValue="john.doe@example.com" disabled className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl py-3 pl-10 pr-4 font-semibold text-sm outline-none border border-transparent opacity-60 cursor-not-allowed" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="tel" defaultValue="+1 (555) 123-4567" className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl py-3 pl-10 pr-4 font-semibold text-sm outline-none border border-transparent focus:border-primary" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Address</label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" defaultValue="123 Innovation Dr, Tech City" className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl py-3 pl-10 pr-4 font-semibold text-sm outline-none border border-transparent focus:border-primary" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end">
                            <button className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors">Save Changes</button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="font-bold text-lg mb-6">KYC Documents</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 flex items-center justify-center">
                                        <ShieldCheck className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">Government ID</p>
                                        <p className="text-xs text-slate-500">Verified on Jan 15, 2023</p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-md">Verified</span>
                            </div>
                             <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center">
                                        <Upload className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">Proof of Address</p>
                                        <p className="text-xs text-slate-500">Required for Tier 3</p>
                                    </div>
                                </div>
                                <button className="text-xs font-bold text-primary hover:underline">Upload</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileScreen;
