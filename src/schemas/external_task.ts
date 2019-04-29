import {AllowNull, Column, CreatedAt, DataType, Model, Table, UpdatedAt} from 'sequelize-typescript';

@Table({modelName: 'ExternalTask', version: true})
export class ExternalTaskModel extends Model<ExternalTaskModel> {

  @Column
  @AllowNull(false)
  public externalTaskId: string;

  @Column
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
  public lockExpirationTime: Date;

  @Column(DataType.TEXT)
  public identity: string;

  @Column(DataType.TEXT)
  public payload: string;

  @Column({defaultValue: 'pending'})
  @AllowNull(false)
  public state: string;

  @Column
  public finishedAt: Date;

  @Column(DataType.TEXT)
  public result: string;

  @Column(DataType.TEXT)
  public error: string;

  @CreatedAt
  public createdAt?: Date;

  @UpdatedAt
  public updatedAt?: Date;
}
