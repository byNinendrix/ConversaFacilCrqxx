import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";

import FlowVersion from "./FlowVersion";

@Table
class FlowEdge extends Model<FlowEdge> {
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
  sourceNodeKey: string;

  @Column
  sourceHandle: string;

  @Column
  targetNodeKey: string;

  @Column
  conditionType: string;

  @Column
  conditionValue: string;

  @Column
  priority: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FlowEdge;

