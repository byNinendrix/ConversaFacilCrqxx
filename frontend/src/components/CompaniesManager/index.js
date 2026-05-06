import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  makeStyles,
} from "@material-ui/core";
import { Field, Form, Formik } from "formik";
import React, { useEffect, useState } from "react";
import ButtonWithSpinner from "../ButtonWithSpinner";
import ConfirmationModal from "../ConfirmationModal";

import {
  AddCircleOutline as AddCircleOutlineIcon,
  Build as BuildIcon,
  DeleteOutline as DeleteOutlineIcon,
  Edit as EditIcon,
} from "@material-ui/icons";

import { has, head, isArray } from "lodash";
import { toast } from "react-toastify";
import useCompanies from "../../hooks/useCompanies";
import { useDate } from "../../hooks/useDate";
import usePlans from "../../hooks/usePlans";
import api from "../../services/api";
import ModalUsers from "../ModalUsers";

import moment from "moment";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
  },
  mainPaper: {
    width: "100%",
    flex: 1,
    borderRadius: 16,
    border: "1px solid #f3f4f6",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
    padding: theme.spacing(2.5),
    backgroundColor: "#ffffff",
  },
  fullWidth: {
    width: "100%",
  },
  formCard: {
    border: "1px solid #f3f4f6",
    borderRadius: 12,
    padding: theme.spacing(1.5),
    backgroundColor: "#ffffff",
  },
  sectionTitle: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#155e75",
    marginBottom: theme.spacing(1.5),
  },
  fieldControl: {
    "& .MuiFormLabel-root": {
      fontSize: "0.75rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: "#4b5563",
    },
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor: "#ffffff",
      transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      "& fieldset": {
        borderColor: "#e5e7eb",
      },
      "&:hover fieldset": {
        borderColor: "#0891b2",
      },
      "&.Mui-focused fieldset": {
        borderColor: "#0891b2",
        boxShadow: "0 0 0 3px rgba(8, 145, 178, 0.12)",
      },
    },
    "& .MuiOutlinedInput-input": {
      fontSize: "0.875rem",
      padding: "12px 14px",
    },
  },
  tableContainer: {
    width: "100%",
    overflowX: "auto",
    border: "1px solid #f3f4f6",
    borderRadius: 12,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
    ...theme.scrollbarStyles,
  },
  tableRoot: {
    minWidth: 1260,
  },
  tableHead: {
    backgroundColor: "#f8fafc",
  },
  tableHeadCell: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid #e5e7eb",
    padding: "10px 12px",
    whiteSpace: "nowrap",
  },
  tableBodyCell: {
    fontSize: "0.875rem",
    color: "#111827",
    borderBottom: "1px solid #f3f4f6",
    padding: "10px 12px",
    whiteSpace: "nowrap",
  },
  editButton: {
    color: "#0e7490",
    "&:hover": {
      backgroundColor: "#ecfeff",
    },
  },
  serviceActionButton: {
    color: "#0369a1",
    "&:hover": {
      backgroundColor: "#e0f2fe",
    },
  },
  actionsRow: {
    marginTop: theme.spacing(1.5),
    borderTop: "2px solid #f3f4f6",
    paddingTop: theme.spacing(1.5),
  },
  btnSecondary: {
    "&.MuiButton-root": {
      borderRadius: 12,
      fontWeight: 700,
      textTransform: "none",
      backgroundColor: "#f3f4f6",
      color: "#374151",
      transition: "background-color 0.2s ease",
      "&:hover": {
        backgroundColor: "#e5e7eb",
      },
    },
  },
  btnDanger: {
    "&.MuiButton-root": {
      borderRadius: 12,
      fontWeight: 700,
      textTransform: "none",
      backgroundColor: "#dc2626",
      color: "#ffffff",
      transition: "background-color 0.2s ease",
      "&:hover": {
        backgroundColor: "#b91c1c",
      },
    },
  },
  btnPrimary: {
    "&.MuiButton-root": {
      borderRadius: 12,
      fontWeight: 700,
      textTransform: "none",
      backgroundColor: "#0e7490",
      color: "#ffffff",
      transition: "background-color 0.2s ease",
      "&:hover": {
        backgroundColor: "#155e75",
      },
    },
  },
  dueInfo: {
    display: "block",
    marginTop: 2,
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  servicesBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: theme.spacing(1.5),
    backgroundColor: "#f8fafc",
  },
  servicesHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    flexWrap: "wrap",
  },
  servicesTitle: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#155e75",
  },
  serviceRow: {
    marginBottom: theme.spacing(1),
  },
  addServiceButton: {
    "&.MuiButton-root": {
      borderRadius: 10,
      textTransform: "none",
      fontWeight: 700,
      color: "#0e7490",
      borderColor: "#0891b2",
    },
  },
  removeServiceButton: {
    color: "#b91c1c",
    "&:hover": {
      backgroundColor: "#fef2f2",
    },
  },
  servicesHint: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  tableServicesCell: {
    fontSize: "0.875rem",
    color: "#111827",
    borderBottom: "1px solid #f3f4f6",
    padding: "10px 12px",
    whiteSpace: "normal",
    minWidth: 240,
  },
}));

