// src/modules/kyc/kyc.service.ts
import mongoose, { Types } from "mongoose";
import {
  KycSubmission,
  KycSubmissionDocument,
  KycSubmissionStatus,
} from "./kyc.model";
import { KycTier } from "../transactionLimit/transaction.limit.model";
import User from "@/modules/auth/authmodel"
import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { generateEventId } from "@/shared/utils/id.generator";
import { logger } from "@/shared/utils/logger";
import { getActiveKycVerifier } from "./kyc.verifier.factory";

class KycService {
  private userModel = User;
  private verifier = getActiveKycVerifier();

  public async submitForTier2(
    userPublicId: string,
    payload: any,
    context: IRequestContext
  ) {
    const user = await this.userModel.findOne({ userId: userPublicId });
    if (!user) throw new NotFoundError("USER_NOT_FOUND");

    if (user.kycTier === KycTier.TIER_2 || user.kycTier === KycTier.TIER_3) {
      throw new BadRequestError("ALREADY_AT_TIER_2_OR_HIGHER");
    }

    // Block if user already has a pending submission
    const existing = await KycSubmission.findOne({
      userPublicId,
      status: KycSubmissionStatus.PENDING_REVIEW,
    }).lean();
    if (existing) {
      throw new BadRequestError("PENDING_SUBMISSION_ALREADY_EXISTS");
    }

    //we need to test this uniqueness
    // BVN uniqueness — must not be linked to another approved user
    const bvnTaken = await KycSubmission.findOne({
      bvn: payload.bvn,
      status: { $in: [KycSubmissionStatus.APPROVED, KycSubmissionStatus.AUTO_APPROVED] },
      userPublicId: { $ne: userPublicId },
    });

    if (bvnTaken) throw new BadRequestError("BVN_ALREADY_LINKED_TO_ANOTHER_USER");

    const session = await mongoose.startSession();
    session.startTransaction();
    let submission: KycSubmissionDocument;

    try {
      const [created] = await KycSubmission.create(
        [
          {
            userId: user._id,
            userPublicId,
            targetTier: KycTier.TIER_2,
            status: KycSubmissionStatus.PENDING_REVIEW,
            bvn: payload.bvn,
            nin: payload.nin,
            dateOfBirth: new Date(payload.dateOfBirth),
            governmentId: payload.governmentId,
            address: payload.address,
            providerName: this.verifier.providerName,
            submittedAt: new Date(),
          },
        ],
        { session }
      );
      submission = created;

      await emitOutboxEvent(
        {
          topic: "kyc.events",
          eventId: generateEventId(),
          eventType: AuditAction.KYC_SUBMITTED,
          action: AuditAction.KYC_SUBMITTED,
          status: AuditStatus.PENDING,
          payload: {
            userId: user.userId,
            email: user.email,
            name: user.name,
            targetTier: KycTier.TIER_2,
            submissionId: submission._id.toString(),
          },
          aggregateType: "KYC",
          aggregateId: submission._id.toString(),
          version: 1,
          context,
        },
        { session }
      );

      await session.commitTransaction();
    } catch (e) {
      if (session.inTransaction()) await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }

    // Run verifier AFTER commit — keeps the DB transaction fast
    await this.runVerification(submission!, context);

    return {
      submissionId: submission!._id.toString(),
      status: submission!.status,
      targetTier: submission!.targetTier,
      submittedAt: submission!.submittedAt,
    };
  }

