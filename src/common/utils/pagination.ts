export interface OffsetPaginationOptions {
  page?: number;
  limit?: number;
}

export interface OffsetPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CursorPaginationOptions {
  cursor?: string;
  limit?: number;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  next_cursor: string | null;
}

export function parsePaginationParams(query: Record<string, any>) {
  const isCursor = 'cursor' in query;
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 20, 1), 100);

  if (isCursor) {
    return {
      type: 'cursor' as const,
      cursor: (query.cursor as string) || undefined,
      limit
    };
  }

  const page = Math.max(parseInt(query.page as string, 10) || 1, 1);
  return {
    type: 'offset' as const,
    page,
    limit,
    skip: (page - 1) * limit
  };
}

export function formatOffsetResponse<T>(data: T[], total: number, page: number, limit: number): OffsetPaginatedResponse<T> {
  return {
    data,
    total,
    page,
    limit
  };
}

export function formatCursorResponse<T extends { id: string }>(data: T[], limit: number): CursorPaginatedResponse<T> {
  let nextCursor: string | null = null;
  let items = data;

  if (data.length > limit) {
    items = data.slice(0, limit);
    const lastItem = items[items.length - 1];
    nextCursor = lastItem ? lastItem.id : null;
  }

  return {
    data: items,
    next_cursor: nextCursor
  };
}
