import pg from 'pg'; import { env } from '../config/env.js';
export const pool=new pg.Pool({connectionString:env.DATABASE_URL});
export async function dbHealth(){try{await pool.query('select 1');return true}catch{return false}}