  public async submitForTier3(
    userPublicId: string,
    payload: any,
    context: IRequestContext
  ) {
    const user = await this.userModel.findOne({ userId: userPublicId });
    if (!user) throw new NotFoundError("USER_NOT_FOUND");

    if (user.kycTier !== KycTier.TIER_2) {
      throw new BadRequestError("MUST_BE_TIER_2_BEFORE_UPGRADING_TO_TIER_3");
    }

    const existing = await KycSubmission.findOne({
      userPublicId,
      status: KycSubmissionStatus.PENDING_REVIEW,
    });
    if (existing) throw new BadRequestError("PENDING_SUBMISSION_ALREADY_EXISTS");

    const session = await mongoose.startSession();
    session.startTransaction();
    let submission: KycSubmissionDocument;

    try {
      const [created] = await KycSubmission.create(
        [
          {
            userId: user._id,
            userPublicId,
            targetTier: KycTier.TIER_3,
            status: KycSubmissionStatus.PENDING_REVIEW,
            selfieUrl: payload.selfieUrl,
            livenessVideoUrl: payload.livenessVideoUrl,
            providerName: this.verifier.providerName,
            submittedAt: new Date(),
          },
        ],
        { session }
      );
      submission = created;

      await emitOutboxEvent(
        {
          topic: "kyc.events",
          eventId: generateEventId(),
          eventType: AuditAction.KYC_SUBMITTED,
          action: AuditAction.KYC_SUBMITTED,
          status: AuditStatus.PENDING,
          payload: {
            userId: user.userId,
            email: user.email,
            name: user.name,
            targetTier: KycTier.TIER_3,
            submissionId: submission._id.toString(),
          },
          aggregateType: "KYC",
          aggregateId: submission._id.toString(),
          version: 1,
          context,
        },
        { session }
      );

      await session.commitTransaction();
    } catch (e) {
      if (session.inTransaction()) await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }

    await this.runVerification(submission!, context);

    return {
      submissionId: submission!._id.toString(),
      status: submission!.status,
      targetTier: submission!.targetTier,
      submittedAt: submission!.submittedAt,
    };
  }

  public async getMyStatus(userPublicId: string) {
    const user = await this.userModel.findOne({ userId: userPublicId });
    if (!user) throw new NotFoundError("USER_NOT_FOUND");

    const pending = await KycSubmission.findOne({
      userPublicId,
      status: KycSubmissionStatus.PENDING_REVIEW,
    }).lean();

    const lastSubmission = await KycSubmission.findOne({ userPublicId })
      .sort({ createdAt: -1 })
      .lean();

    return {
      currentTier: user.kycTier,
      pendingSubmission: pending
        ? {
          id: pending._id.toString(),
          targetTier: pending.targetTier,
          status: pending.status,
          submittedAt: pending.submittedAt,
        }
        : null,
      lastRejection:
        lastSubmission?.status === KycSubmissionStatus.REJECTED ||
          lastSubmission?.status === KycSubmissionStatus.AUTO_REJECTED
          ? {
            id: lastSubmission._id.toString(),
            targetTier: lastSubmission.targetTier,
            reason: lastSubmission.rejectionReason,
            reviewedAt: lastSubmission.reviewedAt,
          }
          : null,
    };
  }

  // ─── Admin endpoints ──────────────────────────────────────────────────────

  public async listPending() {
    return KycSubmission.find({ status: KycSubmissionStatus.PENDING_REVIEW })
      .sort({ submittedAt: 1 })
      .lean();
  }

  public async getSubmissionById(submissionId: string) {
    const submission = await KycSubmission.findById(submissionId).lean();
    if (!submission) throw new NotFoundError("SUBMISSION_NOT_FOUND");
    return submission;
  }

  public async adminApprove(
    submissionId: string,
    adminUserId: string,
    context: IRequestContext
  ) {
    return this.finalizeApproval({
      submissionId,
      reviewedBy: adminUserId,
      finalStatus: KycSubmissionStatus.APPROVED,
      context,
    });
  }

  public async adminReject(
    submissionId: string,
    adminUserId: string,
    reason: string,
    context: IRequestContext
  ) {
    return this.finalizeRejection({
      submissionId,
      reviewedBy: adminUserId,
      finalStatus: KycSubmissionStatus.REJECTED,
      reason,
      context,
    });
  }

  // ─── Internal: Run verifier and dispatch ──────────────────────────────────

  private async runVerification(
    submission: KycSubmissionDocument,
    context: IRequestContext
  ): Promise<void> {
    let result;
    try {
      result =
        submission.targetTier === KycTier.TIER_2
          ? await this.verifier.verifyTier2(submission)
          : await this.verifier.verifyTier3(submission);
    } catch (err) {
      logger.error("KYC verifier threw — falling back to manual review", { err });
      result = { status: "MANUAL_REVIEW_REQUIRED" as const };
    }

    if (result.status === "AUTO_APPROVED") {
      await this.finalizeApproval({
        submissionId: submission._id.toString(),
        reviewedBy: null,
        finalStatus: KycSubmissionStatus.AUTO_APPROVED,
        providerReference: result.providerReference,
        rawResponse: result.rawResponse,
        context,
      });
    } else if (result.status === "AUTO_REJECTED") {
      await this.finalizeRejection({
        submissionId: submission._id.toString(),
        reviewedBy: null,
        finalStatus: KycSubmissionStatus.AUTO_REJECTED,
        reason: result.reason ?? "AUTO_REJECTED_BY_PROVIDER",
        providerReference: result.providerReference,
        rawResponse: result.rawResponse,
        context,
      });
    }
    // MANUAL_REVIEW_REQUIRED — leave as PENDING_REVIEW, admin handles
  }

