import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType
} from "sequelize-typescript";

import Company from "./Company";
import FlowExecution from "./FlowExecution";

@Table
class FlowExecutionEvent extends Model<FlowExecutionEvent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => FlowExecution)
  @Column
  executionId: number;

  @BelongsTo(() => FlowExecution)
  execution: FlowExecution;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  nodeKey: string;

  @Column
  actionType: string;

  @Column({ type: DataType.JSON })
  payloadJson: any;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FlowExecutionEvent;

