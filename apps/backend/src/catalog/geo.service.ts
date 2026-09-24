import { isIP } from 'node:net';
import { existsSync } from 'node:fs';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { open, type CityResponse, type Reader } from 'maxmind';
import type { GeoGuessDto, GeoPoint } from '@zuund/shared';
import type { Env } from '../config/env';
import { CatalogService } from './catalog.service';

/**
 * IP → country/city using a local MaxMind-format database (DB-IP "IP to City
 * Lite" in production, CC BY 4.0), so visitors' IPs never leave ZUUND. The
 * answer is only a suggestion for pre-selecting a city.
 */
@Injectable()
export class GeoService implements OnModuleInit {
  private readonly logger = new Logger(GeoService.name);
  private reader: Reader<CityResponse> | null = null;

  constructor(
    private readonly catalog: CatalogService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit() {
    const path = this.config.get('GEOIP_DB_PATH', { infer: true });
    if (!existsSync(path)) {
      this.logger.warn(`No IP location database at ${path}; location guessing is off.`);
      return;
    }
    // maxmind watches the file, so a monthly refresh is picked up without a restart.
    this.reader = await open<CityResponse>(path, { watchForUpdates: true });
    this.logger.log(`IP location database loaded from ${path}`);
  }

  async guess(ip: string | undefined): Promise<GeoGuessDto> {
    const none: GeoGuessDto = { country: null, city: null };
    const hit = await this.lookup(ip);
    const code = hit?.country?.iso_code;
    if (!code) return none;
    const [country, city] = await Promise.all([
      this.catalog.findCountry(code),
      this.city(hit, code),
    ]);
    // Only trust the city when it sits in the detected country.
    return { country, city: city && city.countryCode === code ? city : null };
  }

  /** The IP's approximate position: the fallback when a device doesn't share its own. */
  async point(ip: string | undefined): Promise<GeoPoint | null> {
    const loc = (await this.lookup(ip))?.location;
    if (loc?.latitude === undefined || loc.longitude === undefined) return null;
    return { latitude: loc.latitude, longitude: loc.longitude };
  }

  /** A device position → the nearest city in our list (and its country), for pre-selecting. */
  async nearest(p: GeoPoint): Promise<GeoGuessDto> {
    const city = await this.catalog.findNearestCity(null, p.latitude, p.longitude);
    if (!city) return { country: null, city: null };
    return { country: await this.catalog.findCountry(city.countryCode), city };
  }

  private async lookup(ip: string | undefined): Promise<CityResponse | null> {
    let addr = ip?.replace(/^::ffff:/, '');
    if (!this.reader || !addr || !isIP(addr)) return null;
    if (isPrivate(addr)) {
      // A phone on the office Wi-Fi reaches a dev API from 192.168.x.x; guess from this
      // machine's own public IP instead. Production always sees the visitor's real IP.
      if (this.config.get('NODE_ENV', { infer: true }) !== 'development') return null;
      addr = await ownPublicIp();
      if (!addr) return null;
    }
    return this.reader.get(addr);
  }

  /**
   * MaxMind records carry GeoNames ids; DB-IP only a name and coordinates. Towns too
   * small for our city list also fall back to the nearest city.
   */
  private async city(hit: CityResponse, code: string) {
    const byId = hit.city?.geoname_id
      ? await this.catalog.findCityByGeonameId(hit.city.geoname_id)
      : null;
    if (byId) return byId;
    const loc = hit.location;
    if (loc?.latitude === undefined || loc.longitude === undefined) return null;
    return this.catalog.findNearestCity(code, loc.latitude, loc.longitude, hit.city?.names?.en);
  }
}

let publicIp: Promise<string | undefined> | undefined;
/** Development only: this machine's public IP, looked up once. */
function ownPublicIp(): Promise<string | undefined> {
  publicIp ??= fetch('https://api.ipify.org', { signal: AbortSignal.timeout(3000) })
    .then((r) => (r.ok ? r.text() : undefined))
    .then((t) => (t && isIP(t.trim()) ? t.trim() : undefined))
    .catch(() => {
      publicIp = undefined; // try again next time
      return undefined;
    });
  return publicIp;
}

function isPrivate(ip: string): boolean {
  return (
    /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ||
    ip === '::1' ||
    /^f[cd]/i.test(ip) ||
    /^fe80/i.test(ip)
  );
}
