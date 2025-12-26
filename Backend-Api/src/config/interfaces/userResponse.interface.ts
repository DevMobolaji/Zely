export interface UserRegistrationResponse {
    userId: string;
    name: string;
    email: string;
    emailVerified: boolean;
    mfaEnabled: boolean;
    role: string;
    accessToken?: string
    refreshToken: string;
}
