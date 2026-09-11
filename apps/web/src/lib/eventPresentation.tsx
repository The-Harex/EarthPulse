import type { EarthEvent, EarthEventType } from '@earth-pulse/shared';
import { AlertTriangle, CloudLightning, Flame, Mountain, Waves, Wind } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
const presentation: Record<EarthEventType, { label: string; Icon: LucideIcon }> = { earthquake: { label: 'Earthquake', Icon: Waves }, wildfire: { label: 'Wildfire', Icon: Flame }, storm: { label: 'Storm', Icon: CloudLightning }, flood: { label: 'Flood', Icon: Waves }, volcano: { label: 'Volcano', Icon: Mountain }, drought: { label: 'Drought', Icon: Wind }, landslide: { label: 'Landslide', Icon: Mountain }, 'weather-alert': { label: 'Weather alert', Icon: AlertTriangle }, ice: { label: 'Ice', Icon: Waves }, dust: { label: 'Dust / haze', Icon: Wind }, other: { label: 'Natural event', Icon: AlertTriangle } };
export const eventPresentation = (event: EarthEvent) => presentation[event.type];
export const eventLocation = (event: EarthEvent) => event.metadata.kind === 'earthquake' ? event.metadata.place ?? 'Location unavailable' : event.metadata.kind === 'weather-alert' ? event.metadata.areaDesc ?? 'Affected area unavailable' : event.metadata.category;
export const eventKeyValue = (event: EarthEvent) => event.metadata.kind === 'earthquake' ? `M ${event.metadata.magnitude.toFixed(1)}` : event.metadata.kind === 'weather-alert' ? event.metadata.event : event.metadata.category;
