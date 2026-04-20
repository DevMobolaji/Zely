
import React from 'react';

// --- API Response Types ---
export interface ApiResponse<T> {
    data: T;
    message: string;
    status: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
}

// --- Domain Entities ---

export type TransactionStatus = 'success' | 'pending' | 'failed';
export type TransactionType = 'incoming' | 'outgoing';

export interface Transaction {
    id: string;
    title: string;
    category: string;
    amount: number;
    date: string;
    status: TransactionStatus;
    type: TransactionType;
    recipientName?: string;
    notes?: string;
    fee?: number;
    merchantDetails?: {
        name: string;
        address: string;
        mapPlaceholderColor?: string;
    };
}

export interface Account {
    id: string;
    name: string;
    type: 'current' | 'savings' | 'virtual' | 'crypto';
    balance: number;
    currency: string;
    number: string;
    iban?: string;
    trend: string;
    trendUp: boolean;
    cardProvider?: 'VISA' | 'Mastercard';
    cardExpiry?: string;
    cardLast4?: string;
}

export interface Notification {
    id: string;
    type: 'current' | 'debit' | 'security' | 'info' | 'credit';
    title: string;
    message: string;
    time: string;
    read: boolean;
}

export interface Session {
    id: string;
    device: string;
    browser: string;
    location: string;
    lastActive: string;
    isCurrent: boolean;
    icon: React.ElementType;
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'admin';
    avatarUrl?: string;
}