const mapCompanyServicesToForm = (services = []) => {
  if (!Array.isArray(services)) {
    return [];
  }

  return services.map((service) => ({
    id: service.id,
    name: service.name || "",
    price:
      service.price === null || service.price === undefined
        ? ""
        : formatMoneyMaskFromNumber(service.price),
  }));
};

const parseMoneyToNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }

  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    return NaN;
  }

  const normalizedValue = rawValue.includes(",")
    ? rawValue.replace(/\./g, "").replace(",", ".")
    : rawValue;

  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const formatMoneyMaskFromNumber = (value) => {
  const normalizedNumber = parseMoneyToNumber(value);

  if (!Number.isFinite(normalizedNumber)) {
    return "";
  }

  return normalizedNumber.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatMoneyMaskFromInput = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  const numericValue = Number(digits) / 100;
  return numericValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getCampaignsEnabledFromSettings = (settings = []) => {
  const normalizedSettings = Array.isArray(settings) ? settings : [];
  const setting = normalizedSettings.find(
    (item) => String(item?.key || "").indexOf("campaignsEnabled") > -1
  );

  if (!setting) {
    return false;
  }

  return setting.value === "true" || setting.value === "enabled";
};

const getBooleanSettingFromSettings = (
  settings = [],
  key = "",
  fallbackValue = false
) => {
  const normalizedSettings = Array.isArray(settings) ? settings : [];
  const setting = normalizedSettings
    .filter(item => String(item?.key || "").trim() === String(key || "").trim())
    .sort((a, b) => {
      const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      return bTime - aTime;
    })[0];

  if (!setting) {
    return fallbackValue;
  }

  const normalizedValue = String(setting.value || "")
    .trim()
    .toLowerCase();

  if (["true", "enabled", "1", "yes", "sim"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "disabled", "0", "no", "nao"].includes(normalizedValue)) {
    return false;
  }

  return fallbackValue;
};

const normalizeBooleanValue = (value, fallbackValue = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase();

  if (["true", "enabled", "1", "yes", "sim"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "disabled", "0", "no", "nao"].includes(normalizedValue)) {
    return false;
  }

  return fallbackValue;
};

const normalizeServicesForPayload = (services = []) => {
  if (!Array.isArray(services)) {
    return [];
  }

  return services
    .filter(
      (service) =>
        String(service?.name || "").trim().length > 0 ||
        String(service?.price ?? "").trim().length > 0
    )
    .map((service) => ({
      id: service?.id,
      name: String(service?.name || "").trim(),
      price: parseMoneyToNumber(service?.price),
    }));
};

const COMPANY_SERVICES_SETTING_KEY = "companyServicesCatalog";

const parseCompanyServicesFromSettings = (settings = []) => {
  if (!Array.isArray(settings)) {
    return [];
  }

  const serviceSetting = settings.find(
    (setting) => String(setting?.key || "") === COMPANY_SERVICES_SETTING_KEY
  );

  if (!serviceSetting || typeof serviceSetting.value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(serviceSetting.value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((service) => ({
        id: service?.id,
        name: String(service?.name || "").trim(),
        price: parseMoneyToNumber(service?.price),
      }))
      .filter(
        (service) => service.name.length > 0 && Number.isFinite(service.price)
      );
  } catch (error) {
    return [];
  }
};

const getCompanyServicesFromRecord = (record = {}) => {
  const tableServices = Array.isArray(record?.companyServices)
    ? record.companyServices
    : [];

  if (tableServices.length > 0) {
    return tableServices;
  }

  return parseCompanyServicesFromSettings(record?.settings);
};

export function CompanyForm(props) {
  const { onSubmit, onDelete, onCancel, initialValue, loading } = props;
  const classes = useStyles();
  const [plans, setPlans] = useState([]);
  const [modalUser, setModalUser] = useState(false);
  const [firstUser, setFirstUser] = useState({});

  const [record, setRecord] = useState({
    name: "",
    email: "",
    phone: "",
    planId: "",
    status: true,
    campaignsEnabled: false,
    servicesEnabled: true,
    schedulingEnabled: true,
    dueDate: "",
    recurrence: "",
    companyServices: [],
    ...initialValue,
  });

  const { list: listPlans } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const list = await listPlans();
      setPlans(list);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRecord((prev) => {
      const nextValue = { ...initialValue };
      if (moment(nextValue?.dueDate).isValid()) {
        nextValue.dueDate = moment(nextValue.dueDate).format("YYYY-MM-DD");
      }

      return {
        ...prev,
        ...nextValue,
        companyServices: mapCompanyServicesToForm(nextValue.companyServices),
      };
    });
  }, [initialValue]);

  const handleSubmit = async (data) => {
    const payload = {
      ...data,
      campaignsEnabled: normalizeBooleanValue(data.campaignsEnabled, false),
      servicesEnabled: normalizeBooleanValue(data.servicesEnabled, true),
      schedulingEnabled: normalizeBooleanValue(data.schedulingEnabled, true),
    };

    if (payload.dueDate === "" || moment(payload.dueDate).isValid() === false) {
      payload.dueDate = null;
    }
    // A manutenção de serviços é feita apenas no modal de serviços da grade.
    // Removemos do payload para evitar zerar serviços em salvamentos do formulário principal.
    if (Object.prototype.hasOwnProperty.call(payload, "companyServices")) {
      delete payload.companyServices;
    }

    onSubmit(payload);
    setRecord({
      ...initialValue,
      dueDate: "",
      servicesEnabled: initialValue?.servicesEnabled ?? true,
      schedulingEnabled: initialValue?.schedulingEnabled ?? true,
      companyServices: mapCompanyServicesToForm(initialValue?.companyServices),
    });
  };

  const handleOpenModalUsers = async () => {
    try {
      const { data } = await api.get("/users/list", {
        params: {
          companyId: initialValue.id,
        },
      });
      if (isArray(data) && data.length) {
        setFirstUser(head(data));
      }
      setModalUser(true);
    } catch (e) {
      toast.error(e);
    }
  };

  const handleCloseModalUsers = () => {
    setFirstUser({});
    setModalUser(false);
  };

  const incrementDueDate = () => {
    const data = { ...record };
    if (data.dueDate !== "" && data.dueDate !== null) {
      switch (data.recurrence) {
        case "MENSAL":
          data.dueDate = moment(data.dueDate)
            .add(1, "month")
            .format("YYYY-MM-DD");
          break;
        case "BIMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(2, "month")
            .format("YYYY-MM-DD");
          break;
        case "TRIMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(3, "month")
            .format("YYYY-MM-DD");
          break;
        case "SEMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(6, "month")
            .format("YYYY-MM-DD");
          break;
        case "ANUAL":
          data.dueDate = moment(data.dueDate)
            .add(12, "month")
            .format("YYYY-MM-DD");
          break;
        default:
          break;
      }
    }
    setRecord(data);
  };

  return (
    <>
      <ModalUsers
        userId={firstUser.id}
        companyId={initialValue.id}
        open={modalUser}
        onClose={handleCloseModalUsers}
      />
      <Formik
        enableReinitialize
        className={classes.fullWidth}
        initialValues={record}
        onSubmit={(values, { resetForm }) =>
          setTimeout(() => {
            handleSubmit(values);
            resetForm();
          }, 500)
        }
      >
        {() => (
          <Form className={classes.fullWidth}>
            <div className={classes.formCard}>
            <div className={classes.sectionTitle}>Cadastro de empresa</div>
            <Grid spacing={2} justifyContent="flex-end" container>
              <Grid xs={12} sm={6} md={4} item>
                <Field
                  as={TextField}
                  label="Nome"
                  name="name"
                  variant="outlined"
                  className={`${classes.fullWidth} ${classes.fieldControl}`}
                  margin="dense"
                />
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <Field
                  as={TextField}
                  label="E-mail"
                  name="email"
                  variant="outlined"
                  className={`${classes.fullWidth} ${classes.fieldControl}`}
                  margin="dense"
                  required={!Boolean(record?.id)}
                />
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <Field
                  as={TextField}
                  label="Telefone"
                  name="phone"
                  variant="outlined"
                  className={`${classes.fullWidth} ${classes.fieldControl}`}
                  margin="dense"
                />
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                  <InputLabel htmlFor="plan-selection">Plano</InputLabel>
                  <Field
                    as={Select}
                    id="plan-selection"
                    label="Plano"
                    labelId="plan-selection-label"
                    name="planId"
                    margin="dense"
                    required
                  >
                    {plans.map((plan, key) => (
                      <MenuItem key={key} value={plan.id}>
                        {plan.name}
                      </MenuItem>
                    ))}
                  </Field>
                </FormControl>
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                  <InputLabel htmlFor="status-selection">Status</InputLabel>
                  <Field
                    as={Select}
                    id="status-selection"
                    label="Status"
                    labelId="status-selection-label"
                    name="status"
                    margin="dense"
                  >
                    <MenuItem value={true}>Sim</MenuItem>
                    <MenuItem value={false}>Não</MenuItem>
                  </Field>
                </FormControl>
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                  <InputLabel htmlFor="status-selection">Campanhas</InputLabel>
                  <Field
                    as={Select}
                    id="campaigns-selection"
                    label="Campanhas"
                    labelId="campaigns-selection-label"
                    name="campaignsEnabled"
                    margin="dense"
                  >
                    <MenuItem value={true}>Habilitadas</MenuItem>
                    <MenuItem value={false}>Desabilitadas</MenuItem>
                  </Field>
                </FormControl>
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                  <InputLabel htmlFor="services-selection">Serviços</InputLabel>
                  <Field
                    as={Select}
                    id="services-selection"
                    label="Serviços"
                    labelId="services-selection-label"
                    name="servicesEnabled"
                    margin="dense"
                  >
                    <MenuItem value={true}>Habilitados</MenuItem>
                    <MenuItem value={false}>Desabilitados</MenuItem>
                  </Field>
                </FormControl>
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                  <InputLabel htmlFor="scheduling-selection">Agendamentos</InputLabel>
                  <Field
                    as={Select}
                    id="scheduling-selection"
                    label="Agendamentos"
                    labelId="scheduling-selection-label"
                    name="schedulingEnabled"
                    margin="dense"
                  >
                    <MenuItem value={true}>Habilitados</MenuItem>
                    <MenuItem value={false}>Desabilitados</MenuItem>
                  </Field>
                </FormControl>
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <FormControl variant="outlined" fullWidth className={classes.fieldControl}>
                  <Field
                    as={TextField}
                    label="Data de Vencimento"
                    type="date"
                    name="dueDate"
                    InputLabelProps={{
                      shrink: true,
                    }}
                    variant="outlined"
                    fullWidth
                    className={`${classes.fullWidth} ${classes.fieldControl}`}
                    margin="dense"
                  />
                </FormControl>
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                  <InputLabel htmlFor="recorrencia-selection">
                    Recorrência
                  </InputLabel>
                  <Field
                    as={Select}
                    label="Recorrência"
                    labelId="recorrencia-selection-label"
                    id="recurrence"
                    name="recurrence"
                    margin="dense"
                  >
                    <MenuItem value="MENSAL">Mensal</MenuItem>
                    {/*<MenuItem value="BIMESTRAL">Bimestral</MenuItem>*/}
                    {/*<MenuItem value="TRIMESTRAL">Trimestral</MenuItem>*/}
                    {/*<MenuItem value="SEMESTRAL">Semestral</MenuItem>*/}
                    {/*<MenuItem value="ANUAL">Anual</MenuItem>*/}
                  </Field>
                </FormControl>
              </Grid>
              <Grid xs={12} item>
                <Grid justifyContent="flex-end" spacing={1} container className={classes.actionsRow}>
                  <Grid xs={4} md={1} item>
                    <ButtonWithSpinner
                      className={`${classes.fullWidth} ${classes.btnSecondary}`}
                      loading={loading}
                      onClick={() => onCancel()}
                      variant="contained"
                    >
                      Limpar
                    </ButtonWithSpinner>
                  </Grid>
                  {record.id !== undefined ? (
                    <>
                      <Grid xs={6} md={1} item>
                        <ButtonWithSpinner
                          className={`${classes.fullWidth} ${classes.btnDanger}`}
                          loading={loading}
                          onClick={() => onDelete(record)}
                          variant="contained"
                          color="secondary"
                        >
                          Excluir
                        </ButtonWithSpinner>
                      </Grid>
                      <Grid xs={6} md={2} item>
                        <ButtonWithSpinner
                          className={`${classes.fullWidth} ${classes.btnPrimary}`}
                          loading={loading}
                          onClick={() => incrementDueDate()}
                          variant="contained"
                          color="primary"
                        >
                          + Vencimento
                        </ButtonWithSpinner>
                      </Grid>
                      <Grid xs={6} md={1} item>
                        <ButtonWithSpinner
                          className={`${classes.fullWidth} ${classes.btnPrimary}`}
                          loading={loading}
                          onClick={() => handleOpenModalUsers()}
                          variant="contained"
                          color="primary"
                        >
                          Usuário
                        </ButtonWithSpinner>
                      </Grid>
                    </>
                  ) : null}
                  <Grid xs={6} md={1} item>
                    <ButtonWithSpinner
                      className={`${classes.fullWidth} ${classes.btnPrimary}`}
                      loading={loading}
                      type="submit"
                      variant="contained"
                      color="primary"
                    >
                      Salvar
                    </ButtonWithSpinner>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
            </div>
          </Form>
        )}
      </Formik>
    </>
  );
}

