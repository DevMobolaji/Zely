import { ClientSession, Types } from "mongoose";
import { LedgerAccount, LedgerAccountType } from "../ledger/ledgerAccount.model";
import BadRequestError from "@/shared/errors/badRequest";
import { IUser, Wallet, WalletDocument, WalletType } from "../wallet/wallet.model";
import { Account } from "../account/account.model";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { AccountDocument } from "../account/account.interface";

interface IWalletPopulated extends Omit<WalletDocument, 'userId'> {
  userId: IUser;
}

export const lockAccountToPreventConcurrency = async (account: Types.ObjectId, session: ClientSession) => {
  const now = new Date();
  const lockTimeoutMs = 5000;
  const lockUntil = new Date(now.getTime() + lockTimeoutMs);

  const firstLock = await Account.findOneAndUpdate({
    _id: account._id,
    $or: [
      { locked: false },
      { lockUntil: { $lte: now } }
    ]
  }, {
    $set: {
      locked: true,
      lockUntil
    }
  }, { session, new: true })

  const secondLock = await Account.findOneAndUpdate({
    _id: account._id,
    $or: [
      { locked: false },
      { lockUntil: { $lte: now } }
    ]
  }, {
    $set: {
      locked: true,
      lockUntil
    },
  }, { session, new: true })

  return { firstLock, secondLock }
}

export const lockWalletFunds = async (
  walletId: Types.ObjectId,
  amount: number,
  session: ClientSession
) => {
  const res = await Wallet.findOneAndUpdate(
    {
      _id: walletId,
      availableBalance: { $gte: amount }
    },
    {
      $inc: {
        availableBalance: -amount,
        lockedBalance: +amount
      }
    },
    { session, new: true }
  );

  if (!res) {
    throw new BadRequestError('insufficient balance');
  }

  return res;
};



export const deductWalletFunds = async (walletId: Types.ObjectId, amount: number, session: ClientSession) => {

  const res = await Wallet.findOneAndUpdate({
    _id: walletId, availableBalance: { $gte: amount },
  }, {
    $inc: { lockedBalance: -amount },
  }, { new: true, session })

  if (!res) {
    throw new BadRequestError("Insufficient balance");
  }

  return res;
}

const unlockWalletFunds = async (walletId: Types.ObjectId, currency: string, amount: number, session: ClientSession) => {
  const wallet = await Wallet.findOne({ _id: walletId, currency }).session(session);
  if (!wallet) throw new BadRequestError("Wallet not found");

  const res = await Wallet.findOneAndUpdate(
    { _id: wallet._id, lockedBalance: { $gte: amount } },
    { $inc: { availableBalance: amount, lockedBalance: -amount } },
    { new: true, session }
  ).session(session);

  if (!res) {
    throw new BadRequestError("Insufficient balance");
  }

  return res;
}

export const lookUpAccounts = async (dto: { senderId: string; toAccountNumber: string; }, session: ClientSession) => {

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
    throw new BadRequestError('Invalid account number');
  }

    if (senderAccount._id.equals(receiverAccount._id)) {
      throw new BadRequestError('Self transfers are not allowed!, use internal transfer instead',);
     }

  return { senderAccount, receiverAccount }
}

export const ensureWalletsAreActive = async (senderWalletId: Types.ObjectId, receiverWalletId: Types.ObjectId, session: ClientSession) => {
  const [senderWallet, receiverWallet] = await Promise.all([
    Wallet.findById(senderWalletId).session(session),
    Wallet.findById(receiverWalletId).session(session)
  ]);

  if (!receiverWallet || receiverWallet.status !== 'ACTIVE') {
    throw new BadRequestError(
      `Wallet ${receiverWallet?.walletId} is frozen or inactive (Reason: ${receiverWallet?.freezeReason})`
    );
  }

  if (!senderWallet || senderWallet.status !== 'ACTIVE') {
    throw new BadRequestError(
      `Wallet ${senderWallet?.walletId} is frozen or inactive (Reason: ${senderWallet?.freezeReason})`
    );
  }

  if (!senderWallet || !receiverWallet) {
    throw new NotFoundError('Sender or receiver wallet not found');
  }

  if (senderWallet.status !== 'ACTIVE' || receiverWallet.status !== 'ACTIVE') {
    throw new BadRequestError('Sender or receiver wallet is not active');
  }
}

