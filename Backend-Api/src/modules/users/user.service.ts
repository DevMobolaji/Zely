import { IRequestContext } from "@/config/interfaces/request.interface";
import { Account, AccountType } from "@/modules/account/account.model";
import { accountStatus } from "@/modules/auth/authinterface";
import { NotFoundError } from "@/shared/errors/notFoundError";
import User from "@/modules/auth/authmodel";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import BadRequestError from "@/shared/errors/badRequest";
import { generateEventId } from "@/shared/utils/id.generator";

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
}

export default userService;
