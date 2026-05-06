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

import Company from "./Company";
import Contact from "./Contact";
import Ticket from "./Ticket";
import Whatsapp from "./Whatsapp";
import Flow from "./Flow";
import FlowVersion from "./FlowVersion";
import FlowExecutionEvent from "./FlowExecutionEvent";

@Table
class FlowExecution extends Model<FlowExecution> {
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

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @Column
  currentNodeKey: string;

  @Column
  status: string;

  @Column
  attemptCount: number;

  @Column
  lockVersion: number;

  @Column
  startedAt: Date;

  @Column
  finishedAt: Date;

  @Column
  lastInteractionAt: Date;

  @Column
  waitUntil: Date;

  @Column({ type: DataType.JSON })
  contextJson: any;

  @HasMany(() => FlowExecutionEvent)
  events: FlowExecutionEvent[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FlowExecution;

