import axios from 'axios';
import { HttpError, isHttpError, normalizeHttpError } from '@/app/services/http/errors';

describe('HttpError', () => {
  it('creates error with message and name', () => {
    const err = new HttpError('something failed');
    expect(err.message).toBe('something failed');
    expect(err.name).toBe('HttpError');
    expect(err).toBeInstanceOf(Error);
  });

  it('stores status, code, and data', () => {
    const err = new HttpError('fail', { status: 404, code: 'NOT_FOUND', data: { x: 1 } });
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.data).toEqual({ x: 1 });
  });

  it('has undefined fields when opts omitted', () => {
    const err = new HttpError('fail');
    expect(err.status).toBeUndefined();
    expect(err.code).toBeUndefined();
    expect(err.data).toBeUndefined();
  });
});

describe('isHttpError', () => {
  it('returns true for HttpError instances', () => {
    expect(isHttpError(new HttpError('x'))).toBe(true);
  });

  it('returns false for generic Error', () => {
    expect(isHttpError(new Error('x'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isHttpError(null)).toBe(false);
    expect(isHttpError('string')).toBe(false);
    expect(isHttpError(42)).toBe(false);
  });
});

describe('normalizeHttpError', () => {
  it('returns HttpError as-is if already HttpError', () => {
    const original = new HttpError('already', { status: 400 });
    const result = normalizeHttpError(original);
    expect(result).toBe(original);
  });

  it('converts axios error with response to HttpError', () => {
    const axiosErr = Object.assign(new Error('Request failed with status 404'), {
      isAxiosError: true,
      response: { status: 404, data: { msg: 'not found' } },
      code: 'ERR_BAD_REQUEST',
    });
    jest.spyOn(axios, 'isAxiosError').mockReturnValueOnce(true);

    const result = normalizeHttpError(axiosErr);
    expect(result).toBeInstanceOf(HttpError);
    expect(result.status).toBe(404);
    expect(result.code).toBe('ERR_BAD_REQUEST');
    expect(result.data).toEqual({ msg: 'not found' });
  });

  it('converts axios error without response', () => {
    const axiosErr = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      response: undefined,
      code: 'ERR_NETWORK',
    });
    jest.spyOn(axios, 'isAxiosError').mockReturnValueOnce(true);

    const result = normalizeHttpError(axiosErr);
    expect(result).toBeInstanceOf(HttpError);
    expect(result.message).toBe('Network Error');
    expect(result.status).toBeUndefined();
  });

  it('uses data string as message when axios error has no message', () => {
    const axiosErr = Object.assign(new Error(''), {
      isAxiosError: true,
      response: { status: 500, data: 'internal error' },
      code: undefined,
      message: '',
    });
    jest.spyOn(axios, 'isAxiosError').mockReturnValueOnce(true);

    const result = normalizeHttpError(axiosErr);
    expect(result.message).toBe('internal error');
  });

  it('converts generic Error to HttpError', () => {
    const err = new Error('generic failure');
    const result = normalizeHttpError(err);
    expect(result).toBeInstanceOf(HttpError);
    expect(result.message).toBe('generic failure');
    expect(result.status).toBeUndefined();
  });

  it('handles unknown non-error values', () => {
    const result = normalizeHttpError('just a string');
    expect(result).toBeInstanceOf(HttpError);
    expect(result.message).toBe('Request failed');
  });

  it('handles null', () => {
    const result = normalizeHttpError(null);
    expect(result).toBeInstanceOf(HttpError);
    expect(result.message).toBe('Request failed');
  });
});
