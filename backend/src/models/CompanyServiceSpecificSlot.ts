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
  DataType,
  Default
} from "sequelize-typescript";

import Company from "./Company";
import CompanyService from "./CompanyService";
import User from "./User";

@Table({
  tableName: "CompanyServiceSpecificSlots"
})
class CompanyServiceSpecificSlot extends Model<CompanyServiceSpecificSlot> {
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
    type: DataType.DATEONLY,
    allowNull: false
  })
  slotDate: string;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  startTime: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  endTime: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true
  })
  capacity: number | null;

  @Default(true)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false
  })
  isActive: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CompanyServiceSpecificSlot;
