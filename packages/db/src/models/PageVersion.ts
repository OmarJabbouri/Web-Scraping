import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../connection.js';

// Each crawl inserts a new row here instead of overwriting the last one — that's the
// "versioning, no silent overwrite" requirement.
export class PageVersion extends Model<InferAttributes<PageVersion>, InferCreationAttributes<PageVersion>> {
  declare id: CreationOptional<number>;
  declare pageId: number;
  declare versionNo: number;
  declare rawHtml: string;
  declare contentHash: string;
  declare fetchedAt: CreationOptional<Date>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

PageVersion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    pageId: { type: DataTypes.INTEGER, allowNull: false },
    versionNo: { type: DataTypes.INTEGER, allowNull: false },
    rawHtml: { type: DataTypes.TEXT, allowNull: false },
    contentHash: { type: DataTypes.CHAR(64), allowNull: false },
    fetchedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'PageVersion', tableName: 'page_versions', underscored: true },
);
