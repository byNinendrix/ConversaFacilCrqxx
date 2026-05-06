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

import Company from "./Company";
import Flow from "./Flow";
import FlowVersion from "./FlowVersion";

@Table
class FlowBinding extends Model<FlowBinding> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Flow)
  @Column
  flowId: number;

  @BelongsTo(() => Flow)
  flow: Flow;

  @ForeignKey(() => FlowVersion)
  @Column
  flowVersionId: number;

  @BelongsTo(() => FlowVersion)
  flowVersion: FlowVersion;

  @Column
  channel: string;

  @Column
  event: string;

  @Column
  whatsappId: number;

  @Column
  queueId: number;

  @Column
  keywordStart: string;

  @Column
  priority: number;

  @Column
  isActive: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FlowBinding;

