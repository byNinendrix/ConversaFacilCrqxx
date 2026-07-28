import React, { useEffect, useRef, useState, useContext } from "react";
import { useParams } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import { Grid, LinearProgress, Typography } from "@material-ui/core";
import api from "../../services/api";
import CardCounter from "../../components/Dashboard/CardCounter";
import GroupIcon from "@material-ui/icons/Group";
import ScheduleIcon from "@material-ui/icons/Schedule";
import EventAvailableIcon from "@material-ui/icons/EventAvailable";
import DoneIcon from "@material-ui/icons/Done";
import DoneAllIcon from "@material-ui/icons/DoneAll";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import ListAltIcon from "@material-ui/icons/ListAlt";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import SyncIcon from "@material-ui/icons/Sync";
import { useDate } from "../../hooks/useDate";

import { SocketContext } from "../../context/Socket/SocketContext";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  textRight: {
    textAlign: "right",
  },
  tabPanelsContainer: {
    padding: theme.spacing(2),
  },
}));

const CampaignReport = () => {
  const classes = useStyles();

  const { campaignId } = useParams();

  const [campaign, setCampaign] = useState({});
  const [validContacts, setValidContacts] = useState(0);
  const [delivered, setDelivered] = useState(0);
  const [failed, setFailed] = useState(0);
  const [confirmationRequested, setConfirmationRequested] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
  const [percent, setPercent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const mounted = useRef(true);
  const refreshTimeout = useRef(null);

  const { datetimeToClient } = useDate();

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    if (mounted.current) {
      findCampaign();
    }

    return () => {
      mounted.current = false;
      if (refreshTimeout.current) {
        clearTimeout(refreshTimeout.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mounted.current && campaign.stats) {
      setValidContacts(campaign.stats.validContacts || 0);
      setDelivered(campaign.stats.delivered || 0);
      setFailed(campaign.stats.failed || 0);
      setConfirmationRequested(campaign.stats.confirmationRequested || 0);
      setConfirmed(campaign.stats.confirmed || 0);
    }
  }, [campaign]);

  useEffect(() => {
    setPercent(validContacts > 0 ? Math.min(((delivered + failed) / validContacts) * 100, 100) : 0);
  }, [delivered, failed, validContacts]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on(`company-${companyId}-campaign`, (data) => {
     
      if (data.record && data.record.id === +campaignId) {
        setCampaign((prevState) => ({ ...prevState, ...data.record }));

        if (!refreshTimeout.current) {
          refreshTimeout.current = setTimeout(() => {
            refreshTimeout.current = null;
            findCampaign();
          }, 3000);
        }

        if (data.record.status === "FINALIZADA") {
          setTimeout(() => {
            findCampaign();
          }, 5000);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, socketManager]);

  const findCampaign = async () => {
    setLoading(true);
    try {
      const [{ data }, diagnosticsResponse] = await Promise.all([
        api.get(`/campaigns/${campaignId}`),
        api
          .get(`/campaigns/${campaignId}/diagnostics`)
          .catch(() => ({ data: null })),
      ]);
      setCampaign(data);
      setDiagnostics(diagnosticsResponse.data);
    } finally {
      setLoading(false);
    }
  };

  const formatStatus = (val) => {
    switch (val) {
      case "INATIVA":
        return "Inativa";
      case "PROGRAMADA":
        return "Programada";
      case "EM_ANDAMENTO":
        return "Em Andamento";
      case "CANCELADA":
        return "Cancelada";
      case "FINALIZADA":
        return "Finalizada";
      default:
        return val;
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Grid style={{ width: "99.6%" }} container>
          <Grid xs={12} item>
            <Title>Relatório da {campaign.name || "Campanha"}</Title>
          </Grid>
        </Grid>
      </MainHeader>
      <Paper className={classes.mainPaper} variant="outlined">
        <Typography variant="h6" component="h2">
          Status: {formatStatus(campaign.status)} {delivered} entregues, {failed} falhas de {validContacts}
        </Typography>
        <Grid spacing={2} container>
          <Grid xs={12} item>
            <LinearProgress
              variant="determinate"
              style={{ height: 15, borderRadius: 3, margin: "20px 0" }}
              value={percent}
            />
          </Grid>
          <Grid xs={12} md={4} item>
            <CardCounter
              icon={<GroupIcon fontSize="inherit" />}
              title="Contatos Válidos"
              value={validContacts}
              loading={loading}
            />
          </Grid>
          {campaign.confirmation && (
            <>
              <Grid xs={12} md={4} item>
                <CardCounter
                  icon={<DoneIcon fontSize="inherit" />}
                  title="Confirmações Solicitadas"
                  value={confirmationRequested}
                  loading={loading}
                />
              </Grid>
              <Grid xs={12} md={4} item>
                <CardCounter
                  icon={<DoneAllIcon fontSize="inherit" />}
                  title="Confirmações"
                  value={confirmed}
                  loading={loading}
                />
              </Grid>
            </>
          )}
          <Grid xs={12} md={4} item>
            <CardCounter
              icon={<CheckCircleIcon fontSize="inherit" />}
              title="Entregues"
              value={delivered}
              loading={loading}
            />
          </Grid>
          <Grid xs={12} md={4} item>
            <CardCounter
              icon={<ErrorOutlineIcon fontSize="inherit" />}
              title="Falhas"
              value={failed}
              loading={loading}
            />
          </Grid>
          {campaign.whatsappId && (
            <Grid xs={12} md={4} item>
              <CardCounter
                icon={<WhatsAppIcon fontSize="inherit" />}
                title="Conexão"
                value={campaign.whatsapp?.name || ""}
                loading={loading}
              />
            </Grid>
          )}
          {campaign.contactListId && (
            <Grid xs={12} md={4} item>
              <CardCounter
                icon={<ListAltIcon fontSize="inherit" />}
                title="Lista de Contatos"
                value={campaign.contactList?.name || ""}
                loading={loading}
              />
            </Grid>
          )}
          <Grid xs={12} md={4} item>
            <CardCounter
              icon={<ScheduleIcon fontSize="inherit" />}
              title="Agendamento"
              value={datetimeToClient(campaign.scheduledAt)}
              loading={loading}
            />
          </Grid>
          <Grid xs={12} md={4} item>
            <CardCounter
              icon={<EventAvailableIcon fontSize="inherit" />}
              title="Conclusão"
              value={datetimeToClient(campaign.completedAt)}
              loading={loading}
            />
          </Grid>
          {diagnostics && (
            <>
              <Grid xs={12} item>
                <Typography variant="h6" component="h3">
                  Diagnostico da fila
                </Typography>
              </Grid>
              <Grid xs={12} md={4} item>
                <CardCounter
                  icon={<HourglassEmptyIcon fontSize="inherit" />}
                  title="Envios Pendentes"
                  value={diagnostics.stats?.pending || 0}
                  loading={loading}
                />
              </Grid>
              <Grid xs={12} md={4} item>
                <CardCounter
                  icon={<ErrorOutlineIcon fontSize="inherit" />}
                  title="Falhas Definitivas"
                  value={diagnostics.stats?.failed || 0}
                  loading={loading}
                />
              </Grid>
              <Grid xs={12} md={4} item>
                <CardCounter
                  icon={<ListAltIcon fontSize="inherit" />}
                  title="Registros de Envio"
                  value={diagnostics.stats?.shippingTotal || 0}
                  loading={loading}
                />
              </Grid>
              <Grid xs={12} md={4} item>
                <CardCounter
                  icon={<ErrorOutlineIcon fontSize="inherit" />}
                  title="Jobs com Falha"
                  value={diagnostics.queue?.counts?.failed || 0}
                  loading={loading}
                />
              </Grid>
              <Grid xs={12} md={4} item>
                <CardCounter
                  icon={<ScheduleIcon fontSize="inherit" />}
                  title="Jobs Aguardando"
                  value={diagnostics.queue?.counts?.delayed || 0}
                  loading={loading}
                />
              </Grid>
              <Grid xs={12} md={4} item>
                <CardCounter
                  icon={<SyncIcon fontSize="inherit" />}
                  title="Jobs Ativos"
                  value={diagnostics.queue?.counts?.active || 0}
                  loading={loading}
                />
              </Grid>
              <Grid xs={12} md={4} item>
                <CardCounter
                  icon={<SyncIcon fontSize="inherit" />}
                  title="Jobs da Campanha"
                  value={diagnostics.queue?.campaignSample?.matched || 0}
                  loading={loading}
                />
              </Grid>
              <Grid xs={12} md={4} item>
                <CardCounter
                  icon={<SyncIcon fontSize="inherit" />}
                  title="Job Principal"
                  value={
                    diagnostics.queue?.processJob?.found
                      ? diagnostics.queue.processJob.state
                      : "Nao encontrado"
                  }
                  loading={loading}
                />
              </Grid>
              <Grid xs={12} md={4} item>
                <CardCounter
                  icon={<SyncIcon fontSize="inherit" />}
                  title="Job de Finalizacao"
                  value={
                    diagnostics.queue?.finalizeJob?.found
                      ? diagnostics.queue.finalizeJob.state
                      : "Nao encontrado"
                  }
                  loading={loading}
                />
              </Grid>
            </>
          )}
        </Grid>
      </Paper>
    </MainContainer>
  );
};

export default CampaignReport;
