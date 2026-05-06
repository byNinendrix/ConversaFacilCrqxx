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
  Default,
  HasMany
} from "sequelize-typescript";
import Company from "./Company";
import CompanyServiceAvailability from "./CompanyServiceAvailability";
import ServiceBooking from "./ServiceBooking";
import CompanyServiceProfessional from "./CompanyServiceProfessional";
import CompanyServiceSpecificSlot from "./CompanyServiceSpecificSlot";

@Table({
  tableName: "CompanyServices"
})
class CompanyService extends Model<CompanyService> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  name: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true
  })
  description: string;

  @Default(true)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false
  })
  isActive: boolean;

  @Default(true)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false
  })
  showPrice: boolean;

  @Default(0)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  displayOrder: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  })
  price: number;

  @Default(30)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  durationMinutes: number;

  @Default(0)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  intervalMinutes: number;

  @Default(60)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  minAdvanceMinutes: number;

  @Default(30)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  maxAdvanceDays: number;

  @Default(1)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  maxBookingsPerSlot: number;

  @Default("automatic")
  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  assignmentMode: string;

  @HasMany(() => CompanyServiceAvailability, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  availabilities: CompanyServiceAvailability[];

  @HasMany(() => CompanyServiceSpecificSlot, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  specificSlots: CompanyServiceSpecificSlot[];

  @HasMany(() => CompanyServiceProfessional, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  professionals: CompanyServiceProfessional[];

  @HasMany(() => ServiceBooking, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  bookings: ServiceBooking[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CompanyService;
