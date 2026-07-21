import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../connection.js';

export type CrawlSessionStatus = 'running' | 'completed' | 'failed';

// One row per crawl run. Workers atomically bump the counters (pages_crawled/skipped/failed) as
// they process jobs, so the UI can show live progress without scanning the whole pages table.
export class CrawlSession extends Model<InferAttributes<CrawlSession>, InferCreationAttributes<CrawlSession>> {
  declare id: CreationOptional<number>;
  declare siteId: number;
  declare status: CreationOptional<CrawlSessionStatus>;
  declare maxDepth: number;
  declare maxPages: number;
  declare pagesCrawled: CreationOptional<number>;
  declare pagesSkipped: CreationOptional<number>;
  declare pagesFailed: CreationOptional<number>;
  declare startedAt: CreationOptional<Date>;
  declare finishedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

CrawlSession.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    siteId: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.ENUM('running', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'running',
    },
    maxDepth: { type: DataTypes.INTEGER, allowNull: false },
    maxPages: { type: DataTypes.INTEGER, allowNull: false },
    pagesCrawled: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    pagesSkipped: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    pagesFailed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    startedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    finishedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'CrawlSession', tableName: 'crawl_sessions', underscored: true },
);