  // ─── Internal: Approve (auto or manual) ──────────────────────────────────

  private async finalizeApproval(opts: {
    submissionId: string;
    reviewedBy: string | null;
    finalStatus: KycSubmissionStatus;
    providerReference?: string;
    rawResponse?: any;
    context: IRequestContext;
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const submission = await KycSubmission.findById(opts.submissionId).session(session);
      if (!submission) throw new NotFoundError("SUBMISSION_NOT_FOUND");

      if (submission.status !== KycSubmissionStatus.PENDING_REVIEW) {
        throw new BadRequestError("SUBMISSION_ALREADY_PROCESSED");
      }

      submission.status = opts.finalStatus;
      submission.reviewedBy = opts.reviewedBy
        ? mongoose.Types.ObjectId.createFromHexString(opts.reviewedBy) as any
        : undefined;
      submission.reviewedAt = new Date();
      if (opts.providerReference) submission.providerReference = opts.providerReference;
      if (opts.rawResponse) submission.providerRawResponse = opts.rawResponse;
      await submission.save({ session });

      // Update user's kycTier
      const user = await this.userModel.findByIdAndUpdate(
        submission.userId,
        { $set: { kycTier: submission.targetTier } },
        { session, new: true }
      );

      if (!user) throw new NotFoundError("USER_NOT_FOUND");

      await emitOutboxEvent(
        {
          topic: "kyc.events",
          eventId: generateEventId(),
          eventType: AuditAction.KYC_APPROVED,
          action: AuditAction.KYC_APPROVED,
          status: AuditStatus.PENDING,
          payload: {
            userId: user.userId,
            email: user.email,
            name: user.name,
            newTier: submission.targetTier,
            submissionId: submission._id.toString(),
            autoApproved: opts.finalStatus === KycSubmissionStatus.AUTO_APPROVED,
          },
          aggregateType: "KYC",
          aggregateId: submission._id.toString(),
          version: 1,
          context: opts.context,
        },
        { session }
      );

      await session.commitTransaction();
      return submission.toJSON();
    } catch (e) {
      if (session.inTransaction()) await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  }

  // ─── Internal: Reject (auto or manual) ───────────────────────────────────

  private async finalizeRejection(opts: {
    submissionId: string;
    reviewedBy: string | null;
    finalStatus: KycSubmissionStatus;
    reason: string;
    providerReference?: string;
    rawResponse?: any;
    context: IRequestContext;
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const submission = await KycSubmission.findById(opts.submissionId).session(session);
      if (!submission) throw new NotFoundError("SUBMISSION_NOT_FOUND");

      if (submission.status !== KycSubmissionStatus.PENDING_REVIEW) {
        throw new BadRequestError("SUBMISSION_ALREADY_PROCESSED");
      }

      submission.status = opts.finalStatus;
      submission.reviewedBy = opts.reviewedBy
        ? mongoose.Types.ObjectId.createFromHexString(opts.reviewedBy) as any
        : undefined;
      submission.reviewedAt = new Date();
      submission.rejectionReason = opts.reason;
      if (opts.providerReference) submission.providerReference = opts.providerReference;
      if (opts.rawResponse) submission.providerRawResponse = opts.rawResponse;
      await submission.save({ session });

      const user = await this.userModel.findById(submission.userId).session(session);
      if (!user) throw new NotFoundError("USER_NOT_FOUND");

      await emitOutboxEvent(
        {
          topic: "kyc.events",
          eventId: generateEventId(),
          eventType: AuditAction.KYC_REJECTED,
          action: AuditAction.KYC_REJECTED,
          status: AuditStatus.PENDING,
          payload: {
            userId: user.userId,
            email: user.email,
            name: user.name,
            targetTier: submission.targetTier,
            submissionId: submission._id.toString(),
            reason: opts.reason,
            autoRejected: opts.finalStatus === KycSubmissionStatus.AUTO_REJECTED,
          },
          aggregateType: "KYC",
          aggregateId: submission._id.toString(),
          version: 1,
          context: opts.context,
        },
        { session }
      );

      await session.commitTransaction();
      return submission.toJSON();
    } catch (e) {
      if (session.inTransaction()) await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  }
}

export default KycService;