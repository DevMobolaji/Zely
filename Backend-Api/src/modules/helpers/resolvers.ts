import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { ClientSession, Types } from "mongoose";
import { AccountDocument } from "../account/account.interface";
import { Account } from "../account/account.model";
import {
  LedgerAccount,
  LedgerAccountType,
  LedgerOwnerType,
} from "../ledger/ledger.account.model";
import vaultModel, { VaultDocument } from "../vault/vault.model";
import {
  IUser,
  Wallet,
  WalletDocument,
  WalletType,
} from "../wallet/wallet.model";

interface IWalletPopulated extends Omit<WalletDocument, "userId"> {
  userId: IUser;
}

export const lockAccountToPreventConcurrency = async (
  account: Types.ObjectId,
  session: ClientSession,
) => {
  const now = new Date();
  const lockTimeoutMs = 5000;
  const lockUntil = new Date(now.getTime() + lockTimeoutMs);

  const firstLock = await Account.findOneAndUpdate(
    {
      _id: account._id,
      $or: [{ locked: false }, { lockUntil: { $lte: now } }],
    },
    {
      $set: {
        locked: true,
        lockUntil,
      },
    },
    { session, new: true },
  );

  const secondLock = await Account.findOneAndUpdate(
    {
      _id: account._id,
      $or: [{ locked: false }, { lockUntil: { $lte: now } }],
    },
    {
      $set: {
        locked: true,
        lockUntil,
      },
    },
    { session, new: true },
  );

  return { firstLock, secondLock };
};

export const lockVaultToPreventConcurrency = async (
  vaultId: Types.ObjectId,
  session: ClientSession,
) => {
  const now = new Date();
  const lockExpiry = new Date(now.getTime() + 10_000); // 10s safety window

  const res = await vaultModel.findOneAndUpdate(
    {
      _id: vaultId._id,
      $or: [{ locked: false }, { lockedUntil: { $lt: now } }],
    },
    {
      $set: {
        locked: true,
        lockedUntil: lockExpiry,
      },
    },
    { session, new: true },
  );

  return res;
};

export const unlockVault = async (
  vaultId: Types.ObjectId,
  session: ClientSession,
) => {
  await vaultModel.updateOne(
    { _id: vaultId },
    { $set: { locked: false, lockUntil: null } },
    { session },
  );
};

export const lockWalletFunds = async (
  walletId: Types.ObjectId,
  amount: number,
  session: ClientSession,
): Promise<WalletDocument> => {
  const res = await Wallet.findOneAndUpdate(
    {
      _id: walletId,
      availableBalance: { $gte: amount },
    },
    {
      $inc: {
        availableBalance: -amount,
        lockedBalance: +amount,
        version: 1,
      },
    },
    { session, new: true },
  );

  if (!res) {
    throw new BadRequestError("Insufficient Balance");
  }

  return res;
};

export const deductWalletFunds = async (
  walletId: Types.ObjectId,
  amount: number,
  session: ClientSession,
): Promise<WalletDocument> => {
  const res = await Wallet.findOneAndUpdate(
    {
      _id: walletId,
      lockedBalance: { $gte: amount },
    },
    {
      $inc: { lockedBalance: -amount, version: 1 },
    },
    { new: true, session },
  );

  if (!res) {
    throw new BadRequestError("Insufficient Balance");
  }

  return res;
};

export const unlockWalletFunds = async (
  walletId: Types.ObjectId,
  currency: string,
  amount: number,
  session: ClientSession,
): Promise<WalletDocument> => {
  const wallet = await Wallet.findOne({ _id: walletId, currency }).session(
    session,
  );
  if (!wallet) throw new BadRequestError("Wallet not found");

  const res = await Wallet.findOneAndUpdate(
    { _id: wallet._id, lockedBalance: { $gte: amount } },
    { $inc: { availableBalance: amount, lockedBalance: -amount, version: 1 } },
    { new: true, session },
  ).session(session);

  if (!res) {
    throw new BadRequestError("INSUFFICIENT_BALANCE_UNLOCKING_WALLET");
  }

  return res;
};

