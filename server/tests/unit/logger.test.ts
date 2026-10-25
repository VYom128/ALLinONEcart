import { describe, expect, it } from 'vitest';
import { serializeError } from '../../src/utils/logger.js';

describe('serializeError', () => {
  it('keeps name, message, stack and code only', () => {
    const err = Object.assign(new Error('boom'), { code: 'E_TEST', body: { password: 'x' } });
    const serialized = serializeError(err);
    expect(Object.keys(serialized).sort()).toEqual(['code', 'message', 'name', 'stack']);
    expect(serialized).toMatchObject({ name: 'Error', message: 'boom', code: 'E_TEST' });
  });

  it('removes the duplicate value from Mongo duplicate-key messages and stacks', () => {
    const err = Object.assign(
      new Error('E11000 duplicate key error collection: users dup key: { phone: "+919876543210" }'),
      { name: 'MongoServerError', code: 11000 },
    );
    const serialized = serializeError(err);
    expect(serialized.message).toBe('Duplicate key error');
    expect(JSON.stringify(serialized)).not.toContain('9876543210');
  });

  it('handles values that are not errors without echoing them', () => {
    expect(serializeError('secret text')).toEqual({
      name: 'NonError',
      message: 'Non-error value thrown (string)',
    });
  });
});
