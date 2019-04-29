import {AllowNull, Column, CreatedAt, DataType, Model, Table, UpdatedAt} from 'sequelize-typescript';

@Table({modelName: 'ExternalTask', tableName: 'ExternalTask', version: true})
export class ExternalTaskModel extends Model<ExternalTaskModel> {

  @Column
  @AllowNull(false)
  public externalTaskId: string;

  @Column
  @AllowNull(true)
  public workerId: string;

  @Column
  @AllowNull(false)
  public topic: string;

  @Column
  @AllowNull(false)
  public flowNodeInstanceId: string;

  @Column
  @AllowNull(false)
  public correlationId: string;

  @Column
  @AllowNull(false)
  public processModelId: string;

  @Column
  @AllowNull(false)
  public processInstanceId: string;

  @Column
  @AllowNull(true)
  public lockExpirationTime: Date;

  @Column(DataType.TEXT)
  @AllowNull(true)
  public identity: string;

  @Column(DataType.TEXT)
  @AllowNull(true)
  public payload: string;

  @Column({defaultValue: 'pending'})
  @AllowNull(false)
  public state: string;

  @Column
  @AllowNull(true)
  public finishedAt: Date;

  @Column(DataType.TEXT)
  @AllowNull(true)
  public result: string;

  @Column(DataType.TEXT)
  @AllowNull(true)
  public error: string;

  @CreatedAt
  public createdAt?: Date;

  @UpdatedAt
  public updatedAt?: Date;
}
