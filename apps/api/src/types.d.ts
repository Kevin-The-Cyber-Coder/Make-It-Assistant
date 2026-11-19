import type { Actor } from './context';

declare global {
  namespace Express {
    interface Request {
      actor?: Actor;
      requestId?: string;
    }
  }
}

export {};