export const lookUpAccounts = async (
  dto: { senderId: string; toAccountNumber: string },
  session: ClientSession,
) => {
  const senderAccount = await Account.findOne({
    userPublicId: dto.senderId,
    type: "MAIN_CHECKINGS",
    status: "ACTIVE",
  }).session(session);

  const receiverAccount = await Account.findOne({
    accountNumber: dto.toAccountNumber,
    type: "MAIN_CHECKINGS",
    status: "ACTIVE",
  }).session(session);

  if (!senderAccount) {
    throw new BadRequestError("Sender funding account not found");
  }

  if (!receiverAccount) throw new BadRequestError("Recipient not found");

  if (!senderAccount || !receiverAccount) {
    throw new BadRequestError("Invalid account number");
  }

  if (senderAccount._id.equals(receiverAccount._id)) {
    throw new BadRequestError(
      "Self transfers are not allowed!, use internal transfer instead",
    );
  }

  return { senderAccount, receiverAccount };
};

export const ensureWalletsAreActive = async (
  senderWalletId: Types.ObjectId,
  receiverWalletId: Types.ObjectId,
  session: ClientSession,
) => {
  const [senderWallet, receiverWallet] = await Promise.all([
    Wallet.findById(senderWalletId).session(session),
    Wallet.findById(receiverWalletId).session(session),
  ]);

  if (!receiverWallet || receiverWallet.status !== "ACTIVE") {
    throw new BadRequestError(
      `Wallet ${receiverWallet?.walletId} is frozen or inactive (Reason: ${receiverWallet?.freezeReason})`,
    );
  }

  if (!senderWallet || senderWallet.status !== "ACTIVE") {
    throw new BadRequestError(
      `Wallet ${senderWallet?.walletId} is frozen or inactive (Reason: ${senderWallet?.freezeReason})`,
    );
  }

  if (!senderWallet || !receiverWallet) {
    throw new NotFoundError("Sender or receiver wallet not found");
  }

  if (senderWallet.status !== "ACTIVE" || receiverWallet.status !== "ACTIVE") {
    throw new BadRequestError("Sender or receiver wallet is not active");
  }
};

export const lookUpLedgerAccountForAdmin = async (
  senderOwnerId: Types.ObjectId,
  senderOwnerType: LedgerOwnerType,
  receiverOwnerId: Types.ObjectId,
  receiverOwnerType: LedgerOwnerType,
  currency: string,
  session: ClientSession,
) => {
  const [senderLedger, receiverLedger] = await Promise.all([
    LedgerAccount.findOne({
      ownerId: senderOwnerId,
      ownerType: senderOwnerType,
      currency,
      type: LedgerAccountType.SYSTEM_TREASURY,
    }).session(session),

    LedgerAccount.findOne({
      ownerId: receiverOwnerId,
      ownerType: receiverOwnerType,
      currency,
      type: LedgerAccountType.MAIN_CHECKINGS,
    }).session(session),
  ]);

  if (!senderLedger || !receiverLedger) {
    throw new NotFoundError("Sender or receiver ledger not found");
  }

  return {
    senderLedgerId: senderLedger._id,
    receiverLedgerId: receiverLedger._id,
  };
};

