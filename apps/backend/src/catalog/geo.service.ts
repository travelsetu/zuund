import { isIP } from 'node:net';
import { existsSync } from 'node:fs';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { open, type CityResponse, type Reader } from 'maxmind';
import type { GeoGuessDto } from '@zuund/shared';
import type { Env } from '../config/env';
import { CatalogService } from './catalog.service';

/**
 * IP → country/city using a local GeoLite2 database, so visitors' IPs never
 * leave ZUUND. The answer is only a suggestion for pre-selecting a city.
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
      this.logger.warn(`No GeoLite2 database at ${path}; location guessing is off.`);
      return;
    }
    // maxmind watches the file, so a weekly refresh is picked up without a restart.
    this.reader = await open<CityResponse>(path, { watchForUpdates: true });
    this.logger.log(`GeoLite2 database loaded from ${path}`);
  }

  async guess(ip: string | undefined): Promise<GeoGuessDto> {
    const none: GeoGuessDto = { country: null, city: null };
    const addr = ip?.replace(/^::ffff:/, '');
    if (!this.reader || !addr || !isIP(addr) || isPrivate(addr)) return none;
    const hit = this.reader.get(addr);
    const code = hit?.country?.iso_code;
    if (!code) return none;
    const [country, city] = await Promise.all([
      this.catalog.findCountry(code),
      hit.city?.geoname_id ? this.catalog.findCityByGeonameId(hit.city.geoname_id) : null,
    ]);
    // Only trust the city when it sits in the detected country.
    return { country, city: city && city.countryCode === code ? city : null };
  }
}

function isPrivate(ip: string): boolean {
  return (
    /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ||
    ip === '::1' ||
    /^f[cd]/i.test(ip) ||
    /^fe80/i.test(ip)
  );
}
