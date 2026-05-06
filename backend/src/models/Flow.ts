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
  HasMany
} from "sequelize-typescript";

import Company from "./Company";
import FlowVersion from "./FlowVersion";
import FlowBinding from "./FlowBinding";

@Table
class Flow extends Model<Flow> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  name: string;

  @Column
  description: string;

  @Column
  status: string;

  @Column
  activeVersionId: number;

  @Column
  createdBy: number;

  @Column
  updatedBy: number;

  @HasMany(() => FlowVersion)
  versions: FlowVersion[];

  @HasMany(() => FlowBinding)
  bindings: FlowBinding[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Flow;