export const lookUpLedgerAccount = async (senderWalletId: Types.ObjectId, receiverWalletId: Types.ObjectId, session: ClientSession) => {

  const [senderLedger, receiverLedger] = await Promise.all([
    LedgerAccount.findOne({
      walletId: senderWalletId,
      type: LedgerAccountType.MAIN_CHECKINGS
    }).session(session),

    LedgerAccount.findOne({
      walletId: receiverWalletId,
      type: LedgerAccountType.MAIN_CHECKINGS
    }).session(session)
  ]);

  if (!senderLedger || !receiverLedger) {
    throw new NotFoundError("Sender or receiver ledger not found");
  }

  return { senderLedgerId: senderLedger._id, receiverLedgerId: receiverLedger._id }
}

export const lookUpLedgerAccountByWalletId = async (senderWalletId: Types.ObjectId, receiverWalletId: Types.ObjectId, fromType: string, toType: string, session: ClientSession) => {

  const [senderLedger, receiverLedger] = await Promise.all([
    LedgerAccount.findOne({
      walletId: senderWalletId,
      type: fromType
    }).session(session),

    LedgerAccount.findOne({
      walletId: receiverWalletId,
      type: toType
    }).session(session)
  ]);

  if (!senderLedger || !receiverLedger) {
    throw new NotFoundError("Sender or receiver ledger not found");
  }

  return { senderLedgerId: senderLedger._id, receiverLedgerId: receiverLedger._id }
}

export const lookUpPrimaryWallets = async (
  walletId: Types.ObjectId,
  currency: string,
  session: ClientSession

) => {
  const wallet = await Wallet.findOne({
    _id: walletId,
    type: WalletType.MAIN_CHECKINGS,
    currency,
  }).session(session);

  if (!wallet) {
    throw new BadRequestError('Primary wallet not found');
  }

  return wallet;
}


export const findWalletByType = async (
  walletId: Types.ObjectId,
  type: WalletType,
  currency: string,
  session: ClientSession
) => {
  const wallet = await Wallet.findOne({
    _id: walletId,
    type,
    currency,
    status: 'ACTIVE',
  })
  .populate('userId', 'email name -_id')
  .session(session);

  if (!wallet) {
    throw new BadRequestError(
      `${type} wallet not found for ${currency}`
    );
  }

  return wallet;
};


export const resolveAccountByUserId = async (userId: string, type: string, currency: string, session: ClientSession): Promise<AccountDocument> => {
  const account = await Account.findOne({
    userPublicId: userId,
    type,
    currency,
  }).session(session);

  if (!account) throw new BadRequestError(`Account not found`);


  if (account.currency !== currency) throw new BadRequestError("Account currency does not match");

  return account
}

export const resolveAccountByAccountNumber = async (accountNumber: string, type: string, currency: string, session: ClientSession): Promise<AccountDocument> => {
  const account = await Account.findOne({
    accountNumber,
    type,
    currency,
  }).session(session);
  console.log("Account found", account);


  if (!account) throw new BadRequestError(`Account not found for ${accountNumber}`);

  if (account.currency !== currency) throw new BadRequestError("Account currency does not match");

  return account
}


export const resolveWallet = async (
  account: AccountDocument,
  session: ClientSession
): Promise<IWalletPopulated> => {
  const wallet = await Wallet.findOne({
    _id: account.walletId,
    currency: account.currency,
  })
    .populate('userId', 'email name -_id')
    .session(session) as IWalletPopulated;

  if (!wallet) throw new BadRequestError('Wallet not found');

  return wallet;
};

export const freezeWallet = async (walletId: string,
  reason: string, until: Date | null = null, session: ClientSession) => {
  const wallet = await Wallet.findById(walletId).session(session);

  if (!wallet) throw new BadRequestError('Wallet not found');

  await Wallet.updateOne({ walletId }, { $set: { status: 'FROZEN', freezeReason: reason, freezeUntil: until } }).session(session);
}


export const unfreezeWallet = async (walletId: Types.ObjectId, session: ClientSession) => {
  const wallet = await Wallet.findById(walletId).session(session);

  if (!wallet) throw new BadRequestError('Wallet not found');

  await Wallet.updateOne({ _id: walletId }, { $set: { status: 'ACTIVE', freezeReason: "", freezeUntil: null } }).session(session);
}

export const autoUnfreezeWallet = async (
  walletId: Types.ObjectId,
  session: ClientSession
) => {
  const wallet = await Wallet.findById(walletId).session(session);

  if (!wallet) {
    throw new BadRequestError(`Wallet ${walletId} not found`);
  }

  // Only auto-unfreeze if wallet is frozen and freezeUntil has passed
  if (wallet.status === 'FROZEN' && wallet.freezeUntil && wallet.freezeUntil <= new Date()) {
    await Wallet.updateOne(
      { _id: walletId },
      { $set: { status: 'ACTIVE' }, $unset: { freezeReason: "", freezeUntil: "" } }
    ).session(session);
  }
}
