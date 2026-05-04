import 'dotenv/config';
import App from './infrastructure/app';
import AuthController from 'modules/auth/authcontroller';
import { config } from './config';
import TransferController from 'modules/transfer/transfer.controller';
import FundController from './modules/ledger/system ledger/system.funds.controller';
import vaultController from './modules/vault/vault.controller';
import KycController from './modules/kyc/kyc.controller';
import ReconciliationController from './modules/reconciliation/reconciliation.controller';
import FundingController from './modules/fee/funding/funding.controller';
import WalletAdminController from './modules/wallet/wallet.contoller';

const app = new App([new AuthController(), new TransferController(), new FundController(), new vaultController(), new KycController(), new ReconciliationController(), new FundingController(), new WalletAdminController(),
], Number(config.app.port))


const start = async () => {
     await app.initialize();
     app.listen()
}

start().catch((err) => {
     console.error('Failed to start application:', err);
     process.exit(1);
});