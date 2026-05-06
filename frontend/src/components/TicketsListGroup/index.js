import React, { useState, useEffect, useReducer, useContext, useMemo } from 'react';

import { makeStyles } from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import Paper from '@material-ui/core/Paper';

import TicketListItem from '../TicketListItemCustom';
import TicketsListSkeleton from '../TicketsListSkeleton';

import useTickets from '../../hooks/useTickets';
import { i18n } from '../../translate/i18n';
import { AuthContext } from '../../context/Auth/AuthContext';
import { SocketContext } from "../../context/Socket/SocketContext";

const useStyles = makeStyles((theme) => ({
  ticketsListWrapper: {
    position: 'relative',
    display: 'flex',
    flex: 1,
    minHeight: 0,
    width: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
    overflowX: 'hidden',
    minWidth: 0,
    boxSizing: 'border-box',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#ffffff',
    border: '1px solid #f3f4f6',
  },

  ticketsList: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    ...theme.scrollbarStyles,
    borderTop: '1px solid #f3f4f6',
    backgroundColor: '#ffffff',
  },

  ticketsListHeader: {
    color: 'rgb(67, 83, 105)',
    zIndex: 2,
    backgroundColor: 'white',
    borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  ticketsCount: {
    fontWeight: 'normal',
    color: 'rgb(104, 121, 146)',
    marginLeft: '8px',
    fontSize: '14px',
  },

  noTicketsText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '0.875rem',
    lineHeight: '1.4',
  },

  noTicketsTitle: {
    textAlign: 'center',
    fontSize: '1rem',
    fontWeight: 700,
    color: '#111827',
    margin: '0px 0 6px',
  },

  noTicketsDiv: {
    display: 'flex',
    minHeight: 120,
    margin: 32,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px dashed #d1d5db',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
}));

const reducer = (state, action) => {
  if (action.type === 'LOAD_TICKETS') {
    const newTickets = action.payload;

    newTickets.forEach((ticket) => {
      const ticketIndex = state.findIndex((t) => t.id === ticket.id);
      if (ticketIndex !== -1) {
        state[ticketIndex] = ticket;
        if (ticket.unreadMessages > 0) {
          state.unshift(state.splice(ticketIndex, 1)[0]);
        }
      } else {
        state.push(ticket);
      }
    });

    return [...state];
  }

  if (action.type === 'RESET_UNREAD') {
    const ticketId = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticketId);
    if (ticketIndex !== -1) {
      state[ticketIndex].unreadMessages = 0;
    }

    return [...state];
  }

  if (action.type === 'UPDATE_TICKET') {
    const ticket = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
    } else {
      state.unshift(ticket);
    }

    return [...state];
  }

  if (action.type === 'UPDATE_TICKET_UNREAD_MESSAGES') {
    const ticket = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
      state.unshift(state.splice(ticketIndex, 1)[0]);
    } else {
      state.unshift(ticket);
    }

    return [...state];
  }

  if (action.type === 'UPDATE_TICKET_CONTACT') {
    const contact = action.payload;
    const ticketIndex = state.findIndex((t) => t.contactId === contact.id);
    if (ticketIndex !== -1) {
      state[ticketIndex].contact = contact;
    }
    return [...state];
  }

  if (action.type === "UPDATE_TICKET_PRESENCE") {
    const data = action.payload;
    const ticketIndex = state.findIndex((t) => t.id === data.ticketId);
    if (ticketIndex !== -1) {
      state[ticketIndex].presence = data.presence;
    }
    return [...state];
  }

  if (action.type === 'DELETE_TICKET') {
    //console.log(action.payload);

    const ticketId = action.payload;
    const ticketIndex = state.findIndex((t) => t.id === ticketId);
    if (ticketIndex !== -1) {
      state.splice(ticketIndex, 1);
    }

    return [...state];
  }

  if (action.type === 'RESET') {
    return [];
  }

  return state;
};

