import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { isUUID } from 'class-validator';

export const IdempotencyKey = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const idempotencyKey = request.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    if (!isUUID(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key must be a valid UUID');
    }

    return idempotencyKey;
  },
);
