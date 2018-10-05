import * as Sequelize from 'sequelize';

import {IExternalTask} from '@process-engine/external_task_api_contracts';

export type ExternalTaskDefinition = Sequelize.Instance<IExternalTask> & IExternalTask;

export function defineExternalTask(sequelize: Sequelize.Sequelize): Sequelize.Model<ExternalTaskDefinition, IExternalTask> {
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
    payload: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    isFinished: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: false,
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

  return sequelize.define<ExternalTaskDefinition, IExternalTask>('ExternalTask', attributes);
}
