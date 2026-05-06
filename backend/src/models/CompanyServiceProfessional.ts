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
  tableName: "CompanyServiceProfessionals"
})
class CompanyServiceProfessional extends Model<CompanyServiceProfessional> {
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
  userId: number;

  @BelongsTo(() => User)
  professional: User;

  @Default(0)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  priority: number;

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

export default CompanyServiceProfessional;

