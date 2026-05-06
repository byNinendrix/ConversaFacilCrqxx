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
  HasMany
} from "sequelize-typescript";
import Contact from "./Contact";
import CompanyService from "./CompanyService";
import Message from "./Message";
import CompanyServiceAvailability from "./CompanyServiceAvailability";
import CompanyServiceProfessional from "./CompanyServiceProfessional";
import CompanyServiceSpecificSlot from "./CompanyServiceSpecificSlot";

import Plan from "./Plan";
import Queue from "./Queue";
import Setting from "./Setting";
import Ticket from "./Ticket";
import TicketTraking from "./TicketTraking";
import User from "./User";
import UserRating from "./UserRating";
import Whatsapp from "./Whatsapp";
import ServiceBooking from "./ServiceBooking";
import ServiceSchedulingSession from "./ServiceSchedulingSession";

@Table
class Company extends Model<Company> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  phone: string;

  @Column
  email: string;

  @Column
  status: boolean;

  @Column
  dueDate: string;

  @Column
  recurrence: string;

  @Column({
    type: DataType.JSONB
  })
  schedules: [];

  @ForeignKey(() => Plan)
  @Column
  planId: number;

  @BelongsTo(() => Plan)
  plan: Plan;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => User, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  users: User[];

  @HasMany(() => UserRating, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  userRatings: UserRating[];

  @HasMany(() => Queue, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  queues: Queue[];

  @HasMany(() => Whatsapp, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  whatsapps: Whatsapp[];

  @HasMany(() => Message, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  messages: Message[];

  @HasMany(() => Contact, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  contacts: Contact[];

  @HasMany(() => Setting, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  settings: Setting[];

  @HasMany(() => Ticket, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  tickets: Ticket[];

  @HasMany(() => TicketTraking, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  ticketTrankins: TicketTraking[];

  @HasMany(() => CompanyService, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  companyServices: CompanyService[];

  @HasMany(() => CompanyServiceAvailability, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  companyServiceAvailabilities: CompanyServiceAvailability[];

  @HasMany(() => CompanyServiceProfessional, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  companyServiceProfessionals: CompanyServiceProfessional[];

  @HasMany(() => CompanyServiceSpecificSlot, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  companyServiceSpecificSlots: CompanyServiceSpecificSlot[];

  @HasMany(() => ServiceBooking, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  serviceBookings: ServiceBooking[];

  @HasMany(() => ServiceSchedulingSession, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  schedulingSessions: ServiceSchedulingSession[];
}

export default Company;
