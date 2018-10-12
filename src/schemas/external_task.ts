import * as Sequelize from 'sequelize';

export interface IExternalTask {
  id: string;
  workerId?: string;
  topic: string;
  flowNodeInstanceId: string;
  correlationId: string;
  processInstanceId: string;
  lockExpirationTime?: Date;
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
