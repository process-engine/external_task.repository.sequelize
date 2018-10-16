import * as Sequelize from 'sequelize';

import {IIdentity} from '@essential-projects/iam_contracts';

export interface IExternalTask {
  id: string;
  workerId?: string;
  topic: string;
  flowNodeInstanceId: string;
  correlationId: string;
  processInstanceId: string;
  lockExpirationTime?: Date;
  identity: string;
  payload: any;
  state: string;
  finishedAt?: Date;
  result?: any;
  error?: any;
  createdAt?: Date;
}

export type ExternalTaskModel = Sequelize.Instance<IExternalTask> & IExternalTask;

export function defineExternalTask(sequelize: Sequelize.Sequelize): Sequelize.Model<ExternalTaskModel, IExternalTask> {
  const attributes: SequelizeAttributes<IExternalTask> = {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
    },
    workerId: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    topic: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    flowNodeInstanceId: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    correlationId: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    processInstanceId: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    lockExpirationTime: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    identity: {
      // Note: Sequelize.STRING equals varchar(255).
      // Depending on the type of token used, this can easily exceed 255 chars.
      type: Sequelize.TEXT,
      allowNull: false,
    },
    payload: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    state: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'pending',
    },
    finishedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    result: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    error: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  };

  return sequelize.define<ExternalTaskModel, IExternalTask>('ExternalTask', attributes);
}
