/**
 * fetchWithAuth response parsing.
 *
 * The regression this guards (FITKIT-MOBILE-4): every successful response was
 * fed to `res.json()`, so a `204 No Content` threw
 * `SyntaxError: JSON Parse error: Unexpected end of input`. It surfaced as a
 * failed mutation for a call the server had already completed — a consumed
 * pending intent reported as failure, with the one-shot already burned.
 */
import { Text } from 'react-native';
import { waitFor } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { api, http, HttpResponse, server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';

const PATH = '/users/me/pending-intent/x/consume';

function Probe({ onResult }: { onResult: (r: unknown) => void }) {
  const { fetchWithAuth } = useApi();
  const [done, setDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchWithAuth(PATH, { method: 'POST' })
      .then((r) => {
        if (!cancelled) onResult({ ok: true, value: r });
      })
      .catch((e) => {
        if (!cancelled) onResult({ ok: false, error: String(e) });
      })
      .finally(() => !cancelled && setDone(true));
    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth, onResult]);
  return <Text>{done ? 'done' : 'pending'}</Text>;
}

describe('fetchWithAuth response body handling', () => {
  it('resolves rather than throwing on 204 No Content', async () => {
    server.use(
      http.post(api(PATH), () => new HttpResponse(null, { status: 204 })),
    );
    const onResult = jest.fn();

    await renderWithProviders(<Probe onResult={onResult} />);

    await waitFor(() => expect(onResult).toHaveBeenCalled());
    expect(onResult.mock.calls[0][0]).toEqual({ ok: true, value: undefined });
  });

  it('resolves on a 200 with an empty body', async () => {
    server.use(
      http.post(api(PATH), () => new HttpResponse('', { status: 200 })),
    );
    const onResult = jest.fn();

    await renderWithProviders(<Probe onResult={onResult} />);

    await waitFor(() => expect(onResult).toHaveBeenCalled());
    expect(onResult.mock.calls[0][0]).toEqual({ ok: true, value: undefined });
  });

  it('still parses a normal JSON body', async () => {
    server.use(
      http.post(api(PATH), () => HttpResponse.json({ data: { consumed: true } })),
    );
    const onResult = jest.fn();

    await renderWithProviders(<Probe onResult={onResult} />);

    await waitFor(() => expect(onResult).toHaveBeenCalled());
    expect(onResult.mock.calls[0][0]).toEqual({
      ok: true,
      value: { data: { consumed: true } },
    });
  });

  it('still raises a typed error for a failure response', async () => {
    server.use(
      http.post(api(PATH), () =>
        HttpResponse.json({ message: 'nope' }, { status: 404 }),
      ),
    );
    const onResult = jest.fn();

    await renderWithProviders(<Probe onResult={onResult} />);

    await waitFor(() => expect(onResult).toHaveBeenCalled());
    expect(onResult.mock.calls[0][0]).toMatchObject({ ok: false });
    expect(String((onResult.mock.calls[0][0] as { error: string }).error)).toContain(
      'nope',
    );
  });
});