export const lookUpLedgerAccountforP2P = async (
  senderOwnerId: Types.ObjectId,
  senderOwnerType: LedgerOwnerType,
  receiverOwnerId: Types.ObjectId,
  receiverOwnerType: LedgerOwnerType,
  currency: string,
  session: ClientSession,
) => {
  const [senderLedger, receiverLedger] = await Promise.all([
    LedgerAccount.findOne({
      ownerId: senderOwnerId,
      ownerType: senderOwnerType,
      currency,
      type: LedgerAccountType.MAIN_CHECKINGS,
    }).session(session),

    LedgerAccount.findOne({
      ownerId: receiverOwnerId,
      ownerType: receiverOwnerType,
      currency,
      type: LedgerAccountType.MAIN_CHECKINGS,
    }).session(session),
  ]);

  if (!senderLedger || !receiverLedger) {
    throw new NotFoundError("Sender or receiver ledger not found");
  }

  return {
    senderLedgerId: senderLedger._id,
    receiverLedgerId: receiverLedger._id,
  };
};

export const lookUpLedgerAccountForInternalTrx = async (
  senderLedgerId: Types.ObjectId,
  receiverLedgerId: Types.ObjectId,
  senderOwnerId: Types.ObjectId,
  receiverOwnerId: Types.ObjectId,
  fromType: string,
  toType: string,
  session: ClientSession,
) => {
  const [senderLedger, receiverLedger] = await Promise.all([
    LedgerAccount.findOne({
      _id: senderLedgerId,
      ownerId: senderOwnerId,
      type: fromType,
    }).session(session),

    LedgerAccount.findOne({
      _id: receiverLedgerId,
      ownerId: receiverOwnerId,
      type: toType,
    }).session(session),
  ]);

  if (!senderLedger || !receiverLedger) {
    throw new NotFoundError("Sender or receiver ledger not found");
  }

  return {
    senderLedgerId: senderLedger._id,
    receiverLedgerId: receiverLedger._id,
  };
};

export const LookUpVaultLedger = async (
  senderAccountId: Types.ObjectId,
  receiverAccountId: Types.ObjectId,
  fromType: string,
  session: ClientSession,
) => {
  const [senderLedger, receiverLedger] = await Promise.all([
    LedgerAccount.findOne({
      _id: senderAccountId,
      type: fromType,
    }).session(session),

    LedgerAccount.findOne({
      _id: receiverAccountId,
      type: LedgerAccountType.VAULT,
    }).session(session),
  ]);

  if (!senderLedger || !receiverLedger) {
    throw new NotFoundError("Sender or receiver ledger not found");
  }

  return {
    senderLedgerId: senderLedger._id,
    receiverLedgerId: receiverLedger._id,
  };
};

export const lookUpPrimaryWallets = async (
  walletId: Types.ObjectId,
  currency: string,
  session: ClientSession,
) => {
  const wallet = await Wallet.findOne({
    _id: walletId,
    type: WalletType.MAIN_CHECKINGS,
    currency,
  })
    .populate("userId", "email name -_id")
    .session(session);

  if (!wallet) {
    throw new BadRequestError("Primary wallet not found");
  }

  return wallet;
};

export const findWalletByType = async (
  walletId: Types.ObjectId,
  type: WalletType,
  currency: string,
  session: ClientSession,
) => {
  const wallet = await Wallet.findOne({
    _id: walletId,
    type,
    currency,
    status: "ACTIVE",
  })
    .populate("userId", "email name -_id")
    .session(session);

  if (!wallet) {
    throw new BadRequestError(`${type} wallet not found for ${currency}`);
  }

  return wallet;
};

export const resolveAccountByUserId = async (
  userId: string,
  type: string,
  currency: string,
  session: ClientSession,
): Promise<AccountDocument> => {
  const account = await Account.findOne({
    userPublicId: userId,
    type,
    currency,
  }).session(session);

  if (!account) throw new BadRequestError(`Account not found`);

  if (account.currency !== currency)
    throw new BadRequestError("Account currency does not match");

  return account;
};

export const resolveAccountByAccountNumber = async (
  accountNumber: string,
  type: string,
  currency: string,
  session: ClientSession,
): Promise<AccountDocument> => {
  const account = await Account.findOne({
    accountNumber,
    type,
    currency,
  }).session(session);

  if (!account)
    throw new BadRequestError(`Account not found for ${accountNumber}`);

  if (account.currency !== currency)
    throw new BadRequestError("Account currency does not match");

  return account;
};

