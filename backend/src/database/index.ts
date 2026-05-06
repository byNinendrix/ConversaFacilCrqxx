import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import ContactCustomField from "../models/ContactCustomField";
import Message from "../models/Message";
import Queue from "../models/Queue";
import WhatsappQueue from "../models/WhatsappQueue";
import UserQueue from "../models/UserQueue";
import Company from "../models/Company";
import CompanyService from "../models/CompanyService";
import CompanyServiceAvailability from "../models/CompanyServiceAvailability";
import CompanyServiceProfessional from "../models/CompanyServiceProfessional";
import CompanyServiceSpecificSlot from "../models/CompanyServiceSpecificSlot";
import Plan from "../models/Plan";
import TicketNote from "../models/TicketNote";
import QuickMessage from "../models/QuickMessage";
import Help from "../models/Help";
import TicketTraking from "../models/TicketTraking";
import UserRating from "../models/UserRating";
import QueueOption from "../models/QueueOption";
import Schedule from "../models/Schedule";
import Tag from "../models/Tag";
import TicketTag from "../models/TicketTag";
import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";
import Campaign from "../models/Campaign";
import CampaignSetting from "../models/CampaignSetting";
import Baileys from "../models/Baileys";
import CampaignShipping from "../models/CampaignShipping";
import Announcement from "../models/Announcement";
import Chat from "../models/Chat";
import ChatUser from "../models/ChatUser";
import ChatMessage from "../models/ChatMessage";
import Invoices from "../models/Invoices";
import Subscriptions from "../models/Subscriptions";
import BaileysChats from "../models/BaileysChats";
import Files from "../models/Files";
import FilesOptions from "../models/FilesOptions";
import Prompt from "../models/Prompt";
import QueueIntegrations from "../models/QueueIntegrations";
import Flow from "../models/Flow";
import FlowVersion from "../models/FlowVersion";
import FlowNode from "../models/FlowNode";
import FlowEdge from "../models/FlowEdge";
import FlowBinding from "../models/FlowBinding";
import FlowExecution from "../models/FlowExecution";
import FlowExecutionEvent from "../models/FlowExecutionEvent";
import ServiceBooking from "../models/ServiceBooking";
import ServiceSchedulingSession from "../models/ServiceSchedulingSession";
import ServiceBookingSlotLock from "../models/ServiceBookingSlotLock";

// eslint-disable-next-line
const dbConfig = require("../config/database");
// import dbConfig from "../config/database";

const sequelize = new Sequelize(dbConfig);

const models = [
  Company,
  CompanyService,
  CompanyServiceAvailability,
  CompanyServiceProfessional,
  CompanyServiceSpecificSlot,
  ServiceBooking,
  ServiceSchedulingSession,
  ServiceBookingSlotLock,
  User,
  Contact,
  Ticket,
  Message,
  Whatsapp,
  ContactCustomField,
  Setting,
  Queue,
  WhatsappQueue,
  UserQueue,
  Plan,
  TicketNote,
  QuickMessage,
  Help,
  TicketTraking,
  UserRating,
  QueueOption,
  Schedule,
  Tag,
  TicketTag,
  ContactList,
  ContactListItem,
  Campaign,
  CampaignSetting,
  Baileys,
  CampaignShipping,
  Announcement,
  Chat,
  ChatUser,
  ChatMessage,
  Invoices,
  Subscriptions,
  BaileysChats,
  Files,
  FilesOptions,
  Prompt,
  QueueIntegrations,
  Flow,
  FlowVersion,
  FlowNode,
  FlowEdge,
  FlowBinding,
  FlowExecution,
  FlowExecutionEvent,
];

sequelize.addModels(models);

export default sequelize;
