import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../connection.js';

export type ContentType = 'article' | 'listing' | 'table' | 'mixed';

export class Document extends Model<InferAttributes<Document>, InferCreationAttributes<Document>> {
  declare id: CreationOptional<number>;
  declare pageVersionId: number;
  declare title: string | null;
  declare cleanedText: string;
  // Holds the "more than one content type" extraction: tables as JSON, extracted links, etc.
  declare structuredData: CreationOptional<Record<string, unknown>>;
  declare contentType: CreationOptional<ContentType>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Document.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    pageVersionId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    title: { type: DataTypes.TEXT, allowNull: true },
    cleanedText: { type: DataTypes.TEXT, allowNull: false },
    structuredData: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    contentType: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'article' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'Document', tableName: 'documents', underscored: true },
);
