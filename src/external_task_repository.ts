import * as moment from 'moment';
import * as Sequelize from 'sequelize';

import {NotFoundError} from '@essential-projects/errors_ts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {getConnection} from '@essential-projects/sequelize_connection_manager';
import {
  ExternalTask,
  ExternalTaskState,
  IExternalTaskRepository,
} from '@process-engine/external_task_api_contracts';

import {loadModels} from './model_loader';
import {ExternalTaskModel, IExternalTask} from './schemas';

export class ExternalTaskRepository implements IExternalTaskRepository {

  public config: Sequelize.Options;

  private _externalTaskModel: Sequelize.Model<ExternalTaskModel, IExternalTask>;

  private sequelize: Sequelize.Sequelize;

  private get externalTaskModel(): Sequelize.Model<ExternalTaskModel, IExternalTask> {
    return this._externalTaskModel;
  }

  public async initialize(): Promise<void> {
    this.sequelize = await getConnection(this.config);
    this._externalTaskModel = await loadModels(this.sequelize);
  }

  public async create<TPayloadType>(
    topic: string,
    correlationId: string,
    processModelId: string,
    processInstanceId: string,
    flowNodeInstanceId: string,
    identity: IIdentity,
    payload: TPayloadType,
  ): Promise<void> {

    const createParams: any = {
      topic: topic,
      correlationId: correlationId,
      processModelId: processModelId,
      processInstanceId: processInstanceId,
      flowNodeInstanceId: flowNodeInstanceId,
      identity: JSON.stringify(identity),
      payload: JSON.stringify(payload),
      isFinished: false,
    };

    await this.externalTaskModel.create(createParams);
  }

  public async getById<TPayloadType>(externalTaskId: string): Promise<ExternalTask<TPayloadType>> {

    const result: ExternalTaskModel = await this.externalTaskModel.findOne({
      where: {
        id: externalTaskId,
      },
    });

    if (!result) {
      throw new NotFoundError(`ExternalTask with ID ${externalTaskId} not found.`);
    }

    const externalTask: ExternalTask<TPayloadType> = this._convertToRuntimeObject<TPayloadType>(result);

    return externalTask;
  }

  public async fetchAvailableForProcessing<TPayloadType>(
    topicName: string,
    maxTasks: number,
  ): Promise<Array<ExternalTask<TPayloadType>>> {

    const now: Date = moment().toDate();

    const options: Sequelize.FindOptions<IExternalTask> = {
      where: {
        topic: topicName,
        state: ExternalTaskState.pending,
        lockExpirationTime: {
          [Sequelize.Op.or]: [
            {[Sequelize.Op.eq]: null},
            {[Sequelize.Op.lt]: now},
          ],
        },
      },
    };

    if (maxTasks > 0) {
      options.limit = maxTasks;
    }

    const results: Array<ExternalTaskModel> = await this.externalTaskModel.findAll(options);

    const externalTasks: Array<ExternalTask<TPayloadType>> = results.map(this._convertToRuntimeObject.bind(this));

    return externalTasks;
  }

  public async lockForWorker(workerId: string, externalTaskId: string, exprationTime: Date): Promise<void> {

    const externalTask: ExternalTaskModel = await this.externalTaskModel.findOne({
      where: {
        id: externalTaskId,
      },
    });

    if (!externalTask) {
      throw new NotFoundError(`ExternalTask with ID ${externalTaskId} not found.`);
    }

    externalTask.workerId = workerId;
    externalTask.lockExpirationTime = exprationTime;

    await externalTask.save();
  }

  public async deleteExternalTasksByProcessModelId(processModelId: string): Promise<void> {
    const queryParams: Sequelize.DestroyOptions = {
      where: {
        processModelId: processModelId,
      },
    };

    this.externalTaskModel.destroy(queryParams);
  }

  public async finishWithError(externalTaskId: string, error: Error): Promise<void> {

    const externalTask: ExternalTaskModel = await this.externalTaskModel.findOne({
      where: {
        id: externalTaskId,
      },
    });

    externalTask.error = JSON.stringify(error);
    externalTask.state = ExternalTaskState.finished;
    externalTask.finishedAt = moment().toDate();
    await externalTask.save();
  }

  public async finishWithSuccess(externalTaskId: string, result: any): Promise<void> {

    const externalTask: ExternalTaskModel = await this.externalTaskModel.findOne({
      where: {
        id: externalTaskId,
      },
    });

    externalTask.result = JSON.stringify(result);
    externalTask.state = ExternalTaskState.finished;
    externalTask.finishedAt = moment().toDate();
    await externalTask.save();
  }

  /**
   * Mapper function.
   * Creates an ExternalTask object that is usable by the ProcessEngine.
   *
   * @async
   * @param   dataModel The ExternalTaskModel to convert.
   * @returns           An ExternalTask object usable by the ProcessEngine.
   */
  private _convertToRuntimeObject<TPayloadType>(dataModel: ExternalTaskModel): ExternalTask<TPayloadType> {

    const [identity, payload, result, error] = this._sanitizeDataModel(dataModel);

    const externalTask: ExternalTask<TPayloadType> = new ExternalTask<TPayloadType>();
    externalTask.id = dataModel.id;
    externalTask.workerId = dataModel.workerId;
    externalTask.topic = dataModel.topic;
    externalTask.flowNodeInstanceId = dataModel.flowNodeInstanceId;
    externalTask.correlationId = dataModel.correlationId;
    externalTask.processModelId = dataModel.processModelId;
    externalTask.processInstanceId = dataModel.processInstanceId;
    externalTask.identity = identity;
    externalTask.payload = payload;
    externalTask.lockExpirationTime = dataModel.lockExpirationTime;
    externalTask.state = ExternalTaskState[dataModel.state];
    externalTask.finishedAt = dataModel.finishedAt;
    externalTask.error = error;
    externalTask.result = result;
    externalTask.createdAt = dataModel.createdAt;

    return externalTask;
  }

  private _sanitizeDataModel(dataModel: ExternalTaskModel): Array<any> {
    const identity: any = dataModel.identity
      ? JSON.parse(dataModel.identity)
      : undefined;

    const payload: any = dataModel.payload
      ? JSON.parse(dataModel.payload)
      : undefined;

    const result: any = dataModel.result
      ? JSON.parse(dataModel.result)
      : undefined;

    const error: any = dataModel.error
      ? JSON.parse(dataModel.error)
      : undefined;

    return [identity, payload, result, error];
  }
}
