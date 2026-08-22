import {
  parsePaginationParams,
  formatOffsetResponse,
  formatCursorResponse
} from '../../src/common/utils/pagination';

describe('Unit Test: Pagination Helpers', () => {
  describe('parsePaginationParams', () => {
    it('should parse offset pagination parameters with defaults', () => {
      const parsed = parsePaginationParams({});
      expect(parsed).toEqual({
        type: 'offset',
        page: 1,
        limit: 20,
        skip: 0
      });
    });

    it('should parse custom page and limit and compute skip correctly', () => {
      const parsed = parsePaginationParams({ page: '3', limit: '15' });
      expect(parsed).toEqual({
        type: 'offset',
        page: 3,
        limit: 15,
        skip: 30
      });
    });

    it('should identify cursor pagination if cursor param is supplied', () => {
      const parsed = parsePaginationParams({ cursor: 'item-uuid-123', limit: '10' });
      expect(parsed).toEqual({
        type: 'cursor',
        cursor: 'item-uuid-123',
        limit: 10
      });
    });
  });

  describe('formatOffsetResponse', () => {
    it('should format offset response matching specification { data, total, page, limit }', () => {
      const items = [{ id: '1', name: 'Task 1' }, { id: '2', name: 'Task 2' }];
      const response = formatOffsetResponse(items, 100, 2, 2);

      expect(response).toEqual({
        data: items,
        total: 100,
        page: 2,
        limit: 2
      });
    });
  });

  describe('formatCursorResponse', () => {
    it('should return next_cursor as null if data length <= limit', () => {
      const items = [{ id: 'task-1' }, { id: 'task-2' }];
      const response = formatCursorResponse(items, 5);

      expect(response.data).toHaveLength(2);
      expect(response.next_cursor).toBeNull();
    });

    it('should trim data and extract next_cursor when data length > limit', () => {
      const items = [
        { id: 'task-1' },
        { id: 'task-2' },
        { id: 'task-3' } // extra item indicating next page
      ];
      const response = formatCursorResponse(items, 2);

      expect(response.data).toHaveLength(2);
      expect(response.data.map((d) => d.id)).toEqual(['task-1', 'task-2']);
      expect(response.next_cursor).toBe('task-2');
    });
  });
});
