import type { EarthEvent, EventRelation } from '@earth-pulse/shared';
import { distanceKm } from './relations.js';

const at = (event: EarthEvent) => Date.parse(event.updatedAt ?? event.startedAt);
export class EventCorrelationService {
  score(subject: EarthEvent, related: EarthEvent): EventRelation | null {
    const distance = distanceKm(subject, related); if (distance == null) return null; const hours = Math.abs(at(subject) - at(related)) / 3_600_000;
    let compatible = false; let maxDistance = 100; let maxHours = 72;
    if (subject.type === 'earthquake' && related.type === 'earthquake' && (subject.metadata.kind === 'earthquake' ? subject.metadata.magnitude >= 5 : false)) { compatible = true; maxDistance = 120; maxHours = 168; }
    else if ((subject.type === 'storm' && related.type === 'weather-alert') || (related.type === 'storm' && subject.type === 'weather-alert')) { compatible = true; maxHours = 24; }
    else if (subject.type === related.type) compatible = true;
    if (!compatible || distance > maxDistance || hours > maxHours) return null;
    const spatial = Math.round(50 * (1 - distance / maxDistance)); const temporal = Math.round(30 * (1 - hours / maxHours)); const score = spatial + temporal + 20; if (score < 60) return null;
    return { id: `relation:${subject.id}:${related.id}`, eventIds: [subject.id, related.id], subjectEventId: subject.id, relatedEventId: related.id, kind: 'possible-related', score, reasons: [`within-${maxDistance}-km`, `within-${maxHours}-hours`, 'compatible-event-types'], distanceKm: Math.round(distance * 10) / 10 };
  }
  related(subject: EarthEvent, candidates: EarthEvent[]) { return candidates.filter((item) => item.id !== subject.id).map((item) => this.score(subject, item)).filter((item): item is EventRelation => item !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 25); }
}

