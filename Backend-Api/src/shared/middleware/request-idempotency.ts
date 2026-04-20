import { IAuthRequest } from "@/config/interfaces/request.interface";
import { NextFunction, Response } from "express";
import BadRequestError from "../errors/badRequest";
import { validateId, validateTimestampedId } from "../utils/id.generator";

export const requestIdempotencyKey = async (
  req: IAuthRequest,
  res: Response,
  next: NextFunction
) => {
  const idempotencyKey = req.headers['idempotency-key'] as string 

  if (!idempotencyKey) {
    throw new BadRequestError('Missing idempotency key');
  }

  if (!validateTimestampedId(idempotencyKey)) {
    throw new BadRequestError("Invalid Idempotency-Key format");
  }

  req.idempotencyKey = idempotencyKey;
  next();
}