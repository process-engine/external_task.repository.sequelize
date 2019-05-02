import {Logger} from 'loggerhythm';
import * as moment from 'moment';
import * as uuid from 'node-uuid';

import {DestroyOptions, FindOptions, Op as Operators} from 'sequelize';
import {Sequelize, SequelizeOptions} from 'sequelize-typescript';

import {IDisposable} from '@essential-projects/bootstrapper_contracts';
import {BaseError, isEssentialProjectsError, NotFoundError} from '@essential-projects/errors_ts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {SequelizeConnectionManager} from '@essential-projects/sequelize_connection_manager';
import {
  ExternalTask,
  ExternalTaskState,
  IExternalTaskRepository,
} from '@process-engine/external_task_api_contracts';

import {ExternalTaskModel} from './schemas';

const logger: Logger = new Logger('processengine:persistence:external_task_repository');

export class ExternalTaskRepository implements IExternalTaskRepository, IDisposable {

  public config: SequelizeOptions;

  private _sequelize: Sequelize;
  private _connectionManager: SequelizeConnectionManager;

  constructor(connectionManager: SequelizeConnectionManager) {
    this._connectionManager = connectionManager;
  }

  public async initialize(): Promise<void> {
    logger.verbose('Initializing Sequelize connection and loading models...');
    const connectionAlreadyEstablished: boolean = this._sequelize !== undefined;
    if (connectionAlreadyEstablished) {
      logger.verbose('Repository already initialized. Done.');

      return;
    }
    this._sequelize = await this._connectionManager.getConnection(this.config);

    this._sequelize.addModels([ExternalTaskModel]);
    await this._sequelize.sync();

    logger.verbose('Done.');
  }

  public async dispose(): Promise<void> {
    logger.verbose('Disposing connection');
    await this._connectionManager.destroyConnection(this.config);
    this._sequelize = undefined;
    logger.verbose('Done.');
  }

  public async create<TPayload>(topic: string,
                                correlationId: string,
                                processModelId: string,
                                processInstanceId: string,
                                flowNodeInstanceId: string,
                                identity: IIdentity,
                                payload: TPayload,
                              ): Promise<void> {

    const createParams: any = {
      externalTaskId: uuid.v4(),
      topic: topic,
      correlationId: correlationId,
      processModelId: processModelId,
      processInstanceId: processInstanceId,
      flowNodeInstanceId: flowNodeInstanceId,
      identity: JSON.stringify(identity),
      payload: JSON.stringify(payload),
      isFinished: false,
    };

    await ExternalTaskModel.create(createParams);
  }

  public async getById<TPayload>(externalTaskId: string): Promise<ExternalTask<TPayload>> {

    const result: ExternalTaskModel = await ExternalTaskModel.findOne({
      where: {
        externalTaskId: externalTaskId,
      },
    });

    if (!result) {
      throw new NotFoundError(`ExternalTask with ID ${externalTaskId} not found.`);
    }

    const externalTask: ExternalTask<TPayload> = this._convertToRuntimeObject<TPayload>(result);

    return externalTask;
  }

  public async getByInstanceIds<TPayload>(correlationId: string,
                                          processInstanceId: string,
                                          flowNodeInstanceId: string,
                                        ): Promise<ExternalTask<TPayload>> {

    const result: ExternalTaskModel = await ExternalTaskModel.findOne({
      where: {
        correlationId: correlationId,
        processInstanceId: processInstanceId,
        flowNodeInstanceId: flowNodeInstanceId,
      },
    });

    if (!result) {
      // tslint:disable-next-line:max-line-length
      const error: string = `No ExternalTask with correlationId ${correlationId}, processInstanceId ${processInstanceId} and flowNodeInstanceId ${flowNodeInstanceId} found.`;
      throw new NotFoundError(error);
    }

    const externalTask: ExternalTask<TPayload> = this._convertToRuntimeObject<TPayload>(result);

    return externalTask;
  }

