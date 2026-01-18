import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './strategies/jwt.strategy';

export interface LoginDto {
  email: string;
  password: string;
  tenantId?: string; // Optional, can be derived from user
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password, tenantId } = loginDto;

    // Find user by email (with tenant filter if provided)
    const where: any = { email, isActive: true };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const user = await this.prisma.user.findFirst({
      where,
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const scopes = (user.scopes as string[]) || [];
    const roles = (user.roles as string[]) || [];

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      scopes,
      roles,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('jwt.accessTokenExpiry') || '15m',
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, tenantId: user.tenantId },
      {
        secret: this.configService.get<string>('jwt.refreshTokenSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshTokenExpiry') || '7d',
      },
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 minutes in seconds
      token_type: 'Bearer',
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshTokenSecret'),
      }) as { sub: string; tenantId: string };

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive || user.tenantId !== payload.tenantId) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const scopes = (user.scopes as string[]) || [];
      const roles = (user.roles as string[]) || [];

      const newPayload: JwtPayload = {
        sub: user.id,
        tenantId: user.tenantId,
        email: user.email,
        scopes,
        roles,
      };

      const accessToken = this.jwtService.sign(newPayload, {
        expiresIn: this.configService.get<string>('jwt.accessTokenExpiry') || '15m',
      });

      // Optional: Rotate refresh token (issue new one)
      const newRefreshToken = this.jwtService.sign(
        { sub: user.id, tenantId: user.tenantId },
        {
          secret: this.configService.get<string>('jwt.refreshTokenSecret'),
          expiresIn: this.configService.get<string>('jwt.refreshTokenExpiry') || '7d',
        },
      );

      return {
        access_token: accessToken,
        refresh_token: newRefreshToken,
        expires_in: 900,
        token_type: 'Bearer',
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async validateUser(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        isActive: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      scopes: (user.scopes as string[]) || [],
      roles: (user.roles as string[]) || [],
    };
  }
}
