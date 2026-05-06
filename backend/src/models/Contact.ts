import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Unique,
  Default,
  HasMany,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import ContactCustomField from "./ContactCustomField";
import Ticket from "./Ticket";
import Company from "./Company";
import Schedule from "./Schedule";
import Whatsapp from "./Whatsapp";
import buildBackendBaseUrl from "../helpers/buildBackendBaseUrl";

@Table
class Contact extends Model<Contact> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @AllowNull(false)
  @Unique
  @Column
  number: string;

  @AllowNull(false)
  @Default("")
  @Column
  email: string;

  @Default("")
  @Column
  profilePicUrl: string;

  @Default(false)
  @Column
  isGroup: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @HasMany(() => ContactCustomField)
  extraInfo: ContactCustomField[];

  @Default(true)
  @Column
  active: boolean;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Default(false)
  @Column
  disableBot: boolean;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => Schedule, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  schedules: Schedule[];

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  toJSON() {
    const values: any = Object.assign({}, this.get());
    if (values.profilePicUrl && typeof values.profilePicUrl === "string") {
      const currentFrontendUrl = String(
        process.env.FRONTEND_URL || "http://localhost:3010"
      );
      if (values.profilePicUrl.startsWith("https://pps.whatsapp.net/")) {
        const backendUrl = buildBackendBaseUrl();
        values.profilePicUrl = `${backendUrl}/profile-pic?url=${encodeURIComponent(
          values.profilePicUrl
        )}`;
      } else if (
        values.profilePicUrl.includes("localhost:3000") ||
        values.profilePicUrl.includes("localhost:8081")
      ) {
        const backendUrl = buildBackendBaseUrl();
        values.profilePicUrl = `${backendUrl}/nopicture.png`;
      }
    }
    return values;
  }
}

export default Contact;
