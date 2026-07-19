import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../connection.js';

export class Chunk extends Model<InferAttributes<Chunk>, InferCreationAttributes<Chunk>> {
  declare id: CreationOptional<number>;
  declare documentId: number;
  declare chunkIndex: number;
  declare headingPath: string | null;
  declare text: string;
  declare tokenCount: number;
  // null until the indexing worker (Phase 5) embeds it; dimension fixed by text-embedding-3-small.
  declare embedding: number[] | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Chunk.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    documentId: { type: DataTypes.INTEGER, allowNull: false },
    chunkIndex: { type: DataTypes.INTEGER, allowNull: false },
    headingPath: { type: DataTypes.TEXT, allowNull: true },
    text: { type: DataTypes.TEXT, allowNull: false },
    tokenCount: { type: DataTypes.INTEGER, allowNull: false },
    // VECTOR is registered at runtime by pgvector/sequelize (see connection.ts) but pgvector's
    // own .d.ts doesn't declare it on DataTypes, hence the cast.
    embedding: {
      type: (DataTypes as unknown as { VECTOR: (dimensions: number) => DataTypes.AbstractDataType }).VECTOR(1536),
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'Chunk', tableName: 'chunks', underscored: true },
);
