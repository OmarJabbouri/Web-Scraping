import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { sequelize } from '../connection.js';

export class FailedJob extends Model<InferAttributes<FailedJob>, InferCreationAttributes<FailedJob>> {
  declare id: CreationOptional<number>;
  declare queue: string;
  declare jobId: string | null;
  declare payload: unknown;
  declare errorMessage: string | null;
  declare errorStack: string | null;
  declare attemptsMade: CreationOptional<number>;
  declare failedAt: CreationOptional<Date>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

FailedJob.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    queue: { type: DataTypes.STRING, allowNull: false },
    jobId: { type: DataTypes.STRING, allowNull: true },
    payload: { type: DataTypes.JSONB, allowNull: false },
    errorMessage: { type: DataTypes.TEXT, allowNull: true },
    errorStack: { type: DataTypes.TEXT, allowNull: true },
    attemptsMade: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    failedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'FailedJob', tableName: 'failed_jobs', underscored: true },
);
