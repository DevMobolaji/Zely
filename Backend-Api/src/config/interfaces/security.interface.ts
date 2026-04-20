

export interface IActionAttempt {
  key: string;                // email or userId or IP+email
  action: SecurityAction;
  attemptCount: number;
  blockedUntil?: Date;
  lastFailureAt?: Date;
  deviceId?: string;
  ip?: string;
}

export enum SecurityAction {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  RESEND_VERIFICATION = 'RESEND_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  OTP_VERIFY = 'OTP_VERIFY',
}