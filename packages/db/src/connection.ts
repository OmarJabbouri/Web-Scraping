import { Sequelize } from 'sequelize';
import pgvectorSequelize from 'pgvector/sequelize';
import { loadConfig } from '@rag/shared';

// Must run before any model uses DataTypes.VECTOR (registers the pgvector type on Sequelize).
pgvectorSequelize.registerTypes(Sequelize);

const config = loadConfig();

export const sequelize = new Sequelize(config.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});
