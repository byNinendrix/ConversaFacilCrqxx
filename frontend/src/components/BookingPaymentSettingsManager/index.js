import React, { useEffect, useMemo, useState } from "react";
import {
  Grid,
  MenuItem,
  Paper,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import { toast } from "react-toastify";

import ButtonWithSpinner from "../ButtonWithSpinner";
import useServiceBookings from "../../hooks/useServiceBookings";

const PAYMENT_MODE_OPTIONS = [
  { value: "disabled", label: "Desativado" },
  { value: "optional", label: "Opcional" },
  { value: "required", label: "Obrigatorio" }
];

const DEPOSIT_TYPE_OPTIONS = [
  { value: "fixed", label: "Valor fixo" },
  { value: "percentage", label: "Percentual (%)" }
];

const PIX_KEY_TYPE_OPTIONS = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Aleatoria" }
];

const PIX_SEND_MODE_OPTIONS = [
  { value: "copy_paste", label: "Somente copia e cola" },
  { value: "instructions", label: "Somente instrucoes" },
  { value: "both", label: "Instrucoes e copia e cola" }
];

const useStyles = makeStyles(theme => ({
  root: {
    border: "1px solid #f3f4f6",
    borderRadius: 12,
    padding: theme.spacing(2),
    backgroundColor: "#ffffff",
    marginBottom: theme.spacing(2)
  },
  title: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#155e75",
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
  actions: {
    marginTop: theme.spacing(1.5),
    display: "flex",
    justifyContent: "flex-end"
  },
  btnPrimary: {
    "&.MuiButton-root": {
      borderRadius: 12,
      fontWeight: 700,
      textTransform: "none",
      backgroundColor: "#0e7490",
      color: "#ffffff",
      "&:hover": {
        backgroundColor: "#155e75"
      }
    }
  },
  hint: {
    fontSize: "0.78rem",
    color: "#64748b"
  }
}));

const defaultForm = {
  paymentMode: "disabled",
  depositType: "fixed",
  depositValue: 0,
  paymentHoldMinutes: 15,
  paymentInstructions: "",
  pixEnabled: false,
  pixKey: "",
  pixKeyType: "random",
  pixRecipientName: "",
  pixCity: "",
  pixSendMode: "both"
};

