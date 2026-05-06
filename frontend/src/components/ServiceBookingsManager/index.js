import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Grid,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import { toast } from "react-toastify";
import moment from "moment";

import useServiceBookings from "../../hooks/useServiceBookings";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "confirmed", label: "Confirmados" },
  { value: "pending_payment", label: "Aguardando pagamento" },
  { value: "scheduled", label: "Agendados" },
  { value: "expired", label: "Expirados" },
  { value: "cancelled", label: "Cancelados" }
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "not_required", label: "Nao obrigatorio" },
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
  { value: "expired", label: "Expirado" },
  { value: "failed", label: "Falhou" },
  { value: "refunded", label: "Estornado" }
];

const useStyles = makeStyles(theme => ({
  root: {
    border: "1px solid #f3f4f6",
    borderRadius: 12,
    padding: theme.spacing(2),
    backgroundColor: "#ffffff"
  },
  title: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#155e75",
    marginBottom: theme.spacing(1.5)
  },
  filters: {
    marginBottom: theme.spacing(1.5)
  },
  fieldControl: {
    "& .MuiFormLabel-root": {
      fontSize: "0.75rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: "#4b5563"
    },
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor: "#ffffff",
      "& fieldset": {
        borderColor: "#e5e7eb"
      },
      "&:hover fieldset": {
        borderColor: "#0891b2"
      },
      "&.Mui-focused fieldset": {
        borderColor: "#0891b2"
      }
    }
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "2px 10px",
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase"
  },
  statusConfirmed: {
    backgroundColor: "#dcfce7",
    color: "#166534"
  },
  statusScheduled: {
    backgroundColor: "#e0f2fe",
    color: "#0c4a6e"
  },
  statusPendingPayment: {
    backgroundColor: "#fef9c3",
    color: "#854d0e"
  },
  statusExpired: {
    backgroundColor: "#f1f5f9",
    color: "#334155"
  },
  statusCancelled: {
    backgroundColor: "#fee2e2",
    color: "#991b1b"
  },
  statusDefault: {
    backgroundColor: "#f1f5f9",
    color: "#334155"
  },
  loadMoreArea: {
    marginTop: theme.spacing(1.25),
    display: "flex",
    justifyContent: "center"
  },
  btnCancel: {
    "&.MuiButton-root": {
      color: "#b91c1c",
      borderColor: "#fecaca",
      textTransform: "none",
      fontWeight: 700
    }
  },
  btnConfirmPayment: {
    "&.MuiButton-root": {
      color: "#166534",
      borderColor: "#86efac",
      textTransform: "none",
      fontWeight: 700
    }
  },
  btnRegeneratePix: {
    "&.MuiButton-root": {
      color: "#0c4a6e",
      borderColor: "#bae6fd",
      textTransform: "none",
      fontWeight: 700
    }
  },
  actionButtons: {
    display: "flex",
    gap: theme.spacing(0.75),
    justifyContent: "flex-end"
  },
  emptyHint: {
    fontSize: "0.8rem",
    color: "#6b7280"
  }
}));

const getStatusLabel = status => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "confirmed") return "Confirmado";
  if (normalized === "scheduled") return "Agendado";
  if (normalized === "pending_payment") return "Aguardando pagamento";
  if (normalized === "expired") return "Expirado";
  if (normalized === "cancelled") return "Cancelado";
  return normalized || "desconhecido";
};

const getPaymentStatusLabel = paymentStatus => {
  const normalized = String(paymentStatus || "").toLowerCase();
  if (normalized === "not_required") return "Nao obrigatorio";
  if (normalized === "pending") return "Pendente";
  if (normalized === "paid") return "Pago";
  if (normalized === "expired") return "Expirado";
  if (normalized === "failed") return "Falhou";
  if (normalized === "refunded") return "Estornado";
  return normalized || "desconhecido";
};

const getPaymentOriginLabel = booking => {
  const origin = String(booking?.contextJson?.payment?.lastConfirmationSource || "")
    .trim()
    .toLowerCase();
  const provider = String(booking?.pixProvider || "").trim().toLowerCase();
  const isPendingPayment =
    String(booking?.paymentStatus || "").toLowerCase() === "pending" &&
    String(booking?.status || "").toLowerCase() === "pending_payment";

  if (isPendingPayment && provider === "manual") {
    return "Pendente manual (admin)";
  }

  if (isPendingPayment && provider === "gerencianet") {
    return "Pendente auto (PSP)";
  }

  if (origin === "manual") return "Manual (Fallback)";
  if (origin === "webhook") return "Automatico (Webhook)";
  if (origin === "internal") return "Automatico (Reconc.)";
  return "-";
};

