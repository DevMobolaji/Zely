import { IRequestContext } from "@/config/interfaces/request.interface";
import { Account, AccountType } from "@/modules/account/account.model";
import { accountStatus } from "@/modules/auth/authinterface";
import { NotFoundError } from "@/shared/errors/notFoundError";
import User from "@/modules/auth/authmodel";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import BadRequestError from "@/shared/errors/badRequest";
import { generateEventId } from "@/shared/utils/id.generator";
import {
  UserBalanceSummaryModel,
  UserTransactionModel,
  UserWalletModel,
} from "@/kafka/projections/models/projectionModels";

class userService {
  private userModel = User;

  public getProvisioningStatus = async (
    userSub: string,
    context: IRequestContext,
  ) => {
    const user = await this.userModel
      .findById(userSub)
      .select("accountStatus userId")
      .lean();

    if (!user) {
      throw new NotFoundError("USER_NOT_FOUND");
    }

    // Not ready yet — return current status
    if (user.accountStatus === accountStatus.PROVISIONING_FAILED) {
      return {
        ok: false,
        status: user.accountStatus,
        ready: false,
        failed: true,
        message: "ACCOUNT_PROVISIONING_FAILED",
      };
    }

    if (user.accountStatus !== accountStatus.ACCOUNT_READY) {
      return {
        ok: true,
        status: user.accountStatus,
        ready: false,
        failed: false,
      };
    }

    // Ready — fetch accounts
    const accounts = await Account.find({
      userPublicId: user.userId,
      status: "ACTIVE",
    })
      .select("accountNumber type")
      .lean();

    const checkingAccount = accounts.find(
      (a) => a.type === AccountType.MAIN_CHECKINGS,
    );
    const savingsAccount = accounts.find((a) => a.type === AccountType.SAVINGS);

    return {
      ok: true,
      status: accountStatus.ACCOUNT_READY,
      ready: true,
      accounts: {
        checking: checkingAccount?.accountNumber ?? null,
        savings: savingsAccount?.accountNumber ?? null,
      },
    };
  };

  public retryProvisioning = async (
    userSub: string,
    context: IRequestContext,
  ) => {
    const MAX_PROVISIONING_RETRIES = 3;
    const RETRY_COOLDOWN_MS = 60 * 1000; // 1 minute between retries

    const user = await User.findById(userSub)
      .select(
        "accountStatus userId email name provisioningRetryCount lastProvisioningRetryAt",
      )
      .lean();

    if (!user) {
      throw new NotFoundError("USER_NOT_FOUND");
    }

    if (user.accountStatus === accountStatus.ACCOUNT_READY) {
      return { ok: true, message: "ALREADY_PROVISIONED" };
    }

    // Only allow retry from stuck states
    const retryableStatuses = [
      accountStatus.ACCOUNT_PROVISIONING,
      accountStatus.PROVISIONING_FAILED,
      accountStatus.EMAIL_VERIFIED,
    ];

    if (!retryableStatuses.includes(user.accountStatus)) {
      throw new BadRequestError(
        `CANNOT_RETRY_FROM_STATUS_${user.accountStatus}`,
      );
    }

    // Retry cap
    const provisioningRetryCount = (user as any).provisioningRetryCount ?? 0;
    if (provisioningRetryCount >= MAX_PROVISIONING_RETRIES) {
      throw new BadRequestError("MAX_PROVISIONING_RETRIES_EXCEEDED");
    }

    // Cooldown — prevent hammering
    const lastProvisioningRetryAt = (user as any).lastProvisioningRetryAt as
      | Date
      | undefined;
    if (lastProvisioningRetryAt) {
      const elapsed = Date.now() - lastProvisioningRetryAt.getTime();
      if (elapsed < RETRY_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((RETRY_COOLDOWN_MS - elapsed) / 1000);
        throw new BadRequestError(`RETRY_TOO_SOON_WAIT_${waitSeconds}_SECONDS`);
      }
    }

    // Reset status and increment retry counter atomically (use userSub as id)
    await User.updateOne(
      { _id: userSub },
      {
        $set: {
          accountStatus: accountStatus.EMAIL_VERIFIED,
          lastProvisioningRetryAt: new Date(),
        },
        $inc: { provisioningRetryCount: 1 },
      },
    );

    // Re-emit the event that triggers provisioning
    await emitOutboxEvent({
      topic: "auth.events",
      eventId: generateEventId(),
      eventType: "USER_VERIFY_EMAIL_SUCCESS",
      action: AuditAction.ACCOUNT_PROVISIONING,
      status: AuditStatus.PENDING,
      payload: {
        userId: user.userId,
        email: user.email,
        name: user.name,
      },
      aggregateType: "USER",
      aggregateId: user.userId,
      version: 1,
      context,
    });

    return { ok: true, message: "PROVISIONING_RETRIGGERED" };
  };

  public getDashboardSummary = async (userPublicId: string) => {
    const summary = await UserBalanceSummaryModel.findOne({
      userId: userPublicId,
    }).lean();

    if (!summary) {
      return {
        totalBalance: 0,
        mainBalance: 0,
        savingsBalance: 0,
        vaultBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        currency: "NGN",
      };
    }

    return {
      totalBalance: summary.totalBalance,
      mainBalance: summary.mainBalance,
      savingsBalance: summary.savingsBalance,
      vaultBalance: summary.vaultBalance,
      totalDebit: summary.totalDebit,
      totalCredit: summary.totalCredit,
      currency: summary.currency,
    };
  };

  public getWallets = async (userPublicId: string) => {
    const [wallets, accounts, transactionTotals] = await Promise.all([
      UserWalletModel.find({ userId: userPublicId }).lean(),
      Account.find({ userPublicId, status: "ACTIVE" })
        .select("accountNumber type")
        .lean(),
      UserTransactionModel.aggregate([
        { $match: { userId: userPublicId } },
        {
          $group: {
            _id: { walletType: "$walletType", direction: "$direction" },
            total: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    return wallets.map((w) => {
      const account = accounts.find((a) => a.type === w.walletType);

      const credit =
        transactionTotals.find(
          (t) =>
            t._id.walletType === w.walletType && t._id.direction === "credit",
        )?.total ?? 0;

      const debit =
        transactionTotals.find(
          (t) =>
            t._id.walletType === w.walletType && t._id.direction === "debit",
        )?.total ?? 0;

      return {
        walletId: w.walletId,
        walletType: w.walletType,
        balance: w.balance,
        currency: w.currency,
        status: w.status,
        accountNumber: account?.accountNumber ?? null,
        totalCredit: credit,
        totalDebit: debit,
      };
    });
  };

  public getTransactions = async (
    userPublicId: string,
    query: {
      limit?: number;
      page?: number;
      direction?: "debit" | "credit";
      walletType?: string;
      status?: string;
    },
  ) => {
    const limit = Math.min(query.limit ?? 20, 100);
    const page = query.page ?? 1;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { userId: userPublicId };

    if (query.direction) filter.direction = query.direction;
    if (query.walletType) filter.walletType = query.walletType;
    if (query.status) filter.status = query.status;

    const [transactions, total] = await Promise.all([
      UserTransactionModel.find(filter)
        .sort({ occurredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserTransactionModel.countDocuments(filter),
    ]);

    return {
      transactions: transactions.map((t) => ({
        transactionId: t.transactionId,
        direction: t.direction,
        amount: t.amount,
        currency: t.currency,
        walletType: t.walletType,
        status: t.status,
        category: t.category,
        counterpartyUserId: t.counterpartyUserId,
        name: t.name,
        occurredAt: t.occurredAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  };
}

export default userService;
