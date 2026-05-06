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

import FlowVersion from "./FlowVersion";

@Table
class FlowNode extends Model<FlowNode> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => FlowVersion)
  @Column
  flowVersionId: number;

  @BelongsTo(() => FlowVersion)
  flowVersion: FlowVersion;

  @Column
  nodeKey: string;

  @Column
  nodeType: string;

  @Column
  label: string;

  @Column
  positionX: number;

  @Column
  positionY: number;

  @Column({ type: DataType.JSON })
  configJson: any;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FlowNode;

