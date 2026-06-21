import NotificationController from "@/modules/notification/notification.controller";
import { SessionController } from "@/modules/sessions/sesssion.controller";
import UserController from "@/modules/users/user.controller";
import "dotenv/config";
import AuthController from "modules/auth/authcontroller";
import TransferController from "modules/transfer/transfer.controller";
import { config } from "./config";
import App from "./infrastructure/app";
import FundingController from "./modules/fee/funding/funding.controller";
import KycController from "./modules/kyc/kyc.controller";
import FundController from "./modules/ledger/system ledger/system.funds.controller";
import PaymentController from "./modules/payments/payment.controller";
import WebhookController from "./modules/payments/webhook.controller";
import ReconciliationController from "./modules/reconciliation/reconciliation.controller";
import vaultController from "./modules/vault/vault.controller";
import WalletAdminController from "./modules/wallet/wallet.contoller";

let isReady = false;

const app = new App(
  [
    new AuthController(),
    new TransferController(),
    new FundController(),
    new vaultController(),
    new KycController(),
    new ReconciliationController(),
    new FundingController(),
    new WalletAdminController(),
    new PaymentController(),
    new WebhookController(),
    new UserController(),
    new NotificationController(),
    new SessionController(),
  ],
  Number(config.app.port),
);

const start = async () => {
  app.listen();

  await app.initialize();

  isReady = true;
};

start().catch((err) => {
  console.error("Failed to start application:", err);
  process.exit(1);
});
