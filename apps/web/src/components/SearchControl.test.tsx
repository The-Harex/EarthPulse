import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchControl } from './SearchControl';

function response(label?: string) {
  return new Response(JSON.stringify({
    results: label ? [{ id: label, label, latitude: 1, longitude: 2 }] : [],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('SearchControl', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows a clear empty-results state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response()));
    const user = userEvent.setup();
    render(<SearchControl onSelect={vi.fn()} />);
    await user.type(screen.getByLabelText('Search for a location'), 'Nowhere');
    await user.click(screen.getByRole('button', { name: 'Locate' }));
    expect(await screen.findByText('No matching locations found.')).toBeInTheDocument();
  });

  it('ignores a slower response from an older search', async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise));
    const user = userEvent.setup();
    render(<SearchControl onSelect={vi.fn()} />);
    const input = screen.getByLabelText('Search for a location');
    await user.type(input, 'Alpha');
    await user.click(screen.getByRole('button', { name: 'Locate' }));
    await user.clear(input);
    await user.type(input, 'Beta');
    await user.click(screen.getByRole('button', { name: 'Locate' }));

    await act(async () => { second.resolve(response('Beta result')); });
    expect(await screen.findByText('Beta result')).toBeInTheDocument();
    await act(async () => { first.resolve(response('Alpha result')); });
    expect(screen.queryByText('Alpha result')).not.toBeInTheDocument();
  });
});
