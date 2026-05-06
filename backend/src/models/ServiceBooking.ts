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
  BeforeCreate,
  BeforeUpdate,
  BeforeValidate
} from "sequelize-typescript";

import Company from "./Company";
import Whatsapp from "./Whatsapp";
import Contact from "./Contact";
import Ticket from "./Ticket";
import CompanyService from "./CompanyService";
import User from "./User";

@Table({
  tableName: "ServiceBookings"
})
class ServiceBooking extends Model<ServiceBooking> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

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

  @ForeignKey(() => User)
  @Column
  createdByUserId: number;

  @BelongsTo(() => User)
  createdByUser: User;

  @Column({
    type: DataType.DATE,
    allowNull: false
  })
  startAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  activeSlotStartAt: Date | null;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  activeSlotResourceKey: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: false
  })
  endAt: Date;

  @Default("scheduled")
  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  status: string;

  @Default("not_required")
  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  paymentStatus: string;

  @Default(0)
  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  depositAmount: number;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  paymentDueAt: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  paidAt: Date | null;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  paymentReference: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true
  })
  pixPayload: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  pixTxId: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  pixExpiresAt: Date | null;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  pixProvider: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  pixLocationId: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true
  })
  pixQrCode: string | null;

  @Default("whatsapp")
  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  source: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  customerNameSnapshot: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  customerNumberSnapshot: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true
  })
  notes: string;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  confirmedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  cancelledAt: Date;

  @Column({
    type: DataType.JSON,
    allowNull: true
  })
  contextJson: any;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BeforeValidate
  @BeforeCreate
  @BeforeUpdate
  static syncActiveSlotStartAt(instance: ServiceBooking): void {
    const status = String(instance.status || "").toLowerCase();
    const isActiveSlot = ["scheduled", "confirmed", "pending_payment"].includes(
      status
    );
    instance.activeSlotStartAt = isActiveSlot ? instance.startAt : null;
    instance.activeSlotResourceKey = isActiveSlot
      ? instance.professionalId
        ? `professional:${instance.professionalId}`
        : "service"
      : null;
  }
}

export default ServiceBooking;