const parseNumber = (value, fallback) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  const normalized = String(value || "")
    .replace(/[Rr]\$\s*/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const formatBRL = value =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const asBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["1", "true", "enabled", "yes", "sim"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "disabled", "no", "nao", "não"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const BookingPaymentSettingsManager = () => {
  const classes = useStyles();
  const { getPaymentSettings, updatePaymentSettings } = useServiceBookings();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const canSave = useMemo(() => !loading && !saving, [loading, saving]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await getPaymentSettings();
      const pixSettings = response?.pix || {};
      setForm({
        paymentMode: String(response?.paymentMode || "disabled"),
        depositType: String(response?.depositType || "fixed"),
        depositValue: parseNumber(response?.depositValue, 0),
        paymentHoldMinutes: parseNumber(response?.paymentHoldMinutes, 15),
        paymentInstructions: String(response?.paymentInstructions || ""),
        pixEnabled: asBoolean(pixSettings?.enabled, false),
        pixKey: String(pixSettings?.key || ""),
        pixKeyType: String(pixSettings?.keyType || "random"),
        pixRecipientName: String(pixSettings?.recipientName || ""),
        pixCity: String(pixSettings?.city || ""),
        pixSendMode: String(pixSettings?.sendMode || "both")
      });
    } catch (error) {
      toast.error("Nao foi possivel carregar configuracoes de pagamento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (key, value) => {
    setForm(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleDepositValueChange = value => {
    if (String(form.depositType) === "percentage") {
      handleChange("depositValue", value);
      return;
    }

    const digitsOnly = String(value || "").replace(/\D/g, "");
    if (!digitsOnly) {
      handleChange("depositValue", "");
      return;
    }

    const cents = Number(digitsOnly);
    const decimalValue = Number((cents / 100).toFixed(2));
    handleChange("depositValue", decimalValue);
  };

  const depositDisplayValue = useMemo(() => {
    if (String(form.depositType) === "percentage") {
      return form.depositValue;
    }

    const numericValue = parseNumber(form.depositValue, 0);
    return formatBRL(numericValue);
  }, [form.depositType, form.depositValue]);

  const validate = () => {
    const depositValue = parseNumber(form.depositValue, NaN);
    if (!Number.isFinite(depositValue) || depositValue < 0) {
      return "Informe um valor de sinal valido.";
    }

    if (String(form.depositType) === "percentage" && depositValue > 100) {
      return "Percentual deve estar entre 0 e 100.";
    }

    if (
      String(form.paymentMode) === "required" &&
      Number(depositValue) <= 0
    ) {
      return "Modo obrigatorio exige valor de sinal maior que zero.";
    }

    const holdMinutes = parseNumber(form.paymentHoldMinutes, NaN);
    if (!Number.isFinite(holdMinutes) || holdMinutes < 1 || holdMinutes > 1440) {
      return "Prazo de pagamento deve estar entre 1 e 1440 minutos.";
    }

    if (asBoolean(form.pixEnabled, false)) {
      if (!String(form.pixKey || "").trim()) {
        return "Informe a chave PIX.";
      }

      if (!String(form.pixRecipientName || "").trim()) {
        return "Informe o nome do favorecido PIX.";
      }

      if (!String(form.pixCity || "").trim()) {
        return "Informe a cidade PIX.";
      }
    }

    return null;
  };

  const handleSave = async () => {
    if (!canSave) return;

    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        paymentMode: String(form.paymentMode || "disabled"),
        depositType: String(form.depositType || "fixed"),
        depositValue: Number(parseNumber(form.depositValue, 0).toFixed(2)),
        paymentHoldMinutes: Math.trunc(parseNumber(form.paymentHoldMinutes, 15)),
        paymentInstructions: String(form.paymentInstructions || "").trim(),
        pixEnabled: asBoolean(form.pixEnabled, false),
        pixKey: String(form.pixKey || "").trim(),
        pixKeyType: String(form.pixKeyType || "random"),
        pixRecipientName: String(form.pixRecipientName || "").trim(),
        pixCity: String(form.pixCity || "").trim(),
        pixSendMode: String(form.pixSendMode || "both")
      };

      const response = await updatePaymentSettings(payload);
      const responsePix = response?.pix || {};
      setForm({
        paymentMode: String(response?.paymentMode || payload.paymentMode),
        depositType: String(response?.depositType || payload.depositType),
        depositValue: parseNumber(response?.depositValue, payload.depositValue),
        paymentHoldMinutes: parseNumber(
          response?.paymentHoldMinutes,
          payload.paymentHoldMinutes
        ),
        paymentInstructions: String(
          response?.paymentInstructions || payload.paymentInstructions
        ),
        pixEnabled: asBoolean(responsePix?.enabled, payload.pixEnabled),
        pixKey: String(responsePix?.key || payload.pixKey),
        pixKeyType: String(responsePix?.keyType || payload.pixKeyType),
        pixRecipientName: String(
          responsePix?.recipientName || payload.pixRecipientName
        ),
        pixCity: String(responsePix?.city || payload.pixCity),
        pixSendMode: String(responsePix?.sendMode || payload.pixSendMode)
      });
      toast.success("Configuracoes de pagamento atualizadas.");
    } catch (error) {
      toast.error("Nao foi possivel salvar configuracoes de pagamento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper className={classes.root} elevation={0}>
      <Typography className={classes.title}>
        Sinal e pagamento de agendamento
      </Typography>

      <Grid container spacing={1}>
        <Grid xs={12} sm={4} item>
          <TextField
            select
            fullWidth
            margin="dense"
            variant="outlined"
            label="Modo de pagamento"
            className={classes.fieldControl}
            value={form.paymentMode}
            onChange={event => handleChange("paymentMode", event.target.value)}
          >
            {PAYMENT_MODE_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid xs={12} sm={4} item>
          <TextField
            select
            fullWidth
            margin="dense"
            variant="outlined"
            label="Tipo de sinal"
            className={classes.fieldControl}
            value={form.depositType}
            disabled={String(form.paymentMode) === "disabled"}
            onChange={event => handleChange("depositType", event.target.value)}
          >
            {DEPOSIT_TYPE_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid xs={12} sm={4} item>
          <TextField
            fullWidth
            margin="dense"
            variant="outlined"
            label={
              String(form.depositType) === "percentage"
                ? "Valor do sinal (%)"
                : "Valor do sinal (R$)"
            }
            className={classes.fieldControl}
            value={depositDisplayValue}
            disabled={String(form.paymentMode) === "disabled"}
            onChange={event => handleDepositValueChange(event.target.value)}
            inputProps={
              String(form.depositType) === "percentage"
                ? { inputMode: "decimal" }
                : { inputMode: "numeric" }
            }
          />
        </Grid>

        <Grid xs={12} sm={4} item>
          <TextField
            fullWidth
            margin="dense"
            type="number"
            variant="outlined"
            label="Prazo pagamento (min)"
            className={classes.fieldControl}
            value={form.paymentHoldMinutes}
            disabled={String(form.paymentMode) !== "required"}
            onChange={event =>
              handleChange("paymentHoldMinutes", event.target.value)
            }
          />
        </Grid>

        <Grid xs={12} sm={8} item>
          <TextField
            fullWidth
            margin="dense"
            multiline
            minRows={2}
            variant="outlined"
            label="Instrucoes de pagamento (opcional)"
            className={classes.fieldControl}
            value={form.paymentInstructions}
            onChange={event =>
              handleChange("paymentInstructions", event.target.value)
            }
          />
        </Grid>

        <Grid xs={12} sm={4} item>
          <TextField
            select
            fullWidth
            margin="dense"
            variant="outlined"
            label="PIX para agendamento"
            className={classes.fieldControl}
            value={form.pixEnabled ? "enabled" : "disabled"}
            onChange={event =>
              handleChange("pixEnabled", event.target.value === "enabled")
            }
          >
            <MenuItem value="disabled">Desativado</MenuItem>
            <MenuItem value="enabled">Ativado</MenuItem>
          </TextField>
        </Grid>

        <Grid xs={12} sm={4} item>
          <TextField
            select
            fullWidth
            margin="dense"
            variant="outlined"
            label="Tipo da chave PIX"
            className={classes.fieldControl}
            value={form.pixKeyType}
            disabled={!asBoolean(form.pixEnabled, false)}
            onChange={event => handleChange("pixKeyType", event.target.value)}
          >
            {PIX_KEY_TYPE_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid xs={12} sm={4} item>
          <TextField
            select
            fullWidth
            margin="dense"
            variant="outlined"
            label="Modo de envio PIX"
            className={classes.fieldControl}
            value={form.pixSendMode}
            disabled={!asBoolean(form.pixEnabled, false)}
            onChange={event => handleChange("pixSendMode", event.target.value)}
          >
            {PIX_SEND_MODE_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid xs={12} sm={6} item>
          <TextField
            fullWidth
            margin="dense"
            variant="outlined"
            label="Chave PIX"
            className={classes.fieldControl}
            value={form.pixKey}
            disabled={!asBoolean(form.pixEnabled, false)}
            onChange={event => handleChange("pixKey", event.target.value)}
          />
        </Grid>

        <Grid xs={12} sm={3} item>
          <TextField
            fullWidth
            margin="dense"
            variant="outlined"
            label="Favorecido"
            className={classes.fieldControl}
            value={form.pixRecipientName}
            disabled={!asBoolean(form.pixEnabled, false)}
            onChange={event =>
              handleChange("pixRecipientName", event.target.value)
            }
          />
        </Grid>

        <Grid xs={12} sm={3} item>
          <TextField
            fullWidth
            margin="dense"
            variant="outlined"
            label="Cidade PIX"
            className={classes.fieldControl}
            value={form.pixCity}
            disabled={!asBoolean(form.pixEnabled, false)}
            onChange={event => handleChange("pixCity", event.target.value)}
          />
        </Grid>
      </Grid>

      <span className={classes.hint}>
        Quando o modo for obrigatorio, o horario fica reservado at\u00e9 o prazo
        informado.
      </span>

      <div className={classes.actions}>
        <ButtonWithSpinner
          loading={saving || loading}
          onClick={handleSave}
          variant="contained"
          className={classes.btnPrimary}
        >
          Salvar configuracoes de pagamento
        </ButtonWithSpinner>
      </div>
    </Paper>
  );
};

export default BookingPaymentSettingsManager;
