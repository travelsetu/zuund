/**
 * The processes behind zuund.com and api.zuund.com, run by pm2 on the VPS.
 * admin.zuund.com is static files served by nginx (see infra/deploy.sh); it
 * has no process here.
 *
 * Ports sit clear of what the other projects on this box already hold
 * (3000/3101/3102/3110/3111/3200/4000/4100). Pinned here rather than read from
 * .env so a wrong .env cannot land the API on another project's port.
 *
 * Everything binds loopback: nginx is the only thing that should reach these,
 * and the box has no firewall in front of a wider bind.
 */
const HOST = '127.0.0.1';

/**
 * Zero-downtime reloads.
 *
 * In cluster mode `pm2 reload` replaces instances one at a time and waits for
 * each new one before stopping the old, so something is always listening.
 * `wait_ready` makes that wait real: the API calls process.send('ready') only
 * after it is listening and connected to Postgres. `kill_timeout` gives the
 * old instance time to finish in-flight requests.
 */
const ZERO_DOWNTIME = {
  exec_mode: 'cluster',
  wait_ready: true,
  listen_timeout: 20_000,
  kill_timeout: 15_000,
};

module.exports = {
  apps: [
    {
      name: 'zuund-api',
      cwd: '/srv/zuund/apps/backend',
      script: 'dist/main.js',
      instances: 2,
      env: { NODE_ENV: 'production', PORT: '4300', HOST },
      max_memory_restart: '512M',
      ...ZERO_DOWNTIME,
    },
    {
      name: 'zuund-web',
      cwd: '/srv/zuund/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: `start --port 3300 --hostname ${HOST}`,
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
      ...ZERO_DOWNTIME,
      // Next never sends 'ready'; pm2 then waits for the port to be listening,
      // which for a pre-built Next server is the same moment.
      wait_ready: false,
    },
  ],
};
