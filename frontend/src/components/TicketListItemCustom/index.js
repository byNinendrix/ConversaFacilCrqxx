import React, { useContext, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { format, isSameDay, parseISO } from "date-fns";
import { useHistory, useParams } from "react-router-dom";
import Avatar from "@material-ui/core/Avatar";
import Divider from "@material-ui/core/Divider";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import { Tooltip } from "@material-ui/core";
import { v4 as uuidv4 } from "uuid";
import AndroidIcon from "@material-ui/icons/Android";
import VisibilityIcon from "@material-ui/icons/Visibility";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import ContactTag from "../ContactTag";
import TicketMessagesDialog from "../TicketMessagesDialog";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import { getInitials } from "../../helpers/getInitials";
import { generateColor } from "../../helpers/colorGenerator";
import { normalizeProfilePicUrl } from "../../helpers/normalizeProfilePicUrl";

const useStyles = makeStyles((theme) => ({
  ticket: {
    position: "relative",
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    margin: "8px",
    width: "calc(100% - 16px)",
    boxSizing: "border-box",
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    backgroundColor: "#ffffff",
    padding: "12px 12px 12px 14px",
    overflow: "hidden",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
    "&:hover": {
      borderColor: "#bae6fd",
      backgroundColor: "#f8fafc",
      boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
    },
    "&.Mui-selected": {
      borderColor: "#67e8f9",
      backgroundColor: "#ecfeff",
      boxShadow: "0 10px 22px rgba(8, 145, 178, 0.12)",
    },
    [theme.breakpoints.down("xs")]: {
      margin: "6px",
      width: "calc(100% - 12px)",
      padding: "10px 10px 10px 12px",
      gap: 8,
      borderRadius: 14,
    },
  },
  pendingTicket: {
    cursor: "unset",
    backgroundColor: "#f8fafc",
  },
  ticketQueueColor: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  avatarWrapper: {
    minWidth: 48,
    marginTop: 2,
    [theme.breakpoints.down("xs")]: {
      minWidth: 44,
    },
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    fontSize: "0.86rem",
    fontWeight: 700,
    [theme.breakpoints.down("xs")]: {
      width: 40,
      height: 40,
    },
  },
  content: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  topRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    minWidth: 0,
    flexWrap: "wrap",
  },
  titleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    flex: "1 1 220px",
  },
  contactName: {
    fontSize: "0.92rem",
    fontWeight: 700,
    color: "#111827",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  lastInteractionLabel: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: "0.68rem",
    fontWeight: 700,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  },
  chatbotIcon: {
    color: "#6b7280",
    fontSize: "1rem",
    flexShrink: 0,
  },
  visibilityIcon: {
    color: "#0f766e",
    fontSize: "1rem",
    cursor: "pointer",
    flexShrink: 0,
  },
  metaRow: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    minWidth: 0,
  },
  lastMessageTime: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    backgroundColor: "#f9fafb",
    color: "#374151",
    fontSize: "0.72rem",
    fontWeight: 700,
    lineHeight: 1.2,
    padding: "2px 7px",
    whiteSpace: "nowrap",
  },
  unreadBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    padding: "0 6px",
    fontSize: "0.7rem",
    fontWeight: 700,
    color: theme.palette.getContrastText(theme.palette.success.main),
    backgroundColor: theme.palette.success.main,
    whiteSpace: "nowrap",
  },
  messagePreview: {
    fontSize: "0.82rem",
    color: "#4b5563",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.45,
  },
  presence: {
    color: "#0e7490",
    fontWeight: 700,
  },
  badgesRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  infoBadge: {
    display: "inline-flex",
    alignItems: "center",
    maxWidth: "100%",
    borderRadius: 999,
    border: "1px solid #d1d5db",
    backgroundColor: "#f8fafc",
    color: "#475569",
    padding: "2px 8px",
    fontSize: "0.64rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userBadge: {
    color: "#111827",
    borderColor: "#9ca3af",
    backgroundColor: "#f3f4f6",
  },
  tagsRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  actionsRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    paddingTop: 1,
    minWidth: 0,
  },
  actionButtonBase: {
    borderRadius: 10,
    fontSize: "0.64rem",
    minHeight: 26,
    padding: "3px 10px",
    textTransform: "uppercase",
    fontWeight: 700,
    lineHeight: 1.2,
    boxShadow: "none",
    maxWidth: "100%",
    "& .MuiButton-label": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    [theme.breakpoints.down("xs")]: {
      flex: "1 1 auto",
      minWidth: 0,
    },
  },
  actionAccept: {
    backgroundColor: "#16a34a",
    color: "#ffffff",
    "&:hover": {
      backgroundColor: "#15803d",
    },
  },
  actionClose: {
    backgroundColor: "#dc2626",
    color: "#ffffff",
    "&:hover": {
      backgroundColor: "#b91c1c",
    },
  },
  actionTransfer: {
    backgroundColor: "#0e7490",
    color: "#ffffff",
    "&:hover": {
      backgroundColor: "#155e75",
    },
  },
  divider: {
    margin: "0 10px",
    backgroundColor: "#f3f4f6",
    [theme.breakpoints.down("xs")]: {
      margin: "0 8px",
    },
  },
}));

