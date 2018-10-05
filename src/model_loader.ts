import * as Sequelize from 'sequelize';

import {IExternalTask} from '@process-engine/external_task_api_contracts';

import {
  defineExternalTask,
  ExternalTaskDefinition,
} from './schemas/index';

export async function loadModels(sequelizeInstance: Sequelize.Sequelize): Promise<Sequelize.Model<ExternalTaskDefinition, IExternalTask>> {

  const externalTaskModel: Sequelize.Model<ExternalTaskDefinition, IExternalTask> = defineExternalTask(sequelizeInstance);

  await sequelizeInstance.sync();

  return externalTaskModel;
}
