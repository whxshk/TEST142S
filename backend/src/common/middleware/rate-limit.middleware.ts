import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private store: RateLimitStore = {};

  // Default limits (can be overridden per endpoint)
  private readonly defaultLimits = {
    scan: { max: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
    redeem: { max: 20, windowMs: 24 * 60 * 60 * 1000 }, // 20 per day
  };

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: NextFunction) {
    const endpoint = this.getEndpointType(req);
    
    if (!endpoint) {
      return next();
    }

    const limit = this.defaultLimits[endpoint];
    if (!limit) {
      return next();
    }

    const key = this.getRateLimitKey(req, endpoint);
    const now = Date.now();

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      this.cleanup(now);
    }

    const entry = this.store[key];

    if (!entry || entry.resetAt < now) {
      this.store[key] = {
        count: 1,
        resetAt: now + limit.windowMs,
      };
      return next();
    }

    if (entry.count >= limit.max) {
      throw new HttpException(
        `Rate limit exceeded. Maximum ${limit.max} requests per ${limit.windowMs / 1000 / 60} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
    next();
  }

  private getEndpointType(req: any): 'scan' | 'redeem' | null {
    const path = req.url || '';
    if (path.includes('/transactions/issue')) return 'scan';
    if (path.includes('/transactions/redeem')) return 'redeem';
    return null;
  }

  private getRateLimitKey(req: any, endpoint: string): string {
    // Rate limit by device ID or user ID
    const deviceId = req.headers['x-device-id'];
    const userId = (req as any).user?.userId;
    
    if (deviceId) {
      return `${endpoint}:device:${deviceId}`;
    }
    
    if (userId) {
      return `${endpoint}:user:${userId}`;
    }

    // Fallback to IP (less ideal)
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    return `${endpoint}:ip:${ip}`;
  }

  private cleanup(now: number) {
    Object.keys(this.store).forEach((key) => {
      if (this.store[key].resetAt < now) {
        delete this.store[key];
      }
    });
  }
}
