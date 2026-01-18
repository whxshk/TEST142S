import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

export interface UserPayload {
  userId: string;
  tenantId: string;
  email: string;
  scopes: string[];
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserPayload => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return (request as any).user;
  },
);
