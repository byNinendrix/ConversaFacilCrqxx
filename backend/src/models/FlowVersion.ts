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
  HasMany,
  DataType
} from "sequelize-typescript";

import Company from "./Company";
import Flow from "./Flow";
import FlowNode from "./FlowNode";
import FlowEdge from "./FlowEdge";

@Table
class FlowVersion extends Model<FlowVersion> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Flow)
  @Column
  flowId: number;

  @BelongsTo(() => Flow)
  flow: Flow;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  version: number;

  @Column
  state: string;

  @Column
  publishedBy: number;

  @Column
  publishedAt: Date;

  @Column({ type: DataType.JSON })
  graphJson: any;

  @Column({ type: DataType.JSON })
  compiledJson: any;

  @HasMany(() => FlowNode)
  nodes: FlowNode[];

  @HasMany(() => FlowEdge)
  edges: FlowEdge[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FlowVersion;

