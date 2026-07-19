import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../connection.js';

export type PageStatus = 'pending' | 'crawled' | 'failed' | 'skipped';

export class Page extends Model<InferAttributes<Page>, InferCreationAttributes<Page>> {
  declare id: CreationOptional<number>;
  declare siteId: number;
  declare url: string;
  declare status: CreationOptional<PageStatus>;
  declare contentHash: string | null;
  declare lastCrawledAt: Date | null;
  declare httpStatus: number | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Page.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    siteId: { type: DataTypes.INTEGER, allowNull: false },
    url: { type: DataTypes.TEXT, allowNull: false, unique: true },
    status: {
      type: DataTypes.ENUM('pending', 'crawled', 'failed', 'skipped'),
      allowNull: false,
      defaultValue: 'pending',
    },
    contentHash: { type: DataTypes.CHAR(64), allowNull: true },
    lastCrawledAt: { type: DataTypes.DATE, allowNull: true },
    httpStatus: { type: DataTypes.INTEGER, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'Page', tableName: 'pages', underscored: true },
);
