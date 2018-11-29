import * as Sequelize from 'sequelize';

import {
  defineExternalTask,
  ExternalTaskModel,
  IExternalTask,
} from './schemas/index';

/**
 * Initializes the ExternalTaskModel model within the given Sequelize instance.
 *
 * @async
 * @param   sequelizeInstance The instance used to initialize the model.
 * @returns                   The initialized ExternalTaskModel.
 */
export async function loadModels(sequelizeInstance: Sequelize.Sequelize): Promise<Sequelize.Model<ExternalTaskModel, IExternalTask>> {

  const externalTaskModel: Sequelize.Model<ExternalTaskModel, IExternalTask> = defineExternalTask(sequelizeInstance);

  await sequelizeInstance.sync();

  return externalTaskModel;
}
