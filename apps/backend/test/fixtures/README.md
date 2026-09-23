`GeoIP2-City-Test.mmdb` is MaxMind's public test database (fixed sample IPs such as
81.2.69.142 → London), from https://github.com/maxmind/MaxMind-DB/tree/main/test-data,
licensed CC BY-SA 4.0 by MaxMind. It is used only by `test/geo.spec.ts` so IP lookups run
offline; production uses the real GeoLite2 database downloaded by `scripts/geoip-update.mjs`.
