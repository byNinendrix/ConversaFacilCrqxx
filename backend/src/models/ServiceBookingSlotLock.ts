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
import CompanyService from "./CompanyService";
import User from "./User";

@Table({
  tableName: "ServiceBookingSlotLocks"
})
class ServiceBookingSlotLock extends Model<ServiceBookingSlotLock> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => CompanyService)
  @Column
  companyServiceId: number;

  @BelongsTo(() => CompanyService)
  companyService: CompanyService;

  @ForeignKey(() => User)
  @Column
  professionalId: number | null;

  @BelongsTo(() => User)
  professional: User;

  @Column({
    type: DataType.DATE,
    allowNull: false
  })
  startAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false
  })
  expiresAt: Date;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  resourceKey: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ServiceBookingSlotLock;
