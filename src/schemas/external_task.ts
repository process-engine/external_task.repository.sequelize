import {AllowNull, Column, CreatedAt, DataType, Model, Table, UpdatedAt} from 'sequelize-typescript';

@Table({modelName: 'ExternalTask', tableName: 'ExternalTasks', version: true})
export class ExternalTaskModel extends Model<ExternalTaskModel> {

  @AllowNull(false)
  @Column
  public externalTaskId: string;

  @AllowNull(true)
  @Column
  public workerId: string;

  @AllowNull(false)
  @Column
  public topic: string;

  @AllowNull(false)
  @Column
  public flowNodeInstanceId: string;

  @AllowNull(false)
  @Column
  public correlationId: string;

  @AllowNull(false)
  @Column
  public processModelId: string;

  @AllowNull(false)
  @Column
  public processInstanceId: string;

  @AllowNull(true)
  @Column
  public lockExpirationTime: Date;

  @AllowNull(false)
  @Column(DataType.TEXT)
  public identity: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  public payload: string;

  @AllowNull(false)
  @Column({defaultValue: 'pending'})
  public state: string;

  @AllowNull(true)
  @Column
  public finishedAt: Date;

  @AllowNull(true)
  @Column(DataType.TEXT)
  public result: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  public error: string;

  @CreatedAt
  public createdAt?: Date;

  @UpdatedAt
  public updatedAt?: Date;
}
