import { IRequestContext } from "@/config/interfaces/request.interface";
import { Account, AccountType } from "@/modules/account/account.model";
import { accountStatus } from "@/modules/auth/authinterface";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { NextFunction } from "express";
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
    if (user.accountStatus !== accountStatus.ACCOUNT_READY) {
      return {
        ok: true,
        status: user.accountStatus,
        ready: false,
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
    const user = await User.findById(userSub)
      .select("accountStatus userId email name")
      .lean();

    if (!user) {
      throw new NotFoundError("USER_NOT_FOUND");
    }

    // Only retry if stuck in ACCOUNT_PROVISIONING
    if (user.accountStatus === accountStatus.ACCOUNT_READY) {
      return { ok: true, message: "ALREADY_PROVISIONED" };
    }

    if (
      user.accountStatus !== accountStatus.ACCOUNT_PROVISIONING &&
      user.accountStatus !== accountStatus.EMAIL_VERIFIED
    ) {
      throw new BadRequestError(
        `CANNOT_RETRY_FROM_STATUS_${user.accountStatus}`,
      );
    }

    // Reset to EMAIL_VERIFIED so consumer can pick it up again
    await User.updateOne(
      { _id: user._id },
      { $set: { accountStatus: accountStatus.EMAIL_VERIFIED } },
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
