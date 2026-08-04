import { describe, it, expect } from 'vitest';
import { edgeFunctionError } from './errorMessages';

describe('edgeFunctionError', () => {
  const httpError = (body: string) =>
    Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: new Response(body, { status: 502 }),
    });

  it('surfaces the {error} body instead of the generic message', async () => {
    const err = httpError(JSON.stringify({ error: 'You have insufficient available funds' }));
    expect(await edgeFunctionError(err, 'Payout failed')).toBe('You have insufficient available funds');
  });

  it('falls back when the body is not JSON', async () => {
    expect(await edgeFunctionError(httpError('<html>502</html>'), 'Payout failed')).toBe('Payout failed');
  });

  it('keeps a real error message when there is no response context', async () => {
    expect(await edgeFunctionError(new Error('Failed to fetch'), 'Payout failed')).toBe('Failed to fetch');
  });
});