const getLastProviderSyncLabel = booking => {
  const provider = String(booking?.pixProvider || "").trim().toLowerCase();
  if (provider === "manual") {
    return "Nao aplicavel (PIX manual)";
  }

  const sync = booking?.contextJson?.payment?.lastProviderSync;
  if (!sync || typeof sync !== "object") {
    return "-";
  }

  const status = String(sync.status || "")
    .trim()
    .toLowerCase();
  const source = String(sync.source || "")
    .trim()
    .toLowerCase();
  const at = sync.at ? moment(sync.at).format("DD/MM HH:mm") : "-";

  const sourceLabel =
    source === "webhook"
      ? "Webhook"
      : source === "reconciliation"
      ? "Reconc."
      : source || "-";

  const statusLabel =
    status === "paid"
      ? "Pago"
      : status === "pending"
      ? "Pendente"
      : status === "expired"
      ? "Expirado"
      : status === "unknown"
      ? "Desconhecido"
      : status || "-";

  return `${statusLabel} (${sourceLabel}) ${at}`.trim();
};

const getPixProviderLabel = booking => {
  const provider = String(booking?.pixProvider || "").trim().toLowerCase();
  if (provider === "gerencianet") return "Automatico (Gerencianet)";
  if (provider === "manual") return "Manual (chave/copia e cola)";
  return "-";
};

const getPixDetectionModeLabel = booking => {
  const provider = String(booking?.pixProvider || "").trim().toLowerCase();
  if (provider === "gerencianet") return "Deteccao automatica";
  if (provider === "manual") return "Confirmacao manual";
  return "-";
};

