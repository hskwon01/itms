require('dotenv').config();

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // .env에 DATABASE_URL=postgres://user:pass@host:port/db
});

module.exports = pool;