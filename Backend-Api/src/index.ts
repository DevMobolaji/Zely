import 'dotenv/config';
import App from './infrastructure/app';
import AuthController from 'modules/auth/authcontroller';
import { config } from './config';
import TransferController from 'modules/transfer/transfer.controller';
import FundController from './modules/ledger/system ledger/system.funds.controller';

const app = new App([new AuthController(), new TransferController(), new FundController()], Number(config.app.port))


const start = async () => {
     await app.initialize(); 
     app.listen()
}

start().catch((err) => {
     console.error('Failed to start application:', err);
     process.exit(1);
});