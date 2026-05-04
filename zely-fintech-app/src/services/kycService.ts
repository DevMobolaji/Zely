
import { axiosPrivate } from '../api/client';
import { KYCStatusResponse, Tier2Payload, Tier3Payload, KYCSubmission } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock memory for simulation
let mockStatus: KYCStatusResponse = {
    currentTier: 'TIER_1',
    pendingSubmission: null,
    lastRejection: null
};

let mockPendingAdmin: KYCSubmission[] = [
    {
        id: 'sub_xyz123',
        userId: 'user_a1',
        userName: 'Adebayo Johnson',
        userEmail: 'adebayo.j@example.com',
        tier: 'TIER_2',
        status: 'PENDING_REVIEW',
        submittedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        data: {
            bvn: '22233344455',
            nin: '12345678901',
            dateOfBirth: '1990-05-15',
            address: {
                street: '123 Victoria Island',
                city: 'Lagos',
                state: 'Lagos',
                country: 'Nigeria',
                proofOfAddressUrl: 'https://via.placeholder.com/600x400?text=Proof+of+Address'
            },
            governmentId: {
                type: 'NIN_CARD',
                idNumber: 'NG-123456',
                documentUrl: 'https://via.placeholder.com/600x400?text=NIN+Card+Front'
            }
        }
    },
    {
        id: 'sub_abc789',
        userId: 'user_b2',
        userName: 'Sarah Williams',
        userEmail: 's.williams@test.com',
        tier: 'TIER_3',
        status: 'PENDING_REVIEW',
        submittedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        data: {
            selfieUrl: 'https://via.placeholder.com/400x400?text=User+Selfie',
            livenessVideoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4'
        }
    }
];

export const kycService = {
    getMyStatus: async (): Promise<KYCStatusResponse> => {
        /* PRODUCTION CODE
        const response = await axiosPrivate.get('/kyc/my-status');
        return response.data;
        */

        // SIMULATION
        await delay(800);
        return mockStatus;
    },

    upgradeToTier2: async (data: Tier2Payload): Promise<any> => {
        /* PRODUCTION CODE
        const response = await axiosPrivate.post('/kyc/upgrade-to-tier-2', data);
        return response.data;
        */

        // SIMULATION
        await delay(1500);
        mockStatus.pendingSubmission = {
            id: 'sub_' + Math.random().toString(36).substr(2, 9),
            tier: 'TIER_2',
            status: 'PENDING_REVIEW',
            submittedAt: new Date().toISOString()
        };
        
        // Add to admin list
        mockPendingAdmin.push({
            id: mockStatus.pendingSubmission.id,
            userId: 'user_123',
            userName: 'Test User',
            userEmail: 'user@example.com',
            tier: 'TIER_2',
            status: 'PENDING_REVIEW',
            submittedAt: mockStatus.pendingSubmission.submittedAt,
            data: data
        });

        return { success: true, message: 'Tier 2 application submitted' };
    },

    upgradeToTier3: async (data: Tier3Payload): Promise<any> => {
        /* PRODUCTION CODE
        const response = await axiosPrivate.post('/kyc/upgrade-to-tier-3', data);
        return response.data;
        */

        // SIMULATION
        await delay(1500);
        mockStatus.pendingSubmission = {
            id: 'sub_' + Math.random().toString(36).substr(2, 9),
            tier: 'TIER_3',
            status: 'PENDING_REVIEW',
            submittedAt: new Date().toISOString()
        };

        // Add to admin list
        mockPendingAdmin.push({
            id: mockStatus.pendingSubmission.id,
            userId: 'user_123',
            userName: 'Test User',
            userEmail: 'user@example.com',
            tier: 'TIER_3',
            status: 'PENDING_REVIEW',
            submittedAt: mockStatus.pendingSubmission.submittedAt,
            data: data
        });

        return { success: true, message: 'Tier 3 application submitted' };
    },

    // Admin Endpoints
    getPendingSubmissions: async (): Promise<KYCSubmission[]> => {
        /* PRODUCTION CODE
        const response = await axiosPrivate.get('/admin/kyc/pending');
        return response.data;
        */

        // SIMULATION
        await delay(1000);
        return [...mockPendingAdmin];
    },

    getSubmissionDetail: async (id: string): Promise<KYCSubmission> => {
        /* PRODUCTION CODE
        const response = await axiosPrivate.get(`/admin/kyc/${id}`);
        return response.data;
        */

        // SIMULATION
        await delay(800);
        const sub = mockPendingAdmin.find(s => s.id === id);
        if (!sub) throw new Error('Submission not found');
        return sub;
    },

    approveSubmission: async (id: string): Promise<any> => {
        /* PRODUCTION CODE
        const response = await axiosPrivate.post(`/admin/kyc/${id}/approve`);
        return response.data;
        */

        // SIMULATION
        await delay(1200);
        const index = mockPendingAdmin.findIndex(s => s.id === id);
        if (index !== -1) {
            const sub = mockPendingAdmin[index];
            mockStatus.currentTier = sub.tier;
            mockStatus.pendingSubmission = null;
            mockStatus.lastRejection = null;
            mockPendingAdmin.splice(index, 1);
        }
        return { success: true };
    },

    rejectSubmission: async (id: string, reason: string): Promise<any> => {
        /* PRODUCTION CODE
        const response = await axiosPrivate.post(`/admin/kyc/${id}/reject`, { reason });
        return response.data;
        */

        // SIMULATION
        await delay(1200);
        const index = mockPendingAdmin.findIndex(s => s.id === id);
        if (index !== -1) {
            const sub = mockPendingAdmin[index];
            mockStatus.pendingSubmission = null;
            mockStatus.lastRejection = {
                reason,
                tier: sub.tier,
                at: new Date().toISOString()
            };
            mockPendingAdmin.splice(index, 1);
        }
        return { success: true };
    }
};
