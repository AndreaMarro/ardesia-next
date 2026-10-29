import pg from 'pg';
const connectionString = process.env.M3_TEST_ADMIN_DATABASE_URL;
if (!connectionString) throw Error('A loopback PostgreSQL test operator is required.');
const url = new URL(connectionString);
if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw Error('Test setup refuses remote databases.');
const pool = new pg.Pool({connectionString});
try {
  for (const name of ['ardesia_m3_test','ardesia_m3_browser']) {
    if (!(await pool.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount) {
      await pool.query(`CREATE DATABASE ${name} ENCODING 'UTF8' TEMPLATE template0`);
    }
  }
  console.log('Dedicated test databases ready; no remote database was contacted.');
} finally {await pool.end();}
