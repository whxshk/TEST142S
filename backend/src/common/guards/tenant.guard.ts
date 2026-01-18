import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as any).user;

    if (!user || !user.tenantId) {
      throw new UnauthorizedException('Tenant context not found');
    }

    // Attach tenant ID to request for easy access
    (request as any).tenantId = user.tenantId;

    return true;
  }
}
