import * as Sequelize from 'sequelize';

import {ExternalTaskState, IExternalTask} from '@process-engine/external_task_api_contracts';

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
    payload: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    state: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: ExternalTaskState.pending,
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
