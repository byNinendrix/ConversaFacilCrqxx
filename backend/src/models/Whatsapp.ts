import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default,
  AllowNull,
  HasMany,
  Unique,
  BelongsToMany,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Queue from "./Queue";
import Ticket from "./Ticket";
import WhatsappQueue from "./WhatsappQueue";
import Company from "./Company";
import Prompt from "./Prompt";
import QueueIntegrations from "./QueueIntegrations";
import ServiceBooking from "./ServiceBooking";
import ServiceSchedulingSession from "./ServiceSchedulingSession";

@Table
class Whatsapp extends Model<Whatsapp> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull
  @Unique
  @Column(DataType.TEXT)
  name: string;

  @Column(DataType.TEXT)
  session: string;

  @Column(DataType.TEXT)
  qrcode: string;

  @Column
  status: string;

  @Column
  battery: string;

  @Column
  plugged: boolean;

  @Column
  retries: number;

  @Default("")
  @Column(DataType.TEXT)
  greetingMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  farewellMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  complationMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  outOfHoursMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  ratingMessage: string;

  @Column({ defaultValue: "stable" })
  provider: string;

  @Default(false)
  @AllowNull
  @Column
  isDefault: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @BelongsToMany(() => Queue, () => WhatsappQueue)
  queues: Array<Queue & { WhatsappQueue: WhatsappQueue }>;

  @HasMany(() => WhatsappQueue)
  whatsappQueues: WhatsappQueue[];

  @HasMany(() => ServiceBooking)
  serviceBookings: ServiceBooking[];

  @HasMany(() => ServiceSchedulingSession)
  schedulingSessions: ServiceSchedulingSession[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  token: string;

  //@Default(0)
  //@Column
  //timeSendQueue: number;

  //@Column
  //sendIdQueue: number;
  
  @Column
  transferQueueId: number;

  @Column
  timeToTransfer: number;  


  @ForeignKey(() => Prompt)
  @Column
  promptId: number;

  @BelongsTo(() => Prompt)
  prompt: Prompt;

  @ForeignKey(() => QueueIntegrations)
  @Column
  integrationId: number;

  @BelongsTo(() => QueueIntegrations)
  queueIntegrations: QueueIntegrations;

  @Column
  maxUseBotQueues: number;

  @Column
  timeUseBotQueues: string;

  @Column
  expiresTicket: number;
  
  @Column
  number: string;
  
  @Column
  expiresInactiveMessage: string;

  @AllowNull
  @Column(DataType.STRING)
  greetingMediaPath: string;

  @AllowNull
  @Column(DataType.STRING)
  greetingMediaName: string;

  @Default(false)
  @AllowNull(false)
  @Column
  flowAutomationEnabled: boolean;

  @Default(false)
  @AllowNull(false)
  @Column
  schedulingAutomationEnabled: boolean;

  @Default("")
  @AllowNull(false)
  @Column(DataType.TEXT)
  schedulingOfferMessage: string;

  @Default(true)
  @AllowNull(false)
  @Column
  schedulingShowPrice: boolean;

  @Default(true)
  @AllowNull(false)
  @Column
  schedulingRequireConfirmation: boolean;
}

export default Whatsapp;
