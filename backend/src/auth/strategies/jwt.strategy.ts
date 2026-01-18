import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';

export interface JwtPayload {
  sub: string; // user ID
  tenantId: string;
  email: string;
  scopes: string[];
  roles: string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'dev-secret',
      passReqToCallback: true,
    });
  }

  async validate(request: FastifyRequest, payload: JwtPayload) {
    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Attach user info to request
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      scopes: payload.scopes || [],
      roles: payload.roles || [],
    };
  }
}
