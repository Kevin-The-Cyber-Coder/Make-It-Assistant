import { EventEmitter } from 'node:events';

export interface BusEvent {
  type: string;
  organizationId?: string;
  taskId?: string;
  message?: string;
  payload?: unknown;
  createdAt: string;
}

export type BusListener = (event: BusEvent) => void;

export class EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(1000);
  }

  publish(event: Omit<BusEvent, 'createdAt'>): void {
    this.emitter.emit('event', { ...event, createdAt: new Date().toISOString() } satisfies BusEvent);
  }

  subscribe(listener: BusListener): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }
}
