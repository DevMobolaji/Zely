
import React, { useState } from 'react';
import { User, Shield, Bell, Moon, Smartphone, LogOut, ChevronRight, Key, CreditCard, Lock, Eye } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
// import { handleLogout as apiLogout } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

const Section = ({ title, children }: { title: string, children?: React.ReactNode }) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">{title}</h3>
        </div>
        <div className="p-2">
            {children}
        </div>
    </div>
);

const SettingItem = ({ icon: Icon, title, subtitle, action, destructive }: any) => (
    <button 
        onClick={action}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors group text-left"
    >
        <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${destructive ? 'bg-red-50 text-red-500 dark:bg-red-900/10' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <h4 className={`font-bold text-sm ${destructive ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>{title}</h4>
                {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{subtitle}</p>}
            </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
    </button>
);

const ToggleItem = ({ icon: Icon, title, subtitle, value, onChange }: any) => (
    <div className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{subtitle}</p>
            </div>
        </div>
        <button 
            onClick={() => onChange(!value)}
            className={`w-12 h-6 rounded-full transition-colors relative ${value ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
    </div>
);

const SettingsScreen: React.FC = () => {
    const { auth } = useAuth();
    const { showToast } = useToast();
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [pushNotifications, setPushNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

    const handleLogout = () => {
        //apiLogout();
        showToast('success', 'Logged out successfully');
    };

    return (
        <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-2xl font-bold mb-6">Settings</h2>

            <Section title="Account">
                <SettingItem 
                    icon={User} 
                    title="Profile Information" 
                    subtitle="Name, Email, Phone Number"
                    action={() => {}} 
                />
                <SettingItem 
                    icon={CreditCard} 
                    title="Payment Methods" 
                    subtitle="Manage cards and bank accounts"
                    action={() => {}} 
                />
            </Section>

            <Section title="Security">
                <SettingItem 
                    icon={Lock} 
                    title="Change Password" 
                    subtitle="Last changed 3 months ago"
                    action={() => {}} 
                />
                <SettingItem 
                    icon={Shield} 
                    title="Two-Factor Authentication" 
                    subtitle="Enabled (Authenticator App)"
                    action={() => {}} 
                />
                <SettingItem 
                    icon={Smartphone} 
                    title="Active Sessions" 
                    subtitle="MacBook Pro, iPhone 15"
                    action={() => {}} 
                />
            </Section>

            <Section title="Preferences">
                <ToggleItem 
                    icon={Bell} 
                    title="Push Notifications" 
                    subtitle="Receive alerts on your device"
                    value={pushNotifications}
                    onChange={setPushNotifications}
                />
                <ToggleItem 
                    icon={User} // Using User icon as a placeholder for email
                    title="Email Updates" 
                    subtitle="News, product updates, and digests"
                    value={emailNotifications}
                    onChange={setEmailNotifications}
                />
                 <ToggleItem 
                    icon={Moon} 
                    title="Dark Mode" 
                    subtitle="Adjust appearance"
                    value={darkMode}
                    onChange={setDarkMode}
                />
            </Section>

             <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 overflow-hidden mb-6">
                <div className="p-2">
                     <SettingItem 
                        icon={LogOut} 
                        title="Log Out" 
                        subtitle="Sign out of your account on this device"
                        action={handleLogout}
                        destructive
                    />
                </div>
             </div>
             
             <p className="text-center text-xs text-slate-400 font-medium py-4">
                 Zely Fintech App v1.0.2 • Build 20240515
             </p>
        </div>
    );
};

export default SettingsScreen;
