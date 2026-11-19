import type { Query, Repository, Where } from './types';

function getPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, value);
}

function matchesOperator(actual: unknown, operator: Record<string, unknown>): boolean {
  return Object.entries(operator).every(([key, expected]) => {
    switch (key) {
      case '$in':
        return Array.isArray(expected) && expected.includes(actual);
      case '$nin':
        return Array.isArray(expected) && !expected.includes(actual);
      case '$ne':
        return actual !== expected;
      case '$gt':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
      case '$gte':
        return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
      case '$lt':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
      case '$lte':
        return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
      case '$contains':
        return typeof actual === 'string' && String(expected).length > 0 && actual.includes(String(expected));
      case '$exists':
        return Boolean(expected) === (actual !== undefined);
      default:
        return false;
    }
  });
}

export function matchesWhere<T>(entity: T, where?: Where): boolean {
  if (!where) return true;
  return Object.entries(where).every(([path, expected]) => {
    const actual = getPath(entity, path);
    if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date)) {
      return matchesOperator(actual, expected as Record<string, unknown>);
    }
    return actual === expected;
  });
}

function applyQuery<T extends { id: string }>(items: T[], query?: Query): T[] {
  let result = items.filter((item) => matchesWhere(item, query?.where));
  if (query?.sort) {
    const dir = query.sort.direction === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      const av = getPath(a, query.sort!.field);
      const bv = getPath(b, query.sort!.field);
      if (av === bv) return 0;
      return (av as string) > (bv as string) ? dir : -dir;
    });
  }
  const offset = query?.offset ?? 0;
  const limit = query?.limit ?? items.length;
  return result.slice(offset, offset + limit);
}

export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  protected readonly items = new Map<string, T>();
  protected onChange?: () => void;

  constructor(seed: T[] = [], onChange?: () => void) {
    seed.forEach((item) => this.items.set(item.id, structuredClone(item)));
    this.onChange = onChange;
  }

  async create(entity: T): Promise<T> {
    const stored = structuredClone(entity);
    this.items.set(stored.id, stored);
    this.onChange?.();
    return structuredClone(stored);
  }

  async findById(id: string): Promise<T | null> {
    const found = this.items.get(id);
    return found ? structuredClone(found) : null;
  }

  async findOne(query: Query): Promise<T | null> {
    return applyQuery([...this.items.values()], { ...query, limit: 1 })[0] ?? null;
  }

  async find(query?: Query): Promise<T[]> {
    return applyQuery([...this.items.values()], query).map((item) => structuredClone(item));
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const current = this.items.get(id);
    if (!current) return null;
    const updated = { ...current, ...patch, id } as T;
    this.items.set(id, updated);
    this.onChange?.();
    return structuredClone(updated);
  }

  async delete(id: string): Promise<boolean> {
    const removed = this.items.delete(id);
    if (removed) this.onChange?.();
    return removed;
  }

  async count(query?: Query): Promise<number> {
    return applyQuery([...this.items.values()], query).length;
  }
}