function CompanyServicesModal(props) {
  const { open, company, loading, loadingData, onClose, onSave } = props;
  const classes = useStyles();
  const [services, setServices] = useState([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setServices(mapCompanyServicesToForm(getCompanyServicesFromRecord(company)));
  }, [open, company]);

  const handleAddService = () => {
    setServices((prev) => [...prev, { name: "", price: "" }]);
  };

  const handleRemoveService = (indexToRemove) => {
    setServices((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== indexToRemove)
    );
  };

  const handleServiceChange = (index, key, value) => {
    setServices((prev) =>
      prev.map((service, currentIndex) => {
        if (currentIndex !== index) {
          return service;
        }

        return {
          ...service,
          [key]: value,
        };
      })
    );
  };

  const handleSubmit = () => {
    if (loadingData) {
      toast.info("Aguarde o carregamento dos servicos da empresa.");
      return;
    }

    const normalizedServices = normalizeServicesForPayload(services);
    const hasInvalidService = normalizedServices.some(
      (service) =>
        service.name.length === 0 ||
        !Number.isFinite(service.price) ||
        service.price < 0
    );

    if (hasInvalidService) {
      toast.error("Preencha nome e valor valido para cada servico.");
      return;
    }

    onSave(normalizedServices);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Servicos da empresa {company?.name || "-"}
      </DialogTitle>
      <DialogContent dividers>
        <div className={classes.servicesBox}>
          <div className={classes.servicesHeader}>
            <span className={classes.servicesTitle}>Servicos oferecidos</span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddCircleOutlineIcon />}
              className={classes.addServiceButton}
              onClick={handleAddService}
            >
              Adicionar servico
            </Button>
          </div>

          {services.length > 0 ? (
            services.map((service, index) => (
              <Grid
                container
                spacing={1}
                alignItems="center"
                className={classes.serviceRow}
                key={`service-modal-${service.id || "new"}-${index}`}
              >
                <Grid xs={12} md={7} item>
                  <TextField
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    label="Servico"
                    className={classes.fieldControl}
                    value={service.name || ""}
                    onChange={(event) =>
                      handleServiceChange(index, "name", event.target.value)
                    }
                  />
                </Grid>
                <Grid xs={10} md={4} item>
                  <TextField
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    label="Valor (R$)"
                    className={classes.fieldControl}
                    inputProps={{ inputMode: "decimal" }}
                    value={service.price ?? ""}
                    onChange={(event) =>
                      handleServiceChange(
                        index,
                        "price",
                        formatMoneyMaskFromInput(event.target.value)
                      )
                    }
                  />
                </Grid>
                <Grid xs={2} md={1} item>
                  <IconButton
                    className={classes.removeServiceButton}
                    onClick={() => handleRemoveService(index)}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))
          ) : (
            <span className={classes.servicesHint}>
              {loadingData
                ? "Carregando servicos da empresa..."
                : "Nenhum servico cadastrado para esta empresa."}
            </span>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} className={classes.btnSecondary}>
          Fechar
        </Button>
        <ButtonWithSpinner
          loading={loading || loadingData}
          onClick={handleSubmit}
          variant="contained"
          className={classes.btnPrimary}
        >
          Salvar servicos
        </ButtonWithSpinner>
      </DialogActions>
    </Dialog>
  );
}

