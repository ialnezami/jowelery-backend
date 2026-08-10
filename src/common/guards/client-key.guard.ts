import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Global guard that validates the X-Client-Key header on every request.
 * Set CLIENT_API_KEY in env to enable. Unset = guard is disabled (safe for local dev).
 * Swagger docs (/docs) are always allowed through.
 */
@Injectable()
export class ClientKeyGuard implements CanActivate {
  private readonly expectedKey = process.env.CLIENT_API_KEY;

  canActivate(context: ExecutionContext): boolean {
    if (!this.expectedKey) return true;

    const req = context.switchToHttp().getRequest<Request>();

    if (req.path.startsWith('/docs')) return true;

    const provided = req.headers['x-client-key'];
    if (!provided || provided !== this.expectedKey) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
