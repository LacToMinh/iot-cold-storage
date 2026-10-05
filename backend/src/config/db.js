import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let poolConfig = {};

if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
  };
} else {
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    database: process.env.DB_NAME || 'iot_cold_storage',
  };
  if (process.env.DB_PASSWORD) {
    poolConfig.password = process.env.DB_PASSWORD;
  }
}

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client:', err);
});

export const query = (text, params) => pool.query(text, params);

export const checkDatabaseConnection = async () => {
  try {
    const res = await query('SELECT NOW() as current_time, version();');
    console.log('[PostgreSQL] Connected successfully to database:', poolConfig.database);
    console.log('[PostgreSQL] DB Time:', res.rows[0].current_time);
  } catch (error) {
    console.error('[PostgreSQL] Connection failed:', error.message);
  }
};
