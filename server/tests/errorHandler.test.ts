import { Router } from 'express';
import mongoose from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../src/config/constants.js';
import { ApiError } from '../src/utils/ApiError.js';
import { asyncHandler } from '../src/utils/asyncHandler.js';
import { expectErrorShape } from './helpers/errors.js';
import { api } from './helpers/testApp.js';

const Thing = mongoose.model(
  'ErrorHandlerThing',
  new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    size: { type: String, enum: ['s', 'm', 'l'] },
  }),
);

const routes = Router();
routes.get('/test/conflict', () => {
  throw ApiError.conflict('Already exists', { fields: ['email'] });
});
routes.get('/test/plain', () => {
  throw new Error('kaboom');
});
routes.get(
  '/test/cast',
  asyncHandler(async () => {
    await Thing.findById('not-an-object-id');
  }),
);
routes.get(
  '/test/duplicate',
  asyncHandler(async () => {
    await Thing.create({ email: 'asha@example.com' });
    await Thing.create({ email: 'asha@example.com' });
  }),
);
routes.get(
  '/test/mongoose-validation',
  asyncHandler(async () => {
    await Thing.create({ size: 'xxl-secret-size' });
  }),
);
routes.get(
  '/test/async',
  asyncHandler(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    throw new Error('async failure');
  }),
);

const agent = api(routes);

beforeAll(async () => {
  await Thing.init(); // builds the unique index
});

describe('errorHandler', () => {
  it('maps ApiError.conflict to 409 CONFLICT with its details', async () => {
    const res = await agent.get('/test/conflict');
    expectErrorShape(res, 409, ERROR_CODES.CONFLICT);
    expect(res.body.message).toBe('Already exists');
    expect(res.body.error.details).toEqual({ fields: ['email'] });
  });

  it('maps a plain Error to 500 INTERNAL_ERROR', async () => {
    const res = await agent.get('/test/plain');
    expectErrorShape(res, 500, ERROR_CODES.INTERNAL_ERROR);
    expect(res.body.error).not.toHaveProperty('details');
  });

  it('maps a Mongoose CastError to 400 BAD_REQUEST "Invalid <path>"', async () => {
    const res = await agent.get('/test/cast');
    expectErrorShape(res, 400, ERROR_CODES.BAD_REQUEST);
    expect(res.body.message).toBe('Invalid _id');
    expect(JSON.stringify(res.body)).not.toContain('not-an-object-id');
  });

  it('maps a duplicate key to 409 CONFLICT with details.fields and never the value', async () => {
    const res = await agent.get('/test/duplicate');
    expectErrorShape(res, 409, ERROR_CODES.CONFLICT);
    expect(res.body.error.details).toEqual({ fields: ['email'] });
    expect(JSON.stringify(res.body)).not.toContain('asha@example.com');
  });

  it('maps a Mongoose ValidationError to 400 VALIDATION_ERROR without the values', async () => {
    const res = await agent.get('/test/mongoose-validation');
    expectErrorShape(res, 400, ERROR_CODES.VALIDATION_ERROR);
    const fields = res.body.error.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['email', 'size']);
    expect(JSON.stringify(res.body)).not.toContain('xxl-secret-size');
  });

  it('catches rejections from async handlers', async () => {
    const res = await agent.get('/test/async');
    expectErrorShape(res, 500, ERROR_CODES.INTERNAL_ERROR);
  });
});
