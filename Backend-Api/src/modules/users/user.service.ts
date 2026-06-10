import { IRequestContext } from "@/config/interfaces/request.interface";
import redis from "@/infrastructure/cache/redis.cli";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import {
  UserBalanceSummaryModel,
  UserTransactionModel,
  UserWalletModel,
} from "@/kafka/projections/models/projectionModels";
import { Account, AccountType } from "@/modules/account/account.model";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { accountStatus } from "@/modules/auth/authinterface";
import User from "@/modules/auth/authmodel";
import { LedgerAccountType } from "@/modules/ledger/ledger.account.model";
import { Wallet } from "@/modules/wallet/wallet.model";
import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { generateEventId } from "@/shared/utils/id.generator";
import { logger } from "@/shared/utils/logger";

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
    // ─── Tier 1: Redis cache ───────────────────────────────────────────────
    const cacheKey = `balance:summary:${userPublicId}`;
    const cached = await redis.get(cacheKey);
    if (cached && typeof cached === "string") {
      return JSON.parse(cached);
    }

    logger.info("Dashboard summary cache miss, falling back to projection", {
      userPublicId,
    });

    // ─── Tier 2: Projection ───────────────────────────────────────────────
    const summary = await UserBalanceSummaryModel.findOne({
      userId: userPublicId,
    }).lean();

    if (summary) {
      const result = {
        totalBalance: summary.totalBalance,
        mainBalance: summary.mainBalance,
        savingsBalance: summary.savingsBalance,
        vaultBalance: summary.vaultBalance,
        totalDebit: summary.totalDebit,
        totalCredit: summary.totalCredit,
        currency: summary.currency,
      };

      await redis.set(cacheKey, JSON.stringify(result), 30);
      return result;
    }

    logger.warn(
      "UserBalanceSummary projection missing — falling back to source wallets",
      {
        userPublicId,
      },
    );

    const wallets = await Wallet.find({ userPublicId }).lean();

    const totalBalance = wallets.reduce(
      (sum: number, w: { availableBalance?: number }) =>
        sum + (w?.availableBalance ?? 0),
      0,
    );
    const mainBalance =
      wallets.find(
        (w: { type?: string }) => w.type === LedgerAccountType.MAIN_CHECKINGS,
      )?.availableBalance ?? 0;
    const savingsBalance =
      wallets.find(
        (w: { type?: string }) => w.type === LedgerAccountType.SAVINGS,
      )?.availableBalance ?? 0;
    const vaultBalance = wallets
      .filter((w: { type?: string }) => w.type === LedgerAccountType.VAULT)
      .reduce(
        (sum: number, w: { availableBalance?: number }) =>
          sum + (w?.availableBalance ?? 0),
        0,
      );

    return {
      totalBalance,
      mainBalance,
      savingsBalance,
      vaultBalance,
      totalDebit: summary?.totalDebit ?? 0,
      totalCredit: summary?.totalCredit ?? 0,
      currency: "NGN",
      isLive: true,
    };
  };

  public getWallets = async (userPublicId: string) => {
    // ─── Shared data needed for all tiers ─────────────────────────────────
    const [accounts, transactionTotals] = await Promise.all([
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

    const getTotals = (walletType: string) => ({
      totalCredit:
        transactionTotals.find(
          (t) =>
            t._id.walletType === walletType && t._id.direction === "credit",
        )?.total ?? 0,
      totalDebit:
        transactionTotals.find(
          (t) => t._id.walletType === walletType && t._id.direction === "debit",
        )?.total ?? 0,
    });

    // ─── Tier 1: Redis cache ───────────────────────────────────────────────
    const cacheKey = `wallets:${userPublicId}`;
    const cached = await redis.get(cacheKey);
    if (cached && typeof cached === "string") {
      return JSON.parse(cached);
    }

    // ─── Tier 2: Projection + version check ───────────────────────────────
    const [projections, sourceWallets] = await Promise.all([
      UserWalletModel.find({ userId: userPublicId }).lean(),
      Wallet.find({ userPublicId }).lean(),
    ]);

    if (projections.length > 0) {
      // Check each projection against source of truth version
      const allFresh = projections.every((proj) => {
        const source = sourceWallets.find((w) => w.walletId === proj.walletId);
        return source && proj.version === source.version;
      });

      if (allFresh) {
        const result = projections.map((w) => {
          const account = accounts.find((a) => a.type === w.walletType);
          return {
            walletId: w.walletId,
            walletType: w.walletType,
            balance: w.balance,
            currency: w.currency,
            status: w.status,
            limit: w.limit,
            accountNumber: account?.accountNumber ?? null,
            ...getTotals(w.walletType),
          };
        });

        // Cache for 30 seconds
        await redis.set(cacheKey, JSON.stringify(result), 30);
        return result;
      }

      // Projection stale — log and fall through to Tier 3
      logger.warn("Wallet projection stale — falling back to source of truth", {
        userPublicId,
      });
    }

    // ─── Tier 3: Source of truth ───────────────────────────────────────────
    logger.warn("Wallet projection empty or stale — serving live data", {
      userPublicId,
    });

    const result = sourceWallets.map((w) => {
      const account = accounts.find((a) => a.type === w.type);
      return {
        walletId: w.walletId,
        walletType: w.type,
        balance: w.availableBalance,
        currency: w.currency,
        status: w.status,
        accountNumber: account?.accountNumber ?? null,
        ...getTotals(w.type),
      };
    });

    // Fire background projection refresh — don't await
    this.refreshWalletProjections(userPublicId, sourceWallets).catch((err) => {
      logger.error("Background wallet projection refresh failed", {
        userPublicId,
        error: err.message,
      });
    });

    return result;
  };

  // ─── Background projection refresh ──────────────────────────────────────
  private refreshWalletProjections = async (
    userPublicId: string,
    sourceWallets: any[],
  ) => {
    await UserWalletModel.bulkWrite(
      sourceWallets.map((w) => ({
        updateOne: {
          filter: { walletId: w.walletId },
          update: {
            $set: {
              walletId: w.walletId,
              userId: userPublicId,
              walletType: w.type,
              currency: w.currency,
              balance: w.availableBalance,
              status: w.status,
              version: w.version,
            },
          },
          upsert: true,
        },
      })),
    );

    // Invalidate cache so next request gets fresh projection
    await redis.delete(`wallets:${userPublicId}`);

    logger.info("Wallet projections refreshed in background", { userPublicId });
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

    // Add to the filter
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
        transactionId: t.transactionRef ?? t.eventId, // ← use eventId as transactionId
        direction: t.direction,
        amount: t.amount,
        currency: t.currency,
        walletType: t.walletType,
        status: t.status,
        referenceId: t.referenceId,
        category: t.category,
        counterpartyName: t.counterpartyName,
        counterpartyWalletType: t.counterpartyWalletType,
        name: t.name,
        fee: t.fee,
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