const ServiceBookingsManager = () => {
  const classes = useStyles();
  const { list, cancel, confirmPayment, regeneratePixPayment } = useServiceBookings();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const statusClass = useMemo(
    () => (value => {
      const normalized = String(value || "").toLowerCase();
      if (normalized === "confirmed") return classes.statusConfirmed;
      if (normalized === "scheduled") return classes.statusScheduled;
      if (normalized === "pending_payment") return classes.statusPendingPayment;
      if (normalized === "expired") return classes.statusExpired;
      if (normalized === "cancelled") return classes.statusCancelled;
      return classes.statusDefault;
    }),
    [classes]
  );

  const loadBookings = useCallback(
    async ({ reset = false, page = 1 } = {}) => {
      const targetPage = reset ? 1 : page;
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await list({
          pageNumber: targetPage,
          status,
          paymentStatus,
          searchParam,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        });

        const listRows = Array.isArray(response?.bookings) ? response.bookings : [];

        setBookings(prev =>
          reset ? listRows : [...prev, ...listRows.filter(item => !prev.some(prevRow => prevRow.id === item.id))]
        );
        setHasMore(Boolean(response?.hasMore));
        if (reset) {
          setPageNumber(1);
        }
      } catch (error) {
        toast.error("Nao foi possivel carregar os agendamentos.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [list, status, paymentStatus, searchParam, startDate, endDate]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBookings({ reset: true });
    }, 300);

    return () => clearTimeout(timer);
  }, [status, paymentStatus, searchParam, startDate, endDate, loadBookings]);

  useEffect(() => {
    if (pageNumber === 1) return;
    loadBookings({ reset: false, page: pageNumber });
  }, [pageNumber, loadBookings]);

  const handleCancelBooking = async booking => {
    if (!booking?.id || String(booking?.status) === "cancelled") {
      return;
    }

    const shouldCancel = window.confirm("Deseja cancelar este agendamento?");
    if (!shouldCancel) return;

    try {
      await cancel(booking.id);
      toast.success("Agendamento cancelado.");
      loadBookings({ reset: true, page: 1 });
    } catch (error) {
      toast.error("Nao foi possivel cancelar o agendamento.");
    }
  };

  const handleConfirmPayment = async booking => {
    if (!booking?.id) {
      return;
    }

    const shouldConfirm = window.confirm(
      "Confirmar pagamento deste agendamento?"
    );
    if (!shouldConfirm) return;

    try {
      await confirmPayment(booking.id, {});
      toast.success("Pagamento confirmado.");
      loadBookings({ reset: true, page: 1 });
    } catch (error) {
      toast.error("Nao foi possivel confirmar pagamento.");
    }
  };

  const handleRegeneratePix = async booking => {
    if (!booking?.id) {
      return;
    }

    const shouldRegenerate = window.confirm(
      "Reenviar instrucoes PIX para este agendamento?"
    );
    if (!shouldRegenerate) return;

    try {
      await regeneratePixPayment(booking.id, {});
      toast.success("Instrucoes PIX reenviadas.");
      loadBookings({ reset: true, page: 1 });
    } catch (error) {
      toast.error("Nao foi possivel reenviar PIX.");
    }
  };

  return (
    <Paper className={classes.root} elevation={0}>
      <Typography className={classes.title}>Gestao de agendamentos</Typography>

      <Grid container spacing={1} className={classes.filters}>
        <Grid xs={12} sm={6} md={4} item>
          <TextField
            fullWidth
            margin="dense"
            variant="outlined"
            label="Buscar cliente"
            className={classes.fieldControl}
            value={searchParam}
            onChange={event => setSearchParam(event.target.value)}
          />
        </Grid>
        <Grid xs={12} sm={6} md={2} item>
          <TextField
            select
            fullWidth
            margin="dense"
            variant="outlined"
            label="Status"
            className={classes.fieldControl}
            value={status}
            onChange={event => setStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid xs={12} sm={6} md={2} item>
          <TextField
            select
            fullWidth
            margin="dense"
            variant="outlined"
            label="Pagamento"
            className={classes.fieldControl}
            value={paymentStatus}
            onChange={event => setPaymentStatus(event.target.value)}
          >
            {PAYMENT_STATUS_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid xs={12} sm={6} md={2} item>
          <TextField
            fullWidth
            margin="dense"
            type="date"
            variant="outlined"
            label="Data inicial"
            className={classes.fieldControl}
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={event => setStartDate(event.target.value)}
          />
        </Grid>
        <Grid xs={12} sm={6} md={2} item>
          <TextField
            fullWidth
            margin="dense"
            type="date"
            variant="outlined"
            label="Data final"
            className={classes.fieldControl}
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={event => setEndDate(event.target.value)}
          />
        </Grid>
      </Grid>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cliente</TableCell>
              <TableCell>Servico</TableCell>
              <TableCell>Data/Hora</TableCell>
              <TableCell>Conexao</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Pagamento</TableCell>
              <TableCell>Origem pgto</TableCell>
              <TableCell>Ultimo sync</TableCell>
              <TableCell>Referencia</TableCell>
              <TableCell>Provider PIX</TableCell>
              <TableCell>Modo deteccao</TableCell>
              <TableCell>PIX</TableCell>
              <TableCell>QR Code</TableCell>
              <TableCell align="right">Acoes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(bookings || []).map(booking => (
              <TableRow key={`service-booking-${booking.id}`}>
                <TableCell>
                  {booking?.contact?.name ||
                    booking?.customerNameSnapshot ||
                    "Cliente sem nome"}
                </TableCell>
                <TableCell>{booking?.companyService?.name || "-"}</TableCell>
                <TableCell>
                  {booking?.startAt
                    ? moment(booking.startAt).format("DD/MM/YYYY HH:mm")
                    : "-"}
                </TableCell>
                <TableCell>{booking?.whatsapp?.name || booking?.whatsapp?.number || "-"}</TableCell>
                <TableCell>
                  <span className={`${classes.statusBadge} ${statusClass(booking?.status)}`}>
                    {getStatusLabel(booking?.status)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`${classes.statusBadge} ${statusClass(booking?.paymentStatus)}`}>
                    {getPaymentStatusLabel(booking?.paymentStatus)}
                  </span>
                </TableCell>
                <TableCell>{getPaymentOriginLabel(booking)}</TableCell>
                <TableCell>{getLastProviderSyncLabel(booking)}</TableCell>
                <TableCell>{booking?.paymentReference || "-"}</TableCell>
                <TableCell>{getPixProviderLabel(booking)}</TableCell>
                <TableCell>{getPixDetectionModeLabel(booking)}</TableCell>
                <TableCell>
                  {booking?.pixTxId ? (
                    <>
                      txid: {booking.pixTxId}
                      <br />
                      expira:{" "}
                      {booking?.pixExpiresAt
                        ? moment(booking.pixExpiresAt).format("DD/MM HH:mm")
                        : "-"}
                    </>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{booking?.pixQrCode ? "Sim" : "Nao"}</TableCell>
                <TableCell align="right">
                  {String(booking?.status || "") === "cancelled" ||
                  String(booking?.status || "") === "expired" ? (
                    "-"
                  ) : (
                    <div className={classes.actionButtons}>
                      {String(booking?.paymentStatus || "") === "pending" &&
                      String(booking?.status || "") === "pending_payment" ? (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            className={classes.btnRegeneratePix}
                            onClick={() => handleRegeneratePix(booking)}
                          >
                            Regerar PIX
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            className={classes.btnConfirmPayment}
                            onClick={() => handleConfirmPayment(booking)}
                          >
                            {String(booking?.pixProvider || "").toLowerCase() === "manual"
                              ? "Confirmar manual"
                              : "Confirmar contingencia"}
                          </Button>
                        </>
                      ) : null}
                      <Button
                        size="small"
                        variant="outlined"
                        className={classes.btnCancel}
                        onClick={() => handleCancelBooking(booking)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!loading && bookings.length === 0 ? (
        <span className={classes.emptyHint}>
          Nenhum agendamento encontrado para os filtros atuais.
        </span>
      ) : null}

      {hasMore ? (
        <div className={classes.loadMoreArea}>
          <Button
            variant="outlined"
            disabled={loading || loadingMore}
            onClick={() => setPageNumber(prev => prev + 1)}
          >
            {loadingMore ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      ) : null}
    </Paper>
  );
};

export default ServiceBookingsManager;
