import type { EarthObservation } from '@earth-pulse/shared';

function csvRows(input: string): Record<string, string>[] {
  const lines = input.trim().split(/\r?\n/); if (lines.length < 2) return [];
  const parse = (line: string) => { const out: string[] = []; let cell = ''; let quoted = false; for (let i = 0; i < line.length; i++) { const char = line[i]!; if (char === '"') { if (quoted && line[i + 1] === '"') { cell += char; i++; } else quoted = !quoted; } else if (char === ',' && !quoted) { out.push(cell); cell = ''; } else cell += char; } out.push(cell); return out; };
  const header = parse(lines[0]!).map((value) => value.trim()); return lines.slice(1).map(parse).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index]?.trim() ?? ''])));
}
function number(value: string | undefined) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
function observedAt(row: Record<string, string>) { const date = row.acq_date; const time = row.acq_time?.padStart(4, '0'); const parsed = date && time ? new Date(`${date}T${time.slice(0, 2)}:${time.slice(2)}:00Z`) : null; return parsed && !Number.isNaN(parsed.valueOf()) ? parsed.toISOString() : undefined; }
function confidence(value: string | undefined): EarthObservation['confidence'] { const normalized = value?.toLowerCase(); if (normalized === 'h' || normalized === 'high') return 'high'; if (normalized === 'n' || normalized === 'nominal') return 'nominal'; if (normalized === 'l' || normalized === 'low') return 'low'; return 'unknown'; }

export function adaptFirmsObservations(input: string, source: string): { observations: EarthObservation[]; rejectedCount: number } {
  const seen = new Set<string>(); const observations: EarthObservation[] = []; let rejectedCount = 0;
  for (const row of csvRows(input)) { const latitude = number(row.latitude); const longitude = number(row.longitude); const at = observedAt(row); if (latitude == null || longitude == null || !at || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { rejectedCount++; continue; }
    const id = `firms:${source}:${latitude.toFixed(4)}:${longitude.toFixed(4)}:${at}:${row.satellite ?? ''}`; if (seen.has(id)) continue; seen.add(id);
    observations.push({ id, type: 'wildfire-detection', latitude, longitude, observedAt: at, confidence: confidence(row.confidence), source: 'NASA FIRMS', ...(number(row.bright_ti4) != null ? { brightness: number(row.bright_ti4) } : {}), ...(number(row.frp) != null ? { fireRadiativePower: number(row.frp) } : {}), ...(row.satellite ? { satellite: row.satellite } : {}), ...(row.instrument ? { instrument: row.instrument } : {}), metadata: { product: source, daynight: row.daynight ?? '', version: row.version ?? '' } });
  }
  return { observations, rejectedCount };
}