export const resolveWallet = async (
  account: AccountDocument,
  session: ClientSession,
): Promise<IWalletPopulated> => {
  const wallet = (await Wallet.findOne({
    _id: account.walletId,
    currency: account.currency,
  })
    .populate("userId", "email name -_id")
    .session(session)) as IWalletPopulated;

  if (!wallet) throw new BadRequestError("Wallet not found");

  return wallet;
};

export const freezeWallet = async (
  walletId: string,
  reason: string,
  until: Date | null = null,
  session: ClientSession,
) => {
  const wallet = await Wallet.findById(walletId).session(session);

  if (!wallet) throw new BadRequestError("Wallet not found");

  await Wallet.updateOne(
    { walletId },
    { $set: { status: "FROZEN", freezeReason: reason, freezeUntil: until } },
  ).session(session);
};

export const unfreezeWallet = async (
  walletId: Types.ObjectId,
  session: ClientSession,
) => {
  const wallet = await Wallet.findById(walletId).session(session);

  if (!wallet) throw new BadRequestError("Wallet not found");

  await Wallet.updateOne(
    { _id: walletId },
    { $set: { status: "ACTIVE", freezeReason: "", freezeUntil: null } },
  ).session(session);
};

export const autoUnfreezeWallet = async (
  walletId: Types.ObjectId,
  session: ClientSession,
) => {
  const wallet = await Wallet.findById(walletId).session(session);

  if (!wallet) {
    throw new BadRequestError(`Wallet ${walletId} not found`);
  }

  // Only auto-unfreeze if wallet is frozen and freezeUntil has passed
  if (
    wallet.status === "FROZEN" &&
    wallet.freezeUntil &&
    wallet.freezeUntil <= new Date()
  ) {
    await Wallet.updateOne(
      { _id: walletId },
      {
        $set: { status: "ACTIVE" },
        $unset: { freezeReason: "", freezeUntil: "" },
      },
    ).session(session);
  }
};

export const lookupVaultLedger = async (
  vaultId: Types.ObjectId,
  session: ClientSession,
) => {
  const vault = await vaultModel.findById(vaultId).session(session);
  if (!vault) throw new BadRequestError("Vault not found");

  if (!vault.ledgerAccountId)
    throw new BadRequestError("Vault ledger not assigned");

  const receiverLedger = await LedgerAccount.findById(
    vault.ledgerAccountId,
  ).session(session);

  if (!receiverLedger) throw new BadRequestError("Reciever ledger not found");

  return receiverLedger;
};

//VAULT USAGE

export const mainWallet = async (
  userId: string,
  currency: string,
  type: string,
  session: ClientSession,
) => {
  const wallet = await Wallet.findOne({
    userPublicId: userId,
    type,
    currency,
  }).session(session);

  if (!wallet) throw new NotFoundError("Main wallet not found");

  if (wallet.status !== "ACTIVE") {
    throw new BadRequestError("Main wallet is not active");
  }

  return wallet;
};

export const findVault = async (
  vaultId: string,
  userId: string,
  currency: string,
  session: ClientSession,
): Promise<VaultDocument> => {
  const vault = await vaultModel
    .findOne({
      vaultId,
      currency,
      userPublicId: userId,
    })
    .populate("userId", "email name -_id")
    .session(session);

  if (!vault) {
    throw new NotFoundError(`vault not found for ${currency}`);
  }

  const canWithdraw =
    vault.status === "ACTIVE" ||
    (vault.status === "COMPLETED" && vault.lock.state === "MATURED");

  if (!canWithdraw) {
    throw new BadRequestError("Vault not active");
  }

  if (vault.currency !== currency) {
    throw new BadRequestError("Vault currenct mismatch");
  }

  return vault;
};
