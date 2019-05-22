/* eslint-disable @typescript-eslint/no-explicit-any */
import {Logger} from 'loggerhythm';
import * as moment from 'moment';
import * as uuid from 'node-uuid';

import {DestroyOptions, FindOptions, Op as Operators} from 'sequelize';
import {Sequelize, SequelizeOptions} from 'sequelize-typescript';

import {IDisposable} from '@essential-projects/bootstrapper_contracts';
import {BaseError, NotFoundError, isEssentialProjectsError} from '@essential-projects/errors_ts';
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

  private sequelizeInstance: Sequelize;
  private connectionManager: SequelizeConnectionManager;

  constructor(connectionManager: SequelizeConnectionManager) {
    this.connectionManager = connectionManager;
  }

  public async initialize(): Promise<void> {
    logger.verbose('Initializing Sequelize connection and loading models...');
    const connectionAlreadyEstablished = this.sequelizeInstance !== undefined;
    if (connectionAlreadyEstablished) {
      logger.verbose('Repository already initialized. Done.');

      return;
    }
    this.sequelizeInstance = await this.connectionManager.getConnection(this.config);

    this.sequelizeInstance.addModels([ExternalTaskModel]);
    await this.sequelizeInstance.sync();

    logger.verbose('Done.');
  }

  public async dispose(): Promise<void> {
    logger.verbose('Disposing connection');
    await this.connectionManager.destroyConnection(this.config);
    this.sequelizeInstance = undefined;
    logger.verbose('Done.');
  }

  public async create<TPayload>(
    topic: string,
    correlationId: string,
    processModelId: string,
    processInstanceId: string,
    flowNodeInstanceId: string,
    identity: IIdentity,
    payload: TPayload,
  ): Promise<void> {

    const createParams = {
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

    const result = await ExternalTaskModel.findOne({
      where: {
        externalTaskId: externalTaskId,
      },
    });

    if (!result) {
      throw new NotFoundError(`ExternalTask with ID ${externalTaskId} not found.`);
    }

    const externalTask = this.convertToRuntimeObject<TPayload>(result);

    return externalTask;
  }

  public async getByInstanceIds<TPayload>(
    correlationId: string,
    processInstanceId: string,
    flowNodeInstanceId: string,
  ): Promise<ExternalTask<TPayload>> {

    const result = await ExternalTaskModel.findOne({
      where: {
        correlationId: correlationId,
        processInstanceId: processInstanceId,
        flowNodeInstanceId: flowNodeInstanceId,
      },
    });

    if (!result) {
      // eslint-disable-next-line max-len
      const error = `No ExternalTask with correlationId ${correlationId}, processInstanceId ${processInstanceId} and flowNodeInstanceId ${flowNodeInstanceId} found.`;
      throw new NotFoundError(error);
    }

    const externalTask = this.convertToRuntimeObject<TPayload>(result);

    return externalTask;
  }

  public async fetchAvailableForProcessing<TPayload>(topicName: string, maxTasks: number): Promise<Array<ExternalTask<TPayload>>> {

    const now = moment().toDate();

    const options: FindOptions = {
      where: {
        topic: topicName,
        state: ExternalTaskState.pending,
        lockExpirationTime: {
          [Operators.or]: [
            // Null-values are stored and retrieved as null, so null-checks are required here.
            // eslint-disable-next-line no-null/no-null
            {[Operators.eq]: null},
            {[Operators.lt]: now},
          ],
        },
      },
    };

    if (maxTasks > 0) {
      options.limit = maxTasks;
    }

    const results = await ExternalTaskModel.findAll(options);

    const externalTasks = results.map<ExternalTask<TPayload>>(this.convertToRuntimeObject.bind(this));

    return externalTasks;
  }

  public async lockForWorker(workerId: string, externalTaskId: string, exprationTime: Date): Promise<void> {

    const externalTask = await ExternalTaskModel.findOne({
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

    const externalTask = await ExternalTaskModel.findOne({
      where: {
        externalTaskId: externalTaskId,
      },
    });

    externalTask.error = this.serializeError(error);
    externalTask.state = ExternalTaskState.finished;
    externalTask.finishedAt = moment().toDate();
    await externalTask.save();
  }

  public async finishWithSuccess(externalTaskId: string, result: any): Promise<void> {

    const externalTask = await ExternalTaskModel.findOne({
      where: {
        externalTaskId: externalTaskId,
      },
    });

    externalTask.result = JSON.stringify(result);
    externalTask.state = ExternalTaskState.finished;
    externalTask.finishedAt = moment().toDate();
    await externalTask.save();
  }

  private serializeError(error: Error | string): string {

    const errorIsFromEssentialProjects = isEssentialProjectsError(error);
    if (errorIsFromEssentialProjects) {
      return (error as BaseError).serialize();
    }

    const errorIsString = typeof error === 'string';
    if (errorIsString) {
      return error as string;
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
  private convertToRuntimeObject<TPayload>(dataModel: ExternalTaskModel): ExternalTask<TPayload> {

    const [identity, payload, result, error] = this.sanitizeDataModel(dataModel);

    const externalTask = new ExternalTask<TPayload>();
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

  private sanitizeDataModel(dataModel: ExternalTaskModel): Array<any> {
    const identity = dataModel.identity
      ? this.tryParse(dataModel.identity)
      : undefined;

    const payload = dataModel.payload
      ? this.tryParse(dataModel.payload)
      : undefined;

    const result = dataModel.result
      ? this.tryParse(dataModel.result)
      : undefined;

    let error: Error;

    const dataModelHasError = dataModel.error !== undefined;
    if (dataModelHasError) {

      const essentialProjectsError: Error = this.tryDeserializeEssentialProjectsError(dataModel.error);

      const errorIsFromEssentialProjects = essentialProjectsError !== undefined;

      error = errorIsFromEssentialProjects
        ? essentialProjectsError
        : this.tryParse(dataModel.error);
    }

    return [identity, payload, result, error];
  }

  private tryParse(value: string): any {
    try {
      return JSON.parse(value);
    } catch (error) {
      // Value is not a JSON - return it as it is.
      return value;
    }
  }

  private tryDeserializeEssentialProjectsError(value: string): Error {
    try {
      return BaseError.deserialize(value);
    } catch (error) {
      return undefined;
    }
  }

}