const TicketsListGroup = (props) => {
  const {
    status,
    searchParam,
    tags,
    users,
    showAll,
    selectedQueueIds,
    selectedWhatsappIds = [],
    updateCount,
    style,
    sortOrder,
  } = props;
  const classes = useStyles();
  const [pageNumber, setPageNumber] = useState(1);
  let [ticketsList, dispatch] = useReducer(reducer, []);
  const socketManager = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const { profile, queues } = user;
  const selectedWhatsappIdsKey = JSON.stringify(selectedWhatsappIds);

  const isGroupTicket = (ticket) => {
    const value = ticket?.isGroup;
    if (value === true || value === 1 || value === "1") return true;
    if (value === false || value === 0 || value === "0" || value == null) return false;
    return String(value).toLowerCase() === "true";
  };

  useEffect(() => {
    dispatch({ type: 'RESET' });
    setPageNumber(1);
  }, [status, searchParam, dispatch, showAll, tags, users, selectedQueueIds, selectedWhatsappIdsKey, sortOrder]);

  const { tickets, hasMore, loading } = useTickets({
    pageNumber,
    searchParam,
    status,
    showAll,
    tags: JSON.stringify(tags),
    users: JSON.stringify(users),
    queueIds: JSON.stringify(selectedQueueIds),
    whatsappIds: selectedWhatsappIdsKey,
    sortOrder,
  });

  useEffect(() => {
    const queueIds = queues.map((q) => q.id);
    const filteredTickets = tickets.filter(
      (t) => queueIds.indexOf(t.queueId) > -1
    );

    if (profile === 'user') {
      dispatch({ type: 'LOAD_TICKETS', payload: filteredTickets });
    } else {
      dispatch({ type: 'LOAD_TICKETS', payload: tickets });
    }
  }, [tickets, status, searchParam, queues, profile]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);
    const hasQueueFilter = Array.isArray(selectedQueueIds) && selectedQueueIds.length > 0;
    const hasWhatsappFilter =
      Array.isArray(selectedWhatsappIds) && selectedWhatsappIds.length > 0;

    const shouldUpdateTicket = (ticket) =>
      (ticket.status === "pending" || !ticket.userId || ticket.userId === user?.id || showAll) &&
      (!hasQueueFilter || !ticket.queueId || selectedQueueIds.includes(ticket.queueId)) &&
      (!hasWhatsappFilter || selectedWhatsappIds.includes(ticket.whatsappId));

    const notBelongsToUserQueues = (ticket) =>
      hasQueueFilter && ticket.queueId && !selectedQueueIds.includes(ticket.queueId);

    const notBelongsToSelectedWhatsapps = (ticket) =>
      hasWhatsappFilter && !selectedWhatsappIds.includes(ticket.whatsappId);

    socket.on("ready", () => {
      if (status) {
        socket.emit("joinTickets", status);
      } else {
        socket.emit("joinNotification");
      }
    });

    socket.on(`company-${companyId}-ticket`, (data) => {
      
      if (data.action === "updateUnread") {
        dispatch({
          type: "RESET_UNREAD",
          payload: data.ticketId,
        });
      }

      if (data.action === "update" && shouldUpdateTicket(data.ticket) && data.ticket.status === status) {
        dispatch({
          type: "UPDATE_TICKET",
          payload: data.ticket,
        });
      }

      if (data.action === "update" && notBelongsToUserQueues(data.ticket)) {
        dispatch({ type: "DELETE_TICKET", payload: data.ticket.id });
      }

      if (data.action === "update" && notBelongsToSelectedWhatsapps(data.ticket)) {
        dispatch({ type: "DELETE_TICKET", payload: data.ticket.id });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_TICKET", payload: data.ticketId });
      }
    });

    socket.on(`company-${companyId}-appMessage`, (data) => {
      const queueIds = queues.map((q) => q.id);
      if (
        profile === "user" &&
        (queueIds.indexOf(data.ticket?.queue?.id) === -1 ||
          data.ticket.queue === null)
      ) {
        return;
      }

      if (data.action === "create" && shouldUpdateTicket(data.ticket) && ( status === undefined || data.ticket.status === status)) {
        dispatch({
          type: "UPDATE_TICKET_UNREAD_MESSAGES",
          payload: data.ticket,
        });
      }
    });

    socket.on(`company-${companyId}-presence`, (data) => {
      dispatch({
        type: "UPDATE_TICKET_PRESENCE",
        payload: data,
      });
    });

    socket.on(`company-${companyId}-contact`, (data) => {
      if (data.action === "update") {
        dispatch({
          type: "UPDATE_TICKET_CONTACT",
          payload: data.contact,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [status, showAll, user, selectedQueueIds, selectedWhatsappIdsKey, tags, users, profile, queues, socketManager]);

  const visibleTickets = useMemo(() => {
    const safeTicketsList = Array.isArray(ticketsList) ? ticketsList : [];
    const filteredTickets = safeTicketsList.filter((ticket) => isGroupTicket(ticket));

    if (sortOrder !== "asc" && sortOrder !== "desc") {
      return filteredTickets;
    }

    const direction = sortOrder === "asc" ? 1 : -1;
    const getTicketTime = (ticket) => {
      const updatedAt = new Date(ticket?.updatedAt || 0).getTime();
      if (Number.isFinite(updatedAt) && updatedAt > 0) {
        return updatedAt;
      }
      const createdAt = new Date(ticket?.createdAt || 0).getTime();
      return Number.isFinite(createdAt) ? createdAt : 0;
    };

    return [...filteredTickets].sort((a, b) => {
      const aTime = getTicketTime(a);
      const bTime = getTicketTime(b);
      return (aTime - bTime) * direction;
    });
  }, [ticketsList, sortOrder]);

  useEffect(() => {
    const count = visibleTickets.length;
    if (typeof updateCount === 'function') {
      updateCount(count);
    }
  }, [visibleTickets, updateCount]);

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  if (status) {
    ticketsList = ticketsList.filter(ticket => ticket?.status === status)

  }

  if (selectedQueueIds.length > 0) {
    ticketsList = !!status ? ticketsList.filter(ticket => user.profile === 'user' ?
      selectedQueueIds.includes(ticket?.queueId) :
      selectedQueueIds.includes(ticket?.queueId) || ticket?.queueId === null) :
      ticketsList;
  }

  return (
    <Paper className={classes.ticketsListWrapper} style={style}>
      <Paper
        square
        name='closed'
        elevation={0}
        className={classes.ticketsList}
        onScroll={handleScroll}
      >
        <List style={{ paddingTop: 0, overflowX: 'hidden' }}>
          {visibleTickets.length === 0 && !loading ? (
            <div className={classes.noTicketsDiv}>
              <span className={classes.noTicketsTitle}>
                {i18n.t('ticketsList.noTicketsTitle')}
              </span>
              <p className={classes.noTicketsText}>
                {i18n.t('ticketsList.noTicketsMessage')}
              </p>
            </div>
          ) : (
            <>
              {visibleTickets.map((ticket) => (
                <TicketListItem ticket={ticket} key={ticket.id} />
              ))}
            </>
          )}
          {loading && <TicketsListSkeleton />}
        </List>
      </Paper>
    </Paper>
  );
};

export default TicketsListGroup;
