
import { Transaction, Account, Notification, Session } from './types';
import { Laptop, Phone, Monitor } from 'lucide-react';

export const initialSessions: Session[] = [
    { id: 's1', device: 'MacBook Pro 16"', browser: 'Chrome', location: 'Lagos, NG', lastActive: 'Active now', isCurrent: true, icon: Laptop },
    { id: 's2', device: 'iPhone 15 Pro', browser: 'Safari App', location: 'Abuja, NG', lastActive: '2 hours ago', isCurrent: false, icon: Phone },
    { id: 's3', device: 'Windows Desktop', browser: 'Microsoft Edge', location: 'London, UK', lastActive: '3 days ago', isCurrent: false, icon: Monitor },
];

export const generateMockData = (): Transaction[] => {
    const baseData: Transaction[] = [
        {
            id: '1',
            title: 'Netflix Subscription',
            category: 'Entertainment',
            amount: 4500.00,
            date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            status: 'success',
            type: 'outgoing',
            recipientName: 'Netflix Inc.',
            notes: 'Monthly Standard Plan',
            fee: 0.00,
            merchantDetails: { name: 'Netflix Services', address: 'Lagos, Nigeria', mapPlaceholderColor: 'bg-red-500' }
        },
        {
            id: '2',
            title: 'Design Project',
            category: 'Freelance',
            amount: 250000.00,
            date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            status: 'success',
            type: 'incoming',
            recipientName: 'Acme Corp',
            notes: 'Web Redesign Q4 Payment',
            fee: 100.00
        },
        {
            id: '3',
            title: 'Transfer to Sarah',
            category: 'Transfer',
            amount: 15000.00,
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1.5).toISOString(),
            status: 'failed',
            type: 'outgoing',
            recipientName: 'Sarah Smith',
            notes: 'Dinner Split',
            fee: 50.00
        },
        {
            id: '4',
            title: 'Grocery Store',
            category: 'Food',
            amount: 45000.00,
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
            status: 'success',
            type: 'outgoing',
            recipientName: 'Shoprite',
            notes: 'Weekly groceries',
            fee: 0.00,
            merchantDetails: { name: 'Shoprite', address: 'Ikeja City Mall, Lagos', mapPlaceholderColor: 'bg-green-600' }
        },
        {
            id: '5',
            title: 'Spotify',
            category: 'Entertainment',
            amount: 900.00,
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
            status: 'pending',
            type: 'outgoing',
            recipientName: 'Spotify AB',
            notes: 'Premium Individual',
            fee: 0.00
        },
    ];

    let expanded: Transaction[] = [...baseData];
    for (let i = 0; i < 25; i++) {
        const base = baseData[i % baseData.length];
        expanded.push({
            ...base,
            id: `${i + 6}`,
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * (i + 4)).toISOString(),
            title: `${base.title} #${i + 1}`
        });
    }
    return expanded;
};

export const notificationsData: Notification[] = [
    { id: 'n1', type: 'credit', title: 'Payment Received', message: 'You received ₦250,000.00 from Acme Corp.', time: '2 mins ago', read: false },
    { id: 'n2', type: 'debit', title: 'Subscription Paid', message: 'Netflix subscription of ₦4,500.00 was successful.', time: '2 hours ago', read: false },
    { id: 'n3', type: 'security', title: 'New Login', message: 'New login detected from Mac OS Chrome.', time: '5 hours ago', read: true },
    { id: 'n4', type: 'debit', title: 'Bill Payment', message: 'Electric Bill payment of ₦15,000.00 processed.', time: '1 day ago', read: true },
    { id: 'n5', type: 'info', title: 'Account Statement', message: 'Your monthly statement is ready to view.', time: '2 days ago', read: true },
    { id: 'n6', type: 'security', title: 'Password Changed', message: 'Your security password was updated successfully.', time: '3 days ago', read: true },
    { id: 'n7', type: 'info', title: 'New Feature', message: 'Check out our new budgeting tools in the dashboard.', time: '4 days ago', read: true },
    { id: 'n8', type: 'credit', title: 'Refund Processed', message: 'Refund of ₦2,500.00 from Uber has been credited.', time: '5 days ago', read: true },
];

export const accountsData: Account[] = [
    {
        id: 'acc_1',
        name: 'Main Checking',
        type: 'current',
        balance: 1245000.00,
        currency: '₦',
        number: '0123456789',
        iban: 'NG89 0000 0000 0000 0123 4567 89',
        trend: '+2.4%',
        trendUp: true,
        cardProvider: 'VISA',
        cardExpiry: '12/25',
        cardLast4: '4298'
    },
    {
        id: 'acc_2',
        name: 'High-Yield Savings',
        type: 'savings',
        balance: 4520000.50,
        currency: '₦',
        number: '0987654321',
        iban: 'NG89 0000 0000 0000 0987 6543 21',
        trend: '+12.5%',
        trendUp: true,
        cardProvider: 'Mastercard',
        cardExpiry: '09/26',
        cardLast4: '8821'
    },
    {
        id: 'acc_3',
        name: 'Vacation Fund',
        type: 'savings',
        balance: 350000.00,
        currency: '₦',
        number: '5566778899',
        trend: '+5.2%',
        trendUp: true,
        cardProvider: 'Mastercard',
        cardExpiry: '06/27',
        cardLast4: '1099'
    }
];

export const performanceData = [
    { day: 'Mon', value: 57, sent: 54000, received: 850000, label: 'Monday' },
    { day: 'Tue', value: 44, sent: 12000, received: 720000, label: 'Tuesday' },
    { day: 'Wed', value: 81, sent: 298700, received: 1130000, label: 'Wednesday' },
    { day: 'Thu', value: 37, sent: 80000, received: 590000, label: 'Thursday' },
    { day: 'Fri', value: 53, sent: 45000, received: 910000, label: 'Friday' },
    { day: 'Sat', value: 48, sent: 120000, received: 780000, label: 'Saturday' },
    { day: 'Sun', value: 77, sent: 60000, received: 1050000, label: 'Sunday' },
];
