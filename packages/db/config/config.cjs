const path = require('node:path');
// sequelize-cli's cwd is packages/db (npm --workspace), but .env lives at the repo root.
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// One shared connection recipe — sequelize-cli requires a config keyed by env, but this
// project uses a single DATABASE_URL for all of them.
const common = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
};

module.exports = {
  development: common,
  test: common,
  production: common,
};
