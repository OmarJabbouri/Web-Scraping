import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../connection.js';

export type RenderMode = 'static' | 'js';

export class Site extends Model<InferAttributes<Site>, InferCreationAttributes<Site>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare baseUrl: string;
  declare robotsTxt: string | null;
  declare crawlDelayMs: CreationOptional<number>;
  declare allowed: CreationOptional<boolean>;
  declare renderMode: RenderMode;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Site.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    baseUrl: { type: DataTypes.STRING, allowNull: false, unique: true },
    robotsTxt: { type: DataTypes.TEXT, allowNull: true },
    crawlDelayMs: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1000 },
    allowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    renderMode: { type: DataTypes.ENUM('static', 'js'), allowNull: false, defaultValue: 'static' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'Site', tableName: 'sites', underscored: true },
);