export function CompaniesManagerGrid(props) {
  const { records, onSelect, onManageServices } = props;
  const classes = useStyles();
  const { dateToClient } = useDate();

  const renderStatus = (row) => {
    return row.status === false ? "Não" : "Sim";
  };

  const renderPlan = (row) => {
    return row.planId !== null && row.plan ? row.plan.name : "-";
  };

  const renderCampaignsStatus = (row) => {
    if (
      has(row, "settings") &&
      isArray(row.settings) &&
      row.settings.length > 0
    ) {
      const setting = row.settings.find((s) => s.key === "campaignsEnabled");
      if (setting) {
        return setting.value === "true" ? "Habilitadas" : "Desabilitadas";
      }
    }
    return "Desabilitadas";
  };

  const renderCompanyServices = (row) => {
    return getBooleanSettingFromSettings(row?.settings, "servicesEnabled", true)
      ? "Habilitados"
      : "Desabilitados";
  };

  const renderSchedulingStatus = (row) => {
    const fallbackByPlan = row?.plan?.useSchedules === false ? false : true;
    return getBooleanSettingFromSettings(
      row?.settings,
      "schedulingEnabled",
      fallbackByPlan
    )
      ? "Habilitados"
      : "Desabilitados";
  };

  const rowStyle = (record) => {
    if (moment(record.dueDate).isValid()) {
      const now = moment();
      const dueDate = moment(record.dueDate);
      const diff = dueDate.diff(now, "days");
      if (diff >= 1 && diff <= 5) {
        return { backgroundColor: "#fffead" };
      }
      if (diff <= 0) {
        return { backgroundColor: "#fa8c8c" };
      }
      // else {
      //   return { backgroundColor: "#affa8c" };
      // }
    }
    return {};
  };

  return (
    <Paper className={classes.tableContainer}>
      <Table
        className={`${classes.fullWidth} ${classes.tableRoot}`}
        size="small"
        aria-label="a dense table"
      >
        <TableHead className={classes.tableHead}>
          <TableRow>
            <TableCell className={classes.tableHeadCell} align="center" style={{ width: "1%" }}>
              Acoes
            </TableCell>
            <TableCell className={classes.tableHeadCell} align="left">Nome</TableCell>
            <TableCell className={classes.tableHeadCell} align="left">E-mail</TableCell>
            <TableCell className={classes.tableHeadCell} align="left">Telefone</TableCell>
            <TableCell className={classes.tableHeadCell} align="left">Plano</TableCell>
            <TableCell className={classes.tableHeadCell} align="left">Serviços</TableCell>
            <TableCell className={classes.tableHeadCell} align="left">Agendamentos</TableCell>
            <TableCell className={classes.tableHeadCell} align="left">Campanhas</TableCell>
            <TableCell className={classes.tableHeadCell} align="left">Status</TableCell>
            <TableCell className={classes.tableHeadCell} align="left">Criada Em</TableCell>
            <TableCell className={classes.tableHeadCell} align="left">Vencimento</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {records.map((row, key) => (
            <TableRow style={rowStyle(row)} key={key}>
              <TableCell className={classes.tableBodyCell} align="center" style={{ width: "1%" }}>
                <IconButton className={classes.editButton} onClick={() => onSelect(row)} aria-label="editar empresa">
                  <EditIcon />
                </IconButton>
                <IconButton
                  className={classes.serviceActionButton}
                  onClick={() => onManageServices(row)}
                  aria-label="gerenciar servicos"
                >
                  <BuildIcon />
                </IconButton>
              </TableCell>
              <TableCell className={classes.tableBodyCell} align="left">{row.name || "-"}</TableCell>
              <TableCell className={classes.tableBodyCell} align="left">{row.email || "-"}</TableCell>
              <TableCell className={classes.tableBodyCell} align="left">{row.phone || "-"}</TableCell>
              <TableCell className={classes.tableBodyCell} align="left">{renderPlan(row)}</TableCell>
              <TableCell className={classes.tableServicesCell} align="left">{renderCompanyServices(row)}</TableCell>
              <TableCell className={classes.tableBodyCell} align="left">{renderSchedulingStatus(row)}</TableCell>
              <TableCell className={classes.tableBodyCell} align="left">{renderCampaignsStatus(row)}</TableCell>
              <TableCell className={classes.tableBodyCell} align="left">{renderStatus(row)}</TableCell>
              <TableCell className={classes.tableBodyCell} align="left">{dateToClient(row.createdAt)}</TableCell>
              <TableCell className={classes.tableBodyCell} align="left">
                {dateToClient(row.dueDate)}
                <br />
                <span className={classes.dueInfo}>{row.recurrence}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

export default function CompaniesManager() {
  const classes = useStyles();
  const { list, save, update, remove, find, updateServices } = useCompanies();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingServicesData, setLoadingServicesData] = useState(false);
  const [records, setRecords] = useState([]);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [servicesCompany, setServicesCompany] = useState(null);
  const [record, setRecord] = useState({
    name: "",
    email: "",
    phone: "",
    planId: "",
    status: true,
    campaignsEnabled: false,
    servicesEnabled: true,
    schedulingEnabled: true,
    dueDate: "",
    recurrence: "",
    companyServices: [],
  });

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const companyList = await list();
      setRecords(companyList);
    } catch (e) {
      toast.error("Não foi possível carregar a lista de registros");
    }
    setLoading(false);
  };

  const handleSubmit = async (data) => {
    const payload = {
      ...data,
      campaignsEnabled: normalizeBooleanValue(data.campaignsEnabled, false),
      servicesEnabled: normalizeBooleanValue(data.servicesEnabled, true),
      schedulingEnabled: normalizeBooleanValue(data.schedulingEnabled, true),
    };

    setLoading(true);
    try {
      if (payload.id !== undefined) {
        await update(payload);
      } else {
        await save(payload);
      }
      await loadPlans();
      handleCancel();
      toast.success("Operação realizada com sucesso!");
    } catch (e) {
      toast.error(
        "Não foi possível realizar a operação. Verifique se já existe uma empresa com o mesmo nome ou se os campos foram preenchidos corretamente"
      );
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await remove(record.id);
      await loadPlans();
      handleCancel();
      toast.success("Operação realizada com sucesso!");
    } catch (e) {
      toast.error("Não foi possível realizar a operação");
    }
    setLoading(false);
  };

  const handleOpenDeleteDialog = () => {
    setShowConfirmDialog(true);
  };

  const handleCancel = () => {
    setRecord({
      name: "",
      email: "",
      phone: "",
      planId: "",
      status: true,
      campaignsEnabled: false,
      servicesEnabled: true,
      schedulingEnabled: true,
      dueDate: "",
      recurrence: "",
      companyServices: [],
    });
  };

  const handleSelect = (data) => {
    const campaignsEnabled = getCampaignsEnabledFromSettings(data.settings);
    const servicesEnabled = getBooleanSettingFromSettings(
      data.settings,
      "servicesEnabled",
      true
    );
    const schedulingEnabled = getBooleanSettingFromSettings(
      data.settings,
      "schedulingEnabled",
      data?.plan?.useSchedules === false ? false : true
    );

    setRecord((prev) => ({
      ...prev,
      id: data.id,
      name: data.name || "",
      phone: data.phone || "",
      email: data.email || "",
      planId: data.planId || "",
      status: data.status === false ? false : true,
      campaignsEnabled,
      servicesEnabled,
      schedulingEnabled,
      dueDate: data.dueDate || "",
      recurrence: data.recurrence || "",
      companyServices: mapCompanyServicesToForm(data.companyServices),
    }));
  };

  const handleOpenServicesModal = async (company) => {
    setServicesCompany(company);
    setServicesModalOpen(true);

    if (!company?.id) {
      return;
    }

    setLoadingServicesData(true);
    try {
      const fullCompany = await find(company.id);
      setServicesCompany((prev) => ({
        ...prev,
        ...fullCompany,
      }));
    } catch (error) {
      toast.error("Nao foi possivel carregar os servicos desta empresa.");
    } finally {
      setLoadingServicesData(false);
    }
  };

  const handleCloseServicesModal = () => {
    setServicesModalOpen(false);
    setServicesCompany(null);
    setLoadingServicesData(false);
  };

  const handleSaveCompanyServices = async (companyServices) => {
    if (!servicesCompany?.id) {
      toast.error("Empresa invalida para salvar servicos.");
      return;
    }

    setLoading(true);
    try {
      await updateServices(servicesCompany.id, companyServices, {
        allowLegacyFallback: true,
        fallbackPayload: {
          name: servicesCompany.name || "",
          phone: servicesCompany.phone || "",
          email: servicesCompany.email || "",
          status: servicesCompany.status === false ? false : true,
          planId: servicesCompany.planId,
          campaignsEnabled: getCampaignsEnabledFromSettings(servicesCompany.settings),
          servicesEnabled: getBooleanSettingFromSettings(
            servicesCompany.settings,
            "servicesEnabled",
            true
          ),
          schedulingEnabled: getBooleanSettingFromSettings(
            servicesCompany.settings,
            "schedulingEnabled",
            servicesCompany?.plan?.useSchedules === false ? false : true
          ),
          dueDate: servicesCompany.dueDate || null,
          recurrence: servicesCompany.recurrence || "",
        },
      });
      let refreshedCompany = null;
      try {
        refreshedCompany = await find(servicesCompany.id);
      } catch (error) {
        refreshedCompany = null;
      }

      const companyWithServices = refreshedCompany || {
        ...servicesCompany,
        companyServices,
      };

      setRecords((prev) =>
        prev.map((item) =>
          item.id === servicesCompany.id
            ? {
                ...item,
                ...companyWithServices,
                companyServices: Array.isArray(companyWithServices.companyServices)
                  ? companyWithServices.companyServices
                  : companyServices,
              }
            : item
        )
      );

      setServicesCompany((prev) => ({
        ...prev,
        ...companyWithServices,
        companyServices: Array.isArray(companyWithServices.companyServices)
          ? companyWithServices.companyServices
          : companyServices,
      }));

      if (record.id === servicesCompany.id) {
        setRecord((prev) => ({
          ...prev,
          companyServices: mapCompanyServicesToForm(
            Array.isArray(companyWithServices.companyServices)
              ? companyWithServices.companyServices
              : companyServices
          ),
        }));
      }
      handleCloseServicesModal();
      toast.success("Servicos atualizados com sucesso!");
    } catch (error) {
      toast.error("Nao foi possivel atualizar os servicos da empresa.");
    }
    setLoading(false);
  };

  return (
    <Paper className={`${classes.mainPaper} ${classes.root}`} elevation={0}>
      <Grid spacing={2} container>
        <Grid xs={12} item>
          <CompanyForm
            initialValue={record}
            onDelete={handleOpenDeleteDialog}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </Grid>
        <Grid xs={12} item>
          <CompaniesManagerGrid
            records={records}
            onSelect={handleSelect}
            onManageServices={handleOpenServicesModal}
          />
        </Grid>
      </Grid>
      <CompanyServicesModal
        open={servicesModalOpen}
        company={servicesCompany}
        loading={loading}
        loadingData={loadingServicesData}
        onClose={handleCloseServicesModal}
        onSave={handleSaveCompanyServices}
      />
      <ConfirmationModal
        title="Exclusão de Registro"
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => handleDelete()}
      >
        Deseja realmente excluir esse registro?
      </ConfirmationModal>
    </Paper>
  );
}
