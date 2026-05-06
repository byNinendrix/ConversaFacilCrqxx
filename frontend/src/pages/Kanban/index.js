import React, { useState, useEffect, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import Board from "react-trello";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import { useHistory } from "react-router-dom";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1),
  },
}));

const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();

  const [tags, setTags] = useState([]);
  const [reloadData, setReloadData] = useState(false);
  const [file, setFile] = useState({ lanes: [] });
  const [tickets, setTickets] = useState([]);

  const { user } = useContext(AuthContext);
  const jsonString = user.queues.map(queue => queue.UserQueue.queueId);

  const fetchTickets = async queueIds => {
    try {
      const { data } = await api.get("/ticket/kanban", {
        params: {
          queueIds: JSON.stringify(queueIds),
          teste: true,
        },
      });
      setTickets(data.tickets);
    } catch (err) {
      console.log(err);
      setTickets([]);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await api.get("/tags/kanban");
      const fetchedTags = response.data.lista || [];
      setTags(fetchedTags);
      await fetchTickets(jsonString);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const buildCardDescription = ticket =>
    `${ticket?.contact?.number || ""}\n${String(ticket?.lastMessage || "").trim()}`;

  const popularCards = () => {
    const ticketsWithoutTag = tickets.filter(ticket => ticket.tags.length === 0);

    const lanes = [
      {
        id: "lane0",
        title: i18n.t("Em aberto"),
        label: "0",
        cards: ticketsWithoutTag.map(ticket => ({
          id: ticket.id.toString(),
          label: `Ticket nº ${ticket.id}`,
          description: buildCardDescription(ticket),
          title: ticket.contact.name,
          draggable: true,
          href: `/tickets/${ticket.uuid}`,
          metadata: { uuid: ticket.uuid },
        })),
      },
      ...tags.map(tag => {
        const filteredTickets = tickets.filter(ticket => {
          const tagIds = ticket.tags.map(item => item.id);
          return tagIds.includes(tag.id);
        });

        return {
          id: tag.id.toString(),
          title: tag.name,
          label: tag.id.toString(),
          cards: filteredTickets.map(ticket => ({
            id: ticket.id.toString(),
            label: `Ticket nº ${ticket.id}`,
            description: buildCardDescription(ticket),
            title: ticket.contact.name,
            draggable: true,
            href: `/tickets/${ticket.uuid}`,
            metadata: { uuid: ticket.uuid },
          })),
          style: { backgroundColor: tag.color, color: "white" },
        };
      }),
    ];

    setFile({ lanes });
  };

  const handleCardClick = uuid => {
    history.push(`/tickets/${uuid}`);
  };

  useEffect(() => {
    popularCards();
  }, [tags, tickets, reloadData]);

  const handleCardMove = async (cardId, sourceLaneId, targetLaneId) => {
    try {
      await api.delete(`/ticket-tags/${targetLaneId}`);
      toast.success("Ticket Tag Removido!");
      await api.put(`/ticket-tags/${targetLaneId}/${sourceLaneId}`);
      toast.success("Ticket Tag Adicionado com Sucesso!");
      setReloadData(prev => !prev);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className={classes.root}>
      <Board
        data={file}
        onCardMoveAcrossLanes={handleCardMove}
        onCardClick={(cardId, metadata) => {
          if (metadata?.uuid) {
            handleCardClick(metadata.uuid);
          }
        }}
        style={{ backgroundColor: "rgba(252, 252, 252, 0.03)" }}
      />
    </div>
  );
};

export default Kanban;
