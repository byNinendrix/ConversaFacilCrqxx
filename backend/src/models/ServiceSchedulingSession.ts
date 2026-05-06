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
import Whatsapp from "./Whatsapp";
import Ticket from "./Ticket";
import Contact from "./Contact";
import CompanyService from "./CompanyService";
import User from "./User";

@Table({
  tableName: "ServiceSchedulingSessions"
})
class ServiceSchedulingSession extends Model<ServiceSchedulingSession> {
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

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => CompanyService)
  @Column
  selectedServiceId: number;

  @BelongsTo(() => CompanyService)
  selectedService: CompanyService;

  @ForeignKey(() => User)
  @Column
  selectedProfessionalId: number | null;

  @BelongsTo(() => User)
  selectedProfessional: User;

  @Default("active")
  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  status: string;

  @Default("service_selection")
  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  currentStep: string;

  @Column({
    type: DataType.DATEONLY,
    allowNull: true
  })
  selectedDate: string;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  selectedStartAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  selectedEndAt: Date;

  @Column({
    type: DataType.JSON,
    allowNull: true
  })
  contextJson: any;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  lastInteractionAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  expiresAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ServiceSchedulingSession;
