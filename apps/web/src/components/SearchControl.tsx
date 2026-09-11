import type { GeocodeResult } from '@earth-pulse/shared';
import { LoaderCircle, LocateFixed, Search, X } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SearchControl({ onSelect }: { onSelect: (result: GeocodeResult) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [hasSearched, setHasSearched] = useState(false);
  const requestIdRef = useRef(0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) { setError('Enter at least 2 characters.'); return; }
    const requestId = ++requestIdRef.current;
    setHasSearched(true);
    setLoading(true); setError(undefined);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`);
      const body = await response.json() as { results?: GeocodeResult[] };
      if (!response.ok) throw new Error('Search is temporarily unavailable.');
      if (requestId === requestIdRef.current) setResults(body.results ?? []);
    } catch (caught) {
      if (requestId === requestIdRef.current) {
        setResults([]); setError(caught instanceof Error ? caught.message : 'Search is temporarily unavailable.');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  function clearSearch() {
    requestIdRef.current += 1;
    setQuery('');
    setResults([]);
    setError(undefined);
    setLoading(false);
    setHasSearched(false);
  }

  return (
    <div className="search-wrap">
      <form className="search-form" onSubmit={submit} role="search">
        <Search aria-hidden="true" />
        <Input aria-label="Search for a location" placeholder="Locate a city or region" value={query} onChange={(event) => setQuery(event.target.value)} />
        {loading ? <LoaderCircle className="spin" aria-label="Searching" /> : query && <Button aria-label="Clear search" variant="ghost" size="icon-sm" type="button" onClick={clearSearch}><X /></Button>}
        <Button className="search-submit" type="submit" variant="ghost">Locate</Button>
      </form>
      {(hasSearched || error) && <div className="search-results" role="region" aria-label="Location search results">
        {error && <p className="search-error">{error}</p>}
        {results.map((result) => <button key={result.id} type="button" onClick={() => { onSelect(result); setResults([]); setHasSearched(false); }}><LocateFixed /><span>{result.label}</span></button>)}
        {!error && !loading && results.length === 0 && <p>No matching locations found.</p>}
        <small>Search data © OpenStreetMap contributors</small>
      </div>}
    </div>
  );
}
