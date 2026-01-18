import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { FastifyRequest } from 'fastify';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    
    // Get request ID from header or generate new one
    const requestId = request.headers['x-request-id'] as string || uuidv4();
    
    // Attach to request object for logging/error handling
    (request as any).requestId = requestId;
    
    return next.handle();
  }
}
