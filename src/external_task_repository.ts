import * as bluebird from 'bluebird';
import * as moment from 'moment';
import * as Sequelize from 'sequelize';

import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {getConnection} from '@essential-projects/sequelize_connection_manager';

import {ExternalTask, IExternalTask, IExternalTaskRepository} from '@process-engine/external_task_api_contracts';

import {loadModels} from './model_loader';
import {ExternalTaskModel} from './schemas';

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

  public async create(topic: string, correlationId: string, processInstanceId: string, flowNodeInstanceId: string, payload: any): Promise<void> {

    const createParams: any = {
      topic: topic,
      correlationId: correlationId,
      processInstanceId: processInstanceId,
      flowNodeInstanceId: flowNodeInstanceId,
      payload: JSON.stringify(payload),
      isFinished: false,
    };

    await this.externalTaskModel.create(createParams);
  }

  public async fetchAndLockExternalTasks(workerId: string,
                                         topicName: string,
                                         maxTasks: number,
                                         lockDurationInMs: number): Promise<Array<ExternalTask>> {

    const options: Sequelize.FindOptions<IExternalTask> = {
      where: {
        topic: topicName,
        isFinished: false,
        lockExpirationTime: {
          [Sequelize.Op.lt]: moment().toDate(),
        },
      },
    };

    if (maxTasks > 0) {
      options.limit = maxTasks;
    }

    const results: Array<ExternalTaskModel> = await this.externalTaskModel.findAll(options);

    if (!results || results.length === 0) {
      return [];
    }

    const lockExpirationTime: Date = moment().add(lockDurationInMs, 'milliseconds').toDate();

    const externalTasks: Array<ExternalTask> =
      await bluebird.map(results, async(externalTask: ExternalTaskModel): Promise<ExternalTask> => {
        return this._lockAndConvertExternalTask(externalTask, workerId, lockExpirationTime);
      });

    return externalTasks;
  }

  public async extendLock(workerId: string, externalTaskId: string, additionalDuration: number): Promise<void> {

    const externalTask: ExternalTaskModel = await this.externalTaskModel.findOne({
      where: {
        id: externalTaskId,
      },
    });

    this._ensureExternalTaskCanBeAccessedByWorker(externalTask, externalTaskId, workerId);

    const newExpirationTime: Date = moment().add(additionalDuration, 'milliseconds').toDate();

    externalTask.lockExpirationTime = newExpirationTime;
    await externalTask.save();
  }

  public async handleBpmnError(workerId: string, externalTaskId: string, errorCode: string): Promise<void> {

    const externalTask: ExternalTaskModel = await this.externalTaskModel.findOne({
      where: {
        id: externalTaskId,
      },
    });

    this._ensureExternalTaskCanBeAccessedByWorker(externalTask, externalTaskId, workerId);

    const error: EssentialProjectErrors.InternalServerError =
      new EssentialProjectErrors.InternalServerError(`ExternalTask failed due to BPMN error with code ${errorCode}`);

    externalTask.error = JSON.stringify(error);
    externalTask.isFinished = true;
    externalTask.finishedAt = moment().toDate();
    await externalTask.save();
  }

  public async handleServiceError(workerId: string, externalTaskId: string, errorMessage: string, errorDetails: string): Promise<void> {

    const externalTask: ExternalTaskModel = await this.externalTaskModel.findOne({
      where: {
        id: externalTaskId,
      },
    });

    this._ensureExternalTaskCanBeAccessedByWorker(externalTask, externalTaskId, workerId);

    const error: EssentialProjectErrors.InternalServerError =
      new EssentialProjectErrors.InternalServerError(errorMessage);

    error.additionalInformation = errorDetails;

    externalTask.error = JSON.stringify(error);
    externalTask.isFinished = true;
    externalTask.finishedAt = moment().toDate();
    await externalTask.save();
  }

  public async finishExternalTask(workerId: string, externalTaskId: string, result: any): Promise<void> {

    const externalTask: ExternalTaskModel = await this.externalTaskModel.findOne({
      where: {
        id: externalTaskId,
      },
    });

    this._ensureExternalTaskCanBeAccessedByWorker(externalTask, externalTaskId, workerId);

    externalTask.result = JSON.stringify(result);
    externalTask.isFinished = true;
    externalTask.finishedAt = moment().toDate();
    await externalTask.save();
  }

  /**
   * Ensures that the given worker is authorized to access the given ExternalTask.
   *
   * @param externalTask   The ExternalTask for which to validate access rights.
   * @param externalTaskId The ExternalTaskID the worker attempted to query.
   * @param workerId       The ID of the worker attempting to manipulate the
   *                       ExternalTask.
   */
  private _ensureExternalTaskCanBeAccessedByWorker(externalTask: ExternalTaskModel, externalTaskId: string, workerId: string): void {

    if (!externalTask) {
      throw new EssentialProjectErrors.NotFoundError(`External Task with ID '${externalTaskId}' not found.`);
    }

    if (externalTask.isFinished) {
      throw new EssentialProjectErrors.GoneError(`External Task with ID '${externalTaskId}' has been finished and is no longer accessible.`);
    }

    const now: moment.Moment = moment();
    const taskReleaseTime: moment.Moment = moment(externalTask.lockExpirationTime);

    const externalTaskIsLockedByOtherWorker: boolean = externalTask.workerId !== workerId && now.isBefore(taskReleaseTime);
    if (externalTaskIsLockedByOtherWorker) {
      const msg: string = `External Task with ID '${externalTaskId}' is locked by another worker, until ${taskReleaseTime.toISOString()}.`;
      throw new EssentialProjectErrors.LockedError(msg);
    }
  }

  /**
   * Mapper function.
   * Locks the given external task for the given Worker until the given
   * expiration time.
   * Afterwards, an ExternalTask object that is usable by the ProcessEngine
   * is returned.
   *
   * @async
   * @param   externalTask       The ExternalTask to lock and convert.
   * @param   workerId           The ID of the worker for which to lock the
   *                             ExternalTask.
   * @param   lockExpirationTime The time at which to lock will be released.
   * @returns                    An ExternalTask object usable by the
   *                             ProcessEngine.
   */
  private async _lockAndConvertExternalTask(externalTask: ExternalTaskModel, workerId: string, lockExpirationTime: Date): Promise<ExternalTask> {

    await this._lockExternalTask(externalTask.id, workerId, lockExpirationTime);

    externalTask.workerId = workerId;
    externalTask.lockExpirationTime = lockExpirationTime;

    return this._convertToRuntimeObject(externalTask);
  }

  /**
   * Locks the given external task for the given Worker until the given
   * expiration time.
   *
   * @async
   * @param workerId           The ID of the worker for which to lock the
   *                           ExternalTask.
   * @param externalTaskId     The ID of the ExternalTask to lock.
   * @param lockExpirationTime The time at which to lock will be released.
   */
  private async _lockExternalTask(externalTaskId: string, workerId: string, lockExpirationTime: Date): Promise<void> {

    await this.externalTaskModel.update({
        workerId: workerId,
        lockExpirationTime: lockExpirationTime,
      }, {
        where: {
          id: externalTaskId,
        },
      },
    );
  }

  /**
   * Mapper function.
   * Creates an ExternalTask object that is usable by the ProcessEngine.
   *
   * @async
   * @param   dataModel The ExternalTaskModel to convert.
   * @returns           An ExternalTask object usable by the ProcessEngine.
   */
  private _convertToRuntimeObject(dataModel: ExternalTaskModel): ExternalTask {

    const payload: any = dataModel.payload
      ? JSON.parse(dataModel.payload)
      : undefined;

    const result: any = dataModel.result
      ? JSON.parse(dataModel.result)
      : undefined;

    const error: any = dataModel.error
      ? JSON.parse(dataModel.error)
      : undefined;

    const externalTask: ExternalTask = new ExternalTask(dataModel.id,
                                                        dataModel.workerId,
                                                        dataModel.topic,
                                                        dataModel.flowNodeInstanceId,
                                                        dataModel.correlationId,
                                                        dataModel.processInstanceId,
                                                        payload,
                                                        dataModel.lockExpirationTime,
                                                        dataModel.isFinished,
                                                        dataModel.finishedAt,
                                                        error,
                                                        result,
                                                        dataModel.createdAt);

    return externalTask;
  }
}
