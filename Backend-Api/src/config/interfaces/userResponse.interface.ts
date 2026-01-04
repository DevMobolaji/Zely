export interface UserRegistrationResponse {
    userId: string;
    name: string;
    email: string;
    emailVerified: string;
    mfaEnabled: boolean;
    role: string;
    accessToken?: string
    refreshToken: string;
}


export interface EmailOtpPayload {
    userId: string;
    otp: string; // hashed OTP
}