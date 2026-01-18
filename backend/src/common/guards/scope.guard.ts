import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { REQUIRE_SCOPE_KEY } from '../decorators/require-scope.decorator';

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as any).user;

    if (!user || !user.scopes || !Array.isArray(user.scopes)) {
      throw new ForbiddenException('Invalid user scopes');
    }

    const userScopes = user.scopes as string[];

    // Check if user has any of the required scopes
    // Supports wildcard matching (e.g., "merchant:*" matches "merchant:read")
    const hasScope = requiredScopes.some((required) => {
      if (required.endsWith(':*')) {
        const prefix = required.slice(0, -2);
        return userScopes.some((scope) => scope === required || scope.startsWith(prefix + ':'));
      }
      return userScopes.includes(required);
    });

    if (!hasScope) {
      throw new ForbiddenException(
        `Insufficient permissions. Required scopes: ${requiredScopes.join(', ')}`,
      );
    }

    return true;
  }
}