const formatUpdatedAt = (updatedAt) => {
  if (!updatedAt) return "";

  const parsedDate = parseISO(updatedAt);
  if (Number.isNaN(parsedDate.getTime())) return "";

  return isSameDay(parsedDate, new Date())
    ? format(parsedDate, "HH:mm")
    : format(parsedDate, "dd/MM/yyyy");
};

const buildLastInteraction = (lastMessage, updatedAt) => {
  if (!lastMessage || !updatedAt) {
    return null;
  }

  const lastInteractionDate = parseISO(updatedAt);
  if (Number.isNaN(lastInteractionDate.getTime())) {
    return null;
  }

  const now = new Date();
  const diffInMs = now - lastInteractionDate;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

  if (diffInMinutes >= 3 && diffInMinutes <= 10) {
    return {
      text: `ha ${diffInMinutes}m`,
      color: "#166534",
      backgroundColor: "#dcfce7",
    };
  }

  if (diffInMinutes >= 30 && diffInMinutes < 60) {
    return {
      text: `ha ${diffInMinutes}m`,
      color: "#92400e",
      backgroundColor: "#fef3c7",
    };
  }

  if (diffInHours >= 1 && diffInHours < 24) {
    return {
      text: `ha ${diffInHours}h`,
      color: "#991b1b",
      backgroundColor: "#fee2e2",
    };
  }

  if (diffInHours >= 24) {
    return {
      text: `ha ${Math.floor(diffInHours / 24)}d`,
      color: "#991b1b",
      backgroundColor: "#fee2e2",
    };
  }

  return null;
};

const cleanMessage = (text) =>
  String(text || "")
    .replace(/\s+/g, " ")
    .trim();