  public async fetchAvailableForProcessing<TPayload>(topicName: string, maxTasks: number): Promise<Array<ExternalTask<TPayload>>> {

    const now: Date = moment().toDate();

    const options: FindOptions = {
      where: {
        topic: topicName,
        state: ExternalTaskState.pending,
        lockExpirationTime: {
          [Operators.or]: [
            {[Operators.eq]: null},
            {[Operators.lt]: now},
          ],
        },
      },
    };

    if (maxTasks > 0) {
      options.limit = maxTasks;
    }

    const results: Array<ExternalTaskModel> = await ExternalTaskModel.findAll(options);

    const externalTasks: Array<ExternalTask<TPayload>> = results.map(this._convertToRuntimeObject.bind(this));

    return externalTasks;
  }

  public async lockForWorker(workerId: string, externalTaskId: string, exprationTime: Date): Promise<void> {

    const externalTask: ExternalTaskModel = await ExternalTaskModel.findOne({
      where: {
        externalTaskId: externalTaskId,
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
    const queryParams: DestroyOptions = {
      where: {
        processModelId: processModelId,
      },
    };

    ExternalTaskModel.destroy(queryParams);
  }

  public async finishWithError(externalTaskId: string, error: Error): Promise<void> {

    const externalTask: ExternalTaskModel = await ExternalTaskModel.findOne({
      where: {
        externalTaskId: externalTaskId,
      },
    });

    externalTask.error = this._serializeError(error);
    externalTask.state = ExternalTaskState.finished;
    externalTask.finishedAt = moment().toDate();
    await externalTask.save();
  }

  public async finishWithSuccess(externalTaskId: string, result: any): Promise<void> {

    const externalTask: ExternalTaskModel = await ExternalTaskModel.findOne({
      where: {
        externalTaskId: externalTaskId,
      },
    });

    externalTask.result = JSON.stringify(result);
    externalTask.state = ExternalTaskState.finished;
    externalTask.finishedAt = moment().toDate();
    await externalTask.save();
  }

  private _serializeError(error: any): string {

    const errorIsFromEssentialProjects: boolean = isEssentialProjectsError(error);
    if (errorIsFromEssentialProjects) {
      return (error as BaseError).serialize();
    }

    const errorIsString: boolean = typeof error === 'string';
    if (errorIsString) {
      return error;
    }

    return JSON.stringify(error);
  }

  /**
   * Mapper function.
   * Creates an ExternalTask object that is usable by the ProcessEngine.
   *
   * @async
   * @param   dataModel The ExternalTaskModel to convert.
   * @returns           An ExternalTask object usable by the ProcessEngine.
   */
  private _convertToRuntimeObject<TPayload>(dataModel: ExternalTaskModel): ExternalTask<TPayload> {

    const [identity, payload, result, error] = this._sanitizeDataModel(dataModel);

    const externalTask: ExternalTask<TPayload> = new ExternalTask<TPayload>();
    externalTask.id = dataModel.externalTaskId;
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
      ? this._tryParse(dataModel.identity)
      : undefined;

    const payload: any = dataModel.payload
      ? this._tryParse(dataModel.payload)
      : undefined;

    const result: any = dataModel.result
      ? this._tryParse(dataModel.result)
      : undefined;

    let error: Error;

    const dataModelHasError: boolean = dataModel.error !== undefined;
    if (dataModelHasError) {

      const essentialProjectsError: Error = this._tryDeserializeEssentialProjectsError(dataModel.error);

      const errorIsFromEssentialProjects: boolean = essentialProjectsError !== undefined;

      error = errorIsFromEssentialProjects
        ? essentialProjectsError
        : this._tryParse(dataModel.error);
    }

    return [identity, payload, result, error];
  }

  private _tryParse(value: string): any {
    try {
      return JSON.parse(value);
    } catch (error) {
      // Value is not a JSON - return it as it is.
      return value;
    }
  }

  private _tryDeserializeEssentialProjectsError(value: string): Error {
    try {
      return BaseError.deserialize(value);
    } catch (error) {
      return undefined;
    }
  }
}
