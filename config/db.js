require('dotenv').config();
const { createClient } = require('@libsql/client');

const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "libsql://loan-manager-db-janithrandiya6-pixel.aws-ap-south-1.turso.io";
const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.AUTH_TOKEN;

const client = createClient({
  url: tursoUrl,
  authToken: tursoToken
});

const queryDB = async (sql, params = []) => {
  const res = await client.execute({ sql, args: params });
  return res.rows || res;
};

module.exports = {
  client,
  execute: queryDB,
  query: queryDB,
  queryDB: queryDB
};