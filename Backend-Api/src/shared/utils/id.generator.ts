import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz',
    16
);

export enum IDPrefixes {
    // User domain
    USER = 'USR',
    SESSION = 'SES',
    DEVICE = 'DEV',

    // Account domain
    ACCOUNT = 'ACC',
    ACCOUNT_NUMBER = 'AN', // 10-digit account number

    // Transaction domain
    TRANSACTION = 'TXN',
    TRANSFER = 'TRF',
    PAYMENT = 'PAY',
    REFUND = 'REF',
    REVERSAL = 'REV',

    // Compliance domain
    KYC = 'KYC',
    KYC_DOCUMENT = 'DOC',

    // Notification domain
    NOTIFICATION = 'NTF',
    EMAIL = 'EML',
    SMS = 'SMS',

    // Audit domain
    AUDIT_LOG = 'AUD',

    // Beneficiary
    BENEFICIARY = 'BEN',

    // API Keys
    API_KEY = 'KEY',

    // Idempotency
    IDEMPOTENCY = 'IDP',

    //EVENT
    EVENT = "EVT",

    //WALLET
    WALLET = "WAL",
    
    //LEDGER
    LEDGER = "LED",

    //LEDGER ACCOUNT
    LEDGER_ACCOUNT = "LAC",
    
}

export type EntityId<T extends IDPrefixes> = `${T}_${string}`;


// Generate a new ID
function generateId(prefix: IDPrefixes): string {
    return `${prefix}_${nanoid()}`;
}

export function generateAccountNumber(): string {
    // Generate 10 random digits (avoid starting with 0)
    const firstDigit = Math.floor(Math.random() * 9) + 1; // 1-9
    const remainingDigits = Array.from({ length: 9 }, () =>
        Math.floor(Math.random() * 10)
    ).join('');

    return `${firstDigit}${remainingDigits}`;
}

export function generateTransactionReference(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const random = nanoid();

    return `${IDPrefixes.TRANSACTION}_${dateStr}_${random}`;
}

export function generateIdempotencyKey(): string {
    const timestamp = Date.now();
    const random = nanoid();
    return `${IDPrefixes.IDEMPOTENCY}_${timestamp}_${random}`;
}


export function validateId(id: string, expectedPrefix?: IDPrefixes): boolean {
    if (!id || typeof id !== 'string') {
        return false;
    }

    // Check format: PREFIX_RANDOMSTRING
    const parts = id.split('_');
    if (parts.length !== 2) {
        return false;
    }

    const [prefix, random] = parts;

    // Check prefix
    if (expectedPrefix && prefix !== expectedPrefix) {
        return false;
    }

    // Check if prefix exists in our enum
    const validPrefixes = Object.values(IDPrefixes);
    if (!validPrefixes.includes(prefix as IDPrefixes)) {
        return false;
    }

    // Check random part (should be 16 characters from our alphabet)
    if (random.length !== 16) {
        return false;
    }

    return true;
}


/**
 * @param id - Full ID
 * @returns Prefix or null if invalid
 */
export function getIdPrefix(id: string): IDPrefixes | null {
    if (!id || typeof id !== 'string') {
        return null;
    }

    const parts = id.split('_');
    if (parts.length === 2) {
        const prefix = parts[0] as IDPrefixes;
        return Object.values(IDPrefixes).includes(prefix) ? prefix : null;
    }

    return null;
}

/**
 * @param id - ID to check
 * @param prefix - Expected prefix
 * @returns boolean
 */
export function isIdOfType(id: string, prefix: IDPrefixes): boolean {
    return getIdPrefix(id) === prefix;
}

// Export generator functions with proper types
export const generateUserId = (): EntityId<IDPrefixes.USER> =>
    generateId(IDPrefixes.USER) as EntityId<IDPrefixes.USER>;

export const generateEventId = (): EntityId<IDPrefixes.EVENT> =>
    generateId(IDPrefixes.EVENT) as EntityId<IDPrefixes.EVENT>;

export const generateSessionId = (): EntityId<IDPrefixes.SESSION> =>
    generateId(IDPrefixes.SESSION) as EntityId<IDPrefixes.SESSION>;

export const generateWalletId = (): EntityId<IDPrefixes.WALLET> =>
    generateId(IDPrefixes.WALLET) as EntityId<IDPrefixes.WALLET>;

export const generateLedgerId = (): EntityId<IDPrefixes.LEDGER> =>
    generateId(IDPrefixes.LEDGER) as EntityId<IDPrefixes.LEDGER>;

export const generateLedgerAccountId = (): EntityId<IDPrefixes.LEDGER_ACCOUNT> =>
    generateId(IDPrefixes.LEDGER_ACCOUNT) as EntityId<IDPrefixes.LEDGER_ACCOUNT>;

export const generateDeviceId = (): EntityId<IDPrefixes.DEVICE> =>
    generateId(IDPrefixes.DEVICE) as EntityId<IDPrefixes.DEVICE>;

export const generateAccountId = (): EntityId<IDPrefixes.ACCOUNT> =>
    generateId(IDPrefixes.ACCOUNT) as EntityId<IDPrefixes.ACCOUNT>;

export const generateTransactionId = (): EntityId<IDPrefixes.TRANSACTION> =>
    generateId(IDPrefixes.TRANSACTION) as EntityId<IDPrefixes.TRANSACTION>;

export const generateTransferId = (): EntityId<IDPrefixes.TRANSFER> =>
    generateId(IDPrefixes.TRANSFER) as EntityId<IDPrefixes.TRANSFER>;

export const generatePaymentId = (): EntityId<IDPrefixes.PAYMENT> =>
    generateId(IDPrefixes.PAYMENT) as EntityId<IDPrefixes.PAYMENT>;

export const generateRefundId = (): EntityId<IDPrefixes.REFUND> =>
    generateId(IDPrefixes.REFUND) as EntityId<IDPrefixes.REFUND>;

export const generateReversalId = (): EntityId<IDPrefixes.REVERSAL> =>
    generateId(IDPrefixes.REVERSAL) as EntityId<IDPrefixes.REVERSAL>;

export const generateKycId = (): EntityId<IDPrefixes.KYC> =>
    generateId(IDPrefixes.KYC) as EntityId<IDPrefixes.KYC>;

export const generateDocumentId = (): EntityId<IDPrefixes.KYC_DOCUMENT> =>
    generateId(IDPrefixes.KYC_DOCUMENT) as EntityId<IDPrefixes.KYC_DOCUMENT>;

export const generateNotificationId = (): EntityId<IDPrefixes.NOTIFICATION> =>
    generateId(IDPrefixes.NOTIFICATION) as EntityId<IDPrefixes.NOTIFICATION>;

export const generateEmailId = (): EntityId<IDPrefixes.EMAIL> =>
    generateId(IDPrefixes.EMAIL) as EntityId<IDPrefixes.EMAIL>;

export const generateSmsId = (): EntityId<IDPrefixes.SMS> =>
    generateId(IDPrefixes.SMS) as EntityId<IDPrefixes.SMS>;

export const generateAuditLogId = (): EntityId<IDPrefixes.AUDIT_LOG> =>
    generateId(IDPrefixes.AUDIT_LOG) as EntityId<IDPrefixes.AUDIT_LOG>;

export const generateBeneficiaryId = (): EntityId<IDPrefixes.BENEFICIARY> =>
    generateId(IDPrefixes.BENEFICIARY) as EntityId<IDPrefixes.BENEFICIARY>;

export const generateApiKeyId = (): EntityId<IDPrefixes.API_KEY> =>
    generateId(IDPrefixes.API_KEY) as EntityId<IDPrefixes.API_KEY>;