const TicketListItemCustom = ({ ticket }) => {
  const classes = useStyles();
  const history = useHistory();
  const { ticketId } = useParams();
  const isMounted = useRef(true);

  const [loading, setLoading] = useState(false);
  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);
  const [lastInteractionLabel, setLastInteractionLabel] = useState(null);

  const { setCurrentTicket } = useContext(TicketsContext);
  const { user } = useContext(AuthContext);

  const isAdmin = String(user?.profile || "").toLowerCase() === "admin";
  const presenceMessage = {
    composing: "Digitando...",
    recording: "Gravando...",
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const refreshLabel = () => {
      setLastInteractionLabel(
        buildLastInteraction(ticket.lastMessage, ticket.updatedAt)
      );
    };

    refreshLabel();
    const timer = setInterval(refreshLabel, 30 * 1000);

    return () => {
      clearInterval(timer);
    };
  }, [ticket.lastMessage, ticket.updatedAt]);

  const ticketUser =
    ticket.userId && ticket.user?.name ? ticket.user.name.toUpperCase() : null;
  const queueName = ticket.queue?.name?.toUpperCase() || "SEM FILA";
  const queueColor = ticket.queue?.color || "#7c7c7c";
  const whatsappName = ticket.whatsapp?.name?.toUpperCase();
  const tags = Array.isArray(ticket?.tags) ? ticket.tags : [];
  const updatedAtLabel = formatUpdatedAt(ticket.updatedAt);
  const isPresence = ["composing", "recording"].includes(ticket?.presence);
  const isSelected =
    !!ticketId &&
    (String(ticketId) === String(ticket.id) ||
      String(ticketId) === String(ticket.uuid));

  const previewText = (() => {
    if (isPresence) {
      return presenceMessage[ticket.presence] || "";
    }

    const message = cleanMessage(ticket?.lastMessage);
    if (!message) return "";
    if (message.includes("data:image/png;base64")) return "Localizacao";
    if (message.toUpperCase().includes("VCARD")) return "Novo contato recebido";

    return message;
  })();

  const handleSelectTicket = (selectedTicket) => {
    const code = uuidv4();
    const { id, uuid } = selectedTicket;
    setCurrentTicket({ id, uuid, code });
  };

  const handleSendMessage = async (id) => {
    const msg = `{{ms}} *{{name}}*, meu nome e *${user?.name}* e agora vou prosseguir com seu atendimento!`;
    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: `*Mensagem Automatica:*\n${msg.trim()}`,
    };

    try {
      await api.post(`/messages/${id}`, message);
    } catch (err) {
      toastError(err);
    }
  };

  const handleAcceptTicket = async (id) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "open",
        userId: user?.id,
      });

      try {
        const { data } = await api.get("/settings/");
        const sendGreetingEnabled = Array.isArray(data)
          ? data.some(
              (setting) =>
                setting.key === "sendGreetingAccepted" &&
                setting.value === "enabled"
            )
          : false;

        if (sendGreetingEnabled && !ticket.isGroup) {
          await handleSendMessage(ticket.id);
        }
      } catch (err) {
        toastError(err);
      }

      history.push(`/tickets/${ticket.uuid}`);
    } catch (err) {
      toastError(err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleCloseTicket = async (id) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "closed",
        justClose: true,
        userId: user?.id,
        queueId: ticket?.queue?.id,
        useIntegration: false,
        promptId: null,
        integrationId: null,
      });

      history.push("/tickets/");
    } catch (err) {
      toastError(err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleReopenTicket = async (id) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "open",
        userId: user?.id,
        queueId: ticket?.queue?.id,
      });
      history.push(`/tickets/${ticket.uuid}`);
    } catch (err) {
      toastError(err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleOpenTransferModal = () => {
    setTransferTicketModalOpen(true);
  };

  const handleCloseTransferTicketModal = () => {
    if (isMounted.current) {
      setTransferTicketModalOpen(false);
    }
  };

  return (
    <React.Fragment key={ticket.id}>
      <TransferTicketModalCustom
        modalOpen={transferTicketModalOpen}
        onClose={handleCloseTransferTicketModal}
        ticketid={ticket.id}
      />

      <TicketMessagesDialog
        open={openTicketMessageDialog}
        handleClose={() => setOpenTicketMessageDialog(false)}
        ticketId={ticket.id}
      />

      <ListItem
        dense
        button
        onClick={() => {
          if (ticket.status === "pending") return;
          handleSelectTicket(ticket);
        }}
        selected={isSelected}
        className={clsx(classes.ticket, {
          [classes.pendingTicket]: ticket.status === "pending",
        })}
      >
        <Tooltip
          arrow
          placement="right"
          title={ticket.queue?.name?.toUpperCase() || "SEM FILA"}
        >
          <span
            style={{ backgroundColor: queueColor }}
            className={classes.ticketQueueColor}
          />
        </Tooltip>

        <ListItemAvatar className={classes.avatarWrapper}>
          <Avatar
            className={classes.avatar}
            style={{ backgroundColor: generateColor(ticket?.contact?.number) }}
            src={normalizeProfilePicUrl(ticket?.contact?.profilePicUrl)}
          >
            {getInitials(ticket?.contact?.name || "")}
          </Avatar>
        </ListItemAvatar>

        <div className={classes.content}>
          <div className={classes.topRow}>
            <div className={classes.titleWrap}>
              <Typography className={classes.contactName} title={ticket.contact?.name || ""}>
                {ticket.contact?.name || ""}
              </Typography>

              {lastInteractionLabel && (
                <span
                  className={classes.lastInteractionLabel}
                  style={{
                    color: lastInteractionLabel.color,
                    backgroundColor: lastInteractionLabel.backgroundColor,
                  }}
                >
                  {lastInteractionLabel.text}
                </span>
              )}

              {ticket.chatbot && (
                <Tooltip title="Chatbot">
                  <AndroidIcon className={classes.chatbotIcon} />
                </Tooltip>
              )}

              {isAdmin && (
                <Tooltip title="Espiar conversa">
                  <VisibilityIcon
                    className={classes.visibilityIcon}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenTicketMessageDialog(true);
                    }}
                  />
                </Tooltip>
              )}
            </div>

            <div className={classes.metaRow}>
              {updatedAtLabel && (
                <Typography className={classes.lastMessageTime}>
                  {updatedAtLabel}
                </Typography>
              )}
              {ticket.unreadMessages > 0 && (
                <span className={classes.unreadBadge}>
                  {ticket.unreadMessages > 99 ? "99+" : ticket.unreadMessages}
                </span>
              )}
            </div>
          </div>

          <Typography
            className={clsx(classes.messagePreview, {
              [classes.presence]: isPresence,
            })}
            title={previewText}
          >
            {previewText || "-"}
          </Typography>

          <div className={classes.badgesRow}>
            {whatsappName && <span className={classes.infoBadge}>{whatsappName}</span>}
            {ticketUser && (
              <span className={clsx(classes.infoBadge, classes.userBadge)}>{ticketUser}</span>
            )}
            <span
              className={classes.infoBadge}
              style={{
                color: queueColor,
                borderColor: queueColor,
              }}
              title={queueName}
            >
              {queueName}
            </span>
          </div>

          {tags.length > 0 && (
            <div className={classes.tagsRow}>
              {tags.map((currentTag) => (
                <ContactTag
                  tag={currentTag}
                  key={`ticket-contact-tag-${ticket.id}-${currentTag.id}`}
                />
              ))}
            </div>
          )}

          <div className={classes.actionsRow}>
            {ticket.status === "pending" && (
              <>
                <ButtonWithSpinner
                  variant="contained"
                  className={clsx(classes.actionButtonBase, classes.actionAccept)}
                  size="small"
                  loading={loading}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAcceptTicket(ticket.id);
                  }}
                >
                  {i18n.t("ticketsList.buttons.accept")}
                </ButtonWithSpinner>

                <ButtonWithSpinner
                  variant="contained"
                  className={clsx(classes.actionButtonBase, classes.actionClose)}
                  size="small"
                  loading={loading}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCloseTicket(ticket.id);
                  }}
                >
                  {i18n.t("ticketsList.buttons.closed")}
                </ButtonWithSpinner>
              </>
            )}

            {ticket.status === "attending" && (
              <>
                <ButtonWithSpinner
                  variant="contained"
                  className={clsx(classes.actionButtonBase, classes.actionAccept)}
                  size="small"
                  loading={loading}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAcceptTicket(ticket.id);
                  }}
                >
                  {i18n.t("ticketsList.buttons.accept")}
                </ButtonWithSpinner>

                <ButtonWithSpinner
                  variant="contained"
                  className={clsx(classes.actionButtonBase, classes.actionClose)}
                  size="small"
                  loading={loading}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCloseTicket(ticket.id);
                  }}
                >
                  {i18n.t("ticketsList.buttons.closed")}
                </ButtonWithSpinner>
              </>
            )}

            {ticket.status !== "closed" &&
              ticket.status !== "pending" &&
              ticket.status !== "attending" && (
                <>
                  <ButtonWithSpinner
                    variant="contained"
                    className={clsx(classes.actionButtonBase, classes.actionTransfer)}
                    size="small"
                    loading={loading}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpenTransferModal();
                    }}
                  >
                    {i18n.t("ticketsList.buttons.transfer")}
                  </ButtonWithSpinner>

                  <ButtonWithSpinner
                    variant="contained"
                    className={clsx(classes.actionButtonBase, classes.actionClose)}
                    size="small"
                    loading={loading}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCloseTicket(ticket.id);
                    }}
                  >
                    {i18n.t("ticketsList.buttons.closed")}
                  </ButtonWithSpinner>
                </>
              )}

            {ticket.status === "closed" && (
              <ButtonWithSpinner
                variant="contained"
                className={clsx(classes.actionButtonBase, classes.actionClose)}
                size="small"
                loading={loading}
                onClick={(event) => {
                  event.stopPropagation();
                  handleReopenTicket(ticket.id);
                }}
              >
                {i18n.t("ticketsList.buttons.reopen")}
              </ButtonWithSpinner>
            )}
          </div>
        </div>
      </ListItem>

      <Divider className={classes.divider} component="li" />
    </React.Fragment>
  );
};

export default TicketListItemCustom;
