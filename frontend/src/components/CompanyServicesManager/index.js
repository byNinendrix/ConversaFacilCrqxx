import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Grid,
  IconButton,
  Paper,
  TextField,
  Typography,
  FormControlLabel,
  MenuItem,
  Switch,
  makeStyles
} from "@material-ui/core";
import {
  AddCircleOutline as AddCircleOutlineIcon,
  DeleteOutline as DeleteOutlineIcon
} from "@material-ui/icons";
import { toast } from "react-toastify";

import ButtonWithSpinner from "../ButtonWithSpinner";
import useCompanies from "../../hooks/useCompanies";
import useSettings from "../../hooks/useSettings";

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terca" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sabado" }
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
  servicesBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: theme.spacing(1.5),
    backgroundColor: "#f8fafc"
  },
  servicesHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    flexWrap: "wrap"
  },
  servicesTitle: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#155e75"
  },
  serviceCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: theme.spacing(1.25),
    marginBottom: theme.spacing(1.25),
    backgroundColor: "#ffffff"
  },
  sectionCard: {
    border: "1px solid #f1f5f9",
    borderRadius: 10,
    padding: theme.spacing(1),
    backgroundColor: "#f8fafc",
    marginTop: theme.spacing(0.75)
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
  addServiceButton: {
    "&.MuiButton-root": {
      borderRadius: 10,
      textTransform: "none",
      fontWeight: 700,
      color: "#0e7490",
      borderColor: "#0891b2"
    }
  },
  addSectionButton: {
    "&.MuiButton-root": {
      borderRadius: 10,
      textTransform: "none",
      fontWeight: 700,
      color: "#0369a1",
      borderColor: "#0ea5e9"
    }
  },
  removeServiceButton: {
    color: "#b91c1c",
    "&:hover": {
      backgroundColor: "#fef2f2"
    }
  },
  sectionTitle: {
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#475569"
  },
  sectionHint: {
    fontSize: "0.75rem",
    color: "#64748b"
  },
  rowCard: {
    marginTop: theme.spacing(0.5),
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: theme.spacing(0.75),
    backgroundColor: "#ffffff"
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
  previewList: {
    marginTop: theme.spacing(0.5),
    display: "grid",
    gap: theme.spacing(0.4)
  },
  previewItem: {
    fontSize: "0.8rem",
    color: "#0f172a"
  }
}));

const parseMoneyToNumber = value => {
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

const parseInteger = (value, fallback, min = 0, max = 99999) => {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const rounded = Math.trunc(parsed);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
};

const parseOptionalInteger = (value, min = 1, max = 100) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const rounded = Math.trunc(parsed);
  if (rounded < min) return null;
  return Math.min(rounded, max);
};

const parseOptionalPositiveId = value => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const formatMoneyMaskFromNumber = value => {
  const normalizedNumber = parseMoneyToNumber(value);

  if (!Number.isFinite(normalizedNumber)) {
    return "";
  }

  return normalizedNumber.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatMoneyMaskFromInput = value => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  const numericValue = Number(digits) / 100;
  return numericValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const defaultServiceForm = {
  name: "",
  description: "",
  isActive: true,
  showPrice: true,
  displayOrder: 0,
  price: "",
  durationMinutes: 30,
  intervalMinutes: 0,
  minAdvanceMinutes: 60,
  maxAdvanceDays: 30,
  maxBookingsPerSlot: 1,
  availabilities: [],
  specificSlots: []
};

const mapAvailabilityToForm = availability => ({
  id: availability?.id,
  weekday: parseInteger(availability?.weekday, 1, 0, 6),
  startTime: String(availability?.startTime || "08:00"),
  endTime: String(availability?.endTime || "18:00"),
  capacity:
    availability?.capacity === null || availability?.capacity === undefined
      ? ""
      : String(availability.capacity),
  professionalId:
    availability?.professionalId === null || availability?.professionalId === undefined
      ? ""
      : String(availability.professionalId),
  isActive: availability?.isActive !== false
});

const mapSpecificSlotToForm = slot => ({
  id: slot?.id,
  slotDate: String(slot?.slotDate || ""),
  startTime: String(slot?.startTime || ""),
  endTime:
    slot?.endTime === null || slot?.endTime === undefined
      ? ""
      : String(slot?.endTime || ""),
  capacity:
    slot?.capacity === null || slot?.capacity === undefined
      ? ""
      : String(slot.capacity),
  professionalId:
    slot?.professionalId === null || slot?.professionalId === undefined
      ? ""
      : String(slot?.professionalId),
  isActive: slot?.isActive !== false
});

const mapCompanyServicesToForm = services => {
  if (!Array.isArray(services)) {
    return [];
  }

  return services.map(service => ({
    id: service?.id,
    name: String(service?.name || ""),
    description: String(service?.description || ""),
    isActive: service?.isActive !== false,
    showPrice: service?.showPrice !== false,
    displayOrder: parseInteger(service?.displayOrder, 0, 0, 9999),
    price:
      service?.price === null || service?.price === undefined
        ? ""
        : formatMoneyMaskFromNumber(service.price),
    durationMinutes: parseInteger(service?.durationMinutes, 30, 5, 1440),
    intervalMinutes: parseInteger(service?.intervalMinutes, 0, 0, 720),
    minAdvanceMinutes: parseInteger(service?.minAdvanceMinutes, 60, 0, 43200),
    maxAdvanceDays: parseInteger(service?.maxAdvanceDays, 30, 1, 365),
    maxBookingsPerSlot: parseInteger(service?.maxBookingsPerSlot, 1, 1, 100),
    availabilities: Array.isArray(service?.availabilities)
      ? service.availabilities.map(mapAvailabilityToForm)
      : [],
    specificSlots: Array.isArray(service?.specificSlots)
      ? service.specificSlots.map(mapSpecificSlotToForm)
      : []
  }));
};

const normalizeServicesForPayload = services => {
  if (!Array.isArray(services)) {
    return [];
  }

  return services
    .filter(
      service =>
        String(service?.name || "").trim().length > 0 ||
        String(service?.price ?? "").trim().length > 0
    )
    .map(service => ({
      id: service?.id,
      name: String(service?.name || "").trim(),
      description: String(service?.description || "").trim() || null,
      isActive: service?.isActive !== false,
      showPrice: service?.showPrice !== false,
      displayOrder: parseInteger(service?.displayOrder, 0, 0, 9999),
      price: parseMoneyToNumber(service?.price),
      durationMinutes: parseInteger(service?.durationMinutes, 30, 5, 1440),
      intervalMinutes: parseInteger(service?.intervalMinutes, 0, 0, 720),
      minAdvanceMinutes: parseInteger(service?.minAdvanceMinutes, 60, 0, 43200),
      maxAdvanceDays: parseInteger(service?.maxAdvanceDays, 30, 1, 365),
      maxBookingsPerSlot: parseInteger(service?.maxBookingsPerSlot, 1, 1, 100),
      availabilities: Array.isArray(service?.availabilities)
        ? service.availabilities
            .map(item => ({
              id: item?.id,
              weekday: parseInteger(item?.weekday, 1, 0, 6),
              startTime: String(item?.startTime || "").trim(),
              endTime: String(item?.endTime || "").trim(),
              capacity: parseOptionalInteger(item?.capacity, 1, 100),
              professionalId: parseOptionalPositiveId(item?.professionalId),
              isActive: item?.isActive !== false
            }))
            .filter(item => item.startTime && item.endTime)
        : [],
      specificSlots: Array.isArray(service?.specificSlots)
        ? service.specificSlots
            .map(item => ({
              id: item?.id,
              slotDate: String(item?.slotDate || "").trim(),
              startTime: String(item?.startTime || "").trim(),
              endTime: String(item?.endTime || "").trim() || null,
              capacity: parseOptionalInteger(item?.capacity, 1, 100),
              professionalId: parseOptionalPositiveId(item?.professionalId),
              isActive: item?.isActive !== false
            }))
            .filter(item => item.slotDate && item.startTime)
        : []
    }));
};

const COMPANY_SERVICES_SETTING_KEY = "companyServicesCatalog";

const parseServicesFromSetting = settings => {
  const normalizedSettings = Array.isArray(settings) ? settings : [];
  const targetSetting = normalizedSettings.find(
    item => String(item?.key || "") === COMPANY_SERVICES_SETTING_KEY
  );

  if (!targetSetting || typeof targetSetting.value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(targetSetting.value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(service => ({
        ...defaultServiceForm,
        id: service?.id,
        name: String(service?.name || "").trim(),
        price: formatMoneyMaskFromNumber(service?.price)
      }))
      .filter(service => service.name.length > 0);
  } catch (error) {
    return [];
  }
};

const normalizeServiceList = services => {
  if (!Array.isArray(services)) {
    return [];
  }

  return services
    .map(service => ({
      name: String(service?.name || "").trim(),
      price: parseMoneyToNumber(service?.price)
    }))
    .filter(service => service.name.length > 0 && Number.isFinite(service.price))
    .sort((first, second) => {
      const byName = first.name.localeCompare(second.name, "pt-BR");
      if (byName !== 0) {
        return byName;
      }
      return first.price - second.price;
    });
};

const hasSameServices = (left = [], right = []) => {
  const normalizedLeft = normalizeServiceList(left);
  const normalizedRight = normalizeServiceList(right);
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
};

const CompanyServicesManager = ({ companyId }) => {
  const classes = useStyles();
  const { find, updateServices, previewServiceSlots } = useCompanies();
  const { getAll: getAllSettings, update: updateSetting } = useSettings();

  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState(null);
  const [services, setServices] = useState([]);
  const [previewByServiceId, setPreviewByServiceId] = useState({});
  const [previewLoadingByServiceId, setPreviewLoadingByServiceId] = useState({});

  const canSave = useMemo(() => !loadingData && !saving, [loadingData, saving]);

  const clearFallbackServicesSetting = async () => {
    try {
      await updateSetting({
        key: COMPANY_SERVICES_SETTING_KEY,
        value: JSON.stringify([])
      });
    } catch (error) {
      // fallback cleanup is best effort
    }
  };

  const loadPreviewForService = async (targetCompanyId, serviceId) => {
    if (!targetCompanyId || !serviceId) {
      return;
    }

    setPreviewLoadingByServiceId(prev => ({ ...prev, [serviceId]: true }));
    try {
      const response = await previewServiceSlots(targetCompanyId, serviceId, { days: 14 });
      setPreviewByServiceId(prev => ({
        ...prev,
        [serviceId]: Array.isArray(response?.preview) ? response.preview : []
      }));
    } catch (error) {
      setPreviewByServiceId(prev => ({ ...prev, [serviceId]: [] }));
    } finally {
      setPreviewLoadingByServiceId(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  const loadCompany = async () => {
    if (!companyId) {
      return;
    }

    setLoadingData(true);
    try {
      const companyData = await find(companyId);
      const backendServices = Array.isArray(companyData?.companyServices)
        ? companyData.companyServices
        : [];
      const settings = await getAllSettings();
      const fallbackServices = parseServicesFromSetting(settings);

      setCompany(companyData);

      if (backendServices.length > 0) {
        const normalized = mapCompanyServicesToForm(backendServices);
        setServices(normalized);

        const serviceIds = normalized
          .map(service => Number(service.id))
          .filter(id => Number.isInteger(id) && id > 0);
        await Promise.all(
          serviceIds.map(serviceId => loadPreviewForService(companyData.id, serviceId))
        );

        if (
          fallbackServices.length > 0 &&
          hasSameServices(backendServices, fallbackServices)
        ) {
          await clearFallbackServicesSetting();
        }
      } else {
        if (fallbackServices.length === 0) {
          setServices([]);
        } else {
          try {
            await updateServices(companyId, fallbackServices);
            await clearFallbackServicesSetting();
            const refreshedCompany = await find(companyId);
            const migratedServices = Array.isArray(refreshedCompany?.companyServices)
              ? refreshedCompany.companyServices
              : fallbackServices;
            setCompany(refreshedCompany);
            setServices(mapCompanyServicesToForm(migratedServices));
          } catch (error) {
            setServices(mapCompanyServicesToForm(fallbackServices));
          }
        }
      }
    } catch (error) {
      toast.error("Nao foi possivel carregar os servicos da empresa.");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleAddService = () => {
    setServices(prev => [...prev, { ...defaultServiceForm }]);
  };

  const handleRemoveService = indexToRemove => {
    setServices(prev =>
      prev.filter((_, currentIndex) => currentIndex !== indexToRemove)
    );
  };

  const handleServiceChange = (index, key, value) => {
    setServices(prev =>
      prev.map((service, currentIndex) =>
        currentIndex !== index
          ? service
          : {
              ...service,
              [key]: value
            }
      )
    );
  };

  const upsertListItem = (serviceIndex, listKey, newItem) => {
    setServices(prev =>
      prev.map((service, currentIndex) => {
        if (currentIndex !== serviceIndex) {
          return service;
        }

        return {
          ...service,
          [listKey]: [...(Array.isArray(service[listKey]) ? service[listKey] : []), newItem]
        };
      })
    );
  };

  const removeListItem = (serviceIndex, listKey, itemIndex) => {
    setServices(prev =>
      prev.map((service, currentIndex) => {
        if (currentIndex !== serviceIndex) {
          return service;
        }
        return {
          ...service,
          [listKey]: (service[listKey] || []).filter((_, currentItemIndex) => currentItemIndex !== itemIndex)
        };
      })
    );
  };

  const updateListItem = (serviceIndex, listKey, itemIndex, key, value) => {
    setServices(prev =>
      prev.map((service, currentIndex) => {
        if (currentIndex !== serviceIndex) {
          return service;
        }
        return {
          ...service,
          [listKey]: (service[listKey] || []).map((item, currentItemIndex) =>
            currentItemIndex !== itemIndex
              ? item
              : {
                  ...item,
                  [key]: value
                }
          )
        };
      })
    );
  };

  const validateServicesPayload = companyServices => {
    const hasInvalidService = companyServices.some(
      service =>
        service.name.length === 0 ||
        !Number.isFinite(service.price) ||
        service.price < 0
    );

    if (hasInvalidService) {
      return "Preencha nome e valor valido para cada servico.";
    }

    const hasInvalidRecurring = companyServices.some(service =>
      (service.availabilities || []).some(availability => {
        if (!availability.startTime || !availability.endTime) {
          return true;
        }
        if (availability.startTime >= availability.endTime) {
          return true;
        }
        const capacity = availability.capacity;
        if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
          return true;
        }
        return false;
      })
    );

    if (hasInvalidRecurring) {
      return "Revise recorrencias: inicio/fim validos e capacidade positiva quando informada.";
    }

    const hasInvalidSpecificSlots = companyServices.some(service =>
      (service.specificSlots || []).some(slot => {
        if (!slot.slotDate || !slot.startTime) {
          return true;
        }
        if (slot.endTime && slot.startTime >= slot.endTime) {
          return true;
        }
        const capacity = slot.capacity;
        if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
          return true;
        }
        return false;
      })
    );

    if (hasInvalidSpecificSlots) {
      return "Revise datas especificas: data/inicio obrigatorios, fim opcional, capacidade valida.";
    }

    return null;
  };

  const handleSave = async () => {
    if (!company?.id || !canSave) {
      return;
    }

    const companyServices = normalizeServicesForPayload(services);
    const validationError = validateServicesPayload(companyServices);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      await updateServices(company.id, companyServices);
      await clearFallbackServicesSetting();
      await loadCompany();
      toast.success("Servicos atualizados com sucesso!");
    } catch (error) {
      const statusCode = error?.response?.status;
      if (statusCode === 404) {
        try {
          await updateSetting({
            key: COMPANY_SERVICES_SETTING_KEY,
            value: JSON.stringify(companyServices)
          });
          await loadCompany();
          toast.success("Servicos salvos com sucesso!");
        } catch (settingError) {
          toast.error("Nao foi possivel atualizar os servicos da empresa.");
        }
      } else {
        toast.error("Nao foi possivel atualizar os servicos da empresa.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper className={classes.root} elevation={0}>
      <Typography className={classes.title}>Cadastro de servicos</Typography>
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

        {(services || []).length > 0 ? (
          (services || []).map((service, serviceIndex) => (
            <div key={`service-card-${serviceIndex}`} className={classes.serviceCard}>
              <Grid container spacing={1} alignItems="center">
                <Grid xs={12} sm={6} md={4} item>
                  <TextField
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    label="Nome do servico"
                    className={classes.fieldControl}
                    value={service.name}
                    onChange={event =>
                      handleServiceChange(serviceIndex, "name", event.target.value)
                    }
                  />
                </Grid>
                <Grid xs={12} sm={6} md={2} item>
                  <TextField
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    label="Preco"
                    className={classes.fieldControl}
                    value={service.price}
                    onChange={event =>
                      handleServiceChange(
                        serviceIndex,
                        "price",
                        formatMoneyMaskFromInput(event.target.value)
                      )
                    }
                  />
                </Grid>
                <Grid xs={12} sm={6} md={2} item>
                  <TextField
                    fullWidth
                    margin="dense"
                    type="number"
                    variant="outlined"
                    label="Ordem"
                    className={classes.fieldControl}
                    value={service.displayOrder ?? 0}
                    onChange={event =>
                      handleServiceChange(
                        serviceIndex,
                        "displayOrder",
                        event.target.value
                      )
                    }
                  />
                </Grid>
                <Grid xs={12} sm={6} md={2} item>
                  <FormControlLabel
                    control={
                      <Switch
                        color="primary"
                        checked={service.isActive !== false}
                        onChange={event =>
                          handleServiceChange(
                            serviceIndex,
                            "isActive",
                            Boolean(event.target.checked)
                          )
                        }
                      />
                    }
                    label="Servico ativo"
                  />
                </Grid>
                <Grid xs={12} sm={6} md={1} item>
                  <FormControlLabel
                    control={
                      <Switch
                        color="primary"
                        checked={service.showPrice !== false}
                        onChange={event =>
                          handleServiceChange(
                            serviceIndex,
                            "showPrice",
                            Boolean(event.target.checked)
                          )
                        }
                      />
                    }
                    label="Preco"
                  />
                </Grid>
                <Grid xs={12} sm={6} md={1} item>
                  <IconButton
                    className={classes.removeServiceButton}
                    onClick={() => handleRemoveService(serviceIndex)}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Grid>

                <Grid xs={12} item>
                  <TextField
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    label="Descricao (opcional)"
                    className={classes.fieldControl}
                    value={service.description || ""}
                    onChange={event =>
                      handleServiceChange(
                        serviceIndex,
                        "description",
                        event.target.value
                      )
                    }
                  />
                </Grid>

                <Grid xs={12} sm={6} md={2} item>
                  <TextField
                    fullWidth
                    margin="dense"
                    type="number"
                    variant="outlined"
                    label="Duracao (min)"
                    className={classes.fieldControl}
                    value={service.durationMinutes}
                    onChange={event =>
                      handleServiceChange(
                        serviceIndex,
                        "durationMinutes",
                        event.target.value
                      )
                    }
                  />
                </Grid>
                <Grid xs={12} sm={6} md={2} item>
                  <TextField
                    fullWidth
                    margin="dense"
                    type="number"
                    variant="outlined"
                    label="Intervalo (min)"
                    className={classes.fieldControl}
                    value={service.intervalMinutes}
                    onChange={event =>
                      handleServiceChange(
                        serviceIndex,
                        "intervalMinutes",
                        event.target.value
                      )
                    }
                  />
                </Grid>
                <Grid xs={12} sm={6} md={2} item>
                  <TextField
                    fullWidth
                    margin="dense"
                    type="number"
                    variant="outlined"
                    label="Antecedencia minima (min)"
                    className={classes.fieldControl}
                    value={service.minAdvanceMinutes}
                    onChange={event =>
                      handleServiceChange(
                        serviceIndex,
                        "minAdvanceMinutes",
                        event.target.value
                      )
                    }
                  />
                </Grid>
                <Grid xs={12} sm={6} md={2} item>
                  <TextField
                    fullWidth
                    margin="dense"
                    type="number"
                    variant="outlined"
                    label="Antecedencia maxima (dias)"
                    className={classes.fieldControl}
                    value={service.maxAdvanceDays}
                    onChange={event =>
                      handleServiceChange(
                        serviceIndex,
                        "maxAdvanceDays",
                        event.target.value
                      )
                    }
                  />
                </Grid>
                <Grid xs={12} sm={6} md={2} item>
                  <TextField
                    fullWidth
                    margin="dense"
                    type="number"
                    variant="outlined"
                    label="Capacidade padrao"
                    className={classes.fieldControl}
                    value={service.maxBookingsPerSlot}
                    onChange={event =>
                      handleServiceChange(
                        serviceIndex,
                        "maxBookingsPerSlot",
                        event.target.value
                      )
                    }
                  />
                </Grid>

                <Grid xs={12} item>
                  <div className={classes.sectionCard}>
                    <div className={classes.servicesHeader}>
                      <span className={classes.sectionTitle}>Disponibilidade do servico</span>
                    </div>
                    <span className={classes.sectionHint}>
                      Configure aqui os horarios que o cliente podera reservar no WhatsApp.
                    </span>
                  </div>
                </Grid>

                <Grid xs={12} item>
                  <div className={classes.sectionCard}>
                    <div className={classes.servicesHeader}>
                      <span className={classes.sectionTitle}>Recorrencias</span>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddCircleOutlineIcon />}
                        className={classes.addSectionButton}
                        onClick={() =>
                          upsertListItem(serviceIndex, "availabilities", mapAvailabilityToForm({}))
                        }
                      >
                        Adicionar recorrencia
                      </Button>
                    </div>
                    <span className={classes.sectionHint}>
                      Recorrencias geram slots automaticamente toda semana.
                    </span>

                    {(service.availabilities || []).length > 0 ? (
                      (service.availabilities || []).map((availability, availabilityIndex) => (
                        <div
                          key={`availability-${serviceIndex}-${availabilityIndex}`}
                          className={classes.rowCard}
                        >
                          <Grid container spacing={1} alignItems="center">
                            <Grid xs={12} sm={6} md={2} item>
                              <TextField
                                select
                                fullWidth
                                margin="dense"
                                variant="outlined"
                                label="Dia da semana"
                                className={classes.fieldControl}
                                value={availability.weekday}
                                onChange={event =>
                                  updateListItem(
                                    serviceIndex,
                                    "availabilities",
                                    availabilityIndex,
                                    "weekday",
                                    event.target.value
                                  )
                                }
                              >
                                {WEEKDAY_OPTIONS.map(option => (
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
                                type="time"
                                variant="outlined"
                                label="Inicio"
                                className={classes.fieldControl}
                                InputLabelProps={{ shrink: true }}
                                value={availability.startTime || ""}
                                onChange={event =>
                                  updateListItem(
                                    serviceIndex,
                                    "availabilities",
                                    availabilityIndex,
                                    "startTime",
                                    event.target.value
                                  )
                                }
                              />
                            </Grid>
                            <Grid xs={12} sm={6} md={2} item>
                              <TextField
                                fullWidth
                                margin="dense"
                                type="time"
                                variant="outlined"
                                label="Fim"
                                className={classes.fieldControl}
                                InputLabelProps={{ shrink: true }}
                                value={availability.endTime || ""}
                                onChange={event =>
                                  updateListItem(
                                    serviceIndex,
                                    "availabilities",
                                    availabilityIndex,
                                    "endTime",
                                    event.target.value
                                  )
                                }
                              />
                            </Grid>
                            <Grid xs={12} sm={6} md={2} item>
                              <TextField
                                fullWidth
                                margin="dense"
                                type="number"
                                variant="outlined"
                                label="Capacidade (opcional)"
                                className={classes.fieldControl}
                                value={availability.capacity || ""}
                                onChange={event =>
                                  updateListItem(
                                    serviceIndex,
                                    "availabilities",
                                    availabilityIndex,
                                    "capacity",
                                    event.target.value
                                  )
                                }
                              />
                            </Grid>
                            <Grid xs={12} sm={6} md={2} item>
                              <TextField
                                fullWidth
                                margin="dense"
                                type="number"
                                variant="outlined"
                                label="Profissional ID (opcional)"
                                className={classes.fieldControl}
                                value={availability.professionalId || ""}
                                onChange={event =>
                                  updateListItem(
                                    serviceIndex,
                                    "availabilities",
                                    availabilityIndex,
                                    "professionalId",
                                    event.target.value
                                  )
                                }
                              />
                            </Grid>
                            <Grid xs={8} sm={4} md={1} item>
                              <FormControlLabel
                                control={
                                  <Switch
                                    color="primary"
                                    checked={availability.isActive !== false}
                                    onChange={event =>
                                      updateListItem(
                                        serviceIndex,
                                        "availabilities",
                                        availabilityIndex,
                                        "isActive",
                                        Boolean(event.target.checked)
                                      )
                                    }
                                  />
                                }
                                label="Ativo"
                              />
                            </Grid>
                            <Grid xs={4} sm={2} md={1} item>
                              <IconButton
                                className={classes.removeServiceButton}
                                onClick={() =>
                                  removeListItem(
                                    serviceIndex,
                                    "availabilities",
                                    availabilityIndex
                                  )
                                }
                              >
                                <DeleteOutlineIcon />
                              </IconButton>
                            </Grid>
                          </Grid>
                        </div>
                      ))
                    ) : (
                      <span className={classes.sectionHint}>
                        Sem recorrencia configurada.
                      </span>
                    )}
                  </div>
                </Grid>

                <Grid xs={12} item>
                  <div className={classes.sectionCard}>
                    <div className={classes.servicesHeader}>
                      <span className={classes.sectionTitle}>Datas especificas</span>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddCircleOutlineIcon />}
                        className={classes.addSectionButton}
                        onClick={() =>
                          upsertListItem(serviceIndex, "specificSlots", mapSpecificSlotToForm({}))
                        }
                      >
                        Adicionar data especifica
                      </Button>
                    </div>
                    <span className={classes.sectionHint}>
                      Datas especificas criam slots diretos e tem prioridade sobre recorrencias.
                    </span>

                    {(service.specificSlots || []).length > 0 ? (
                      (service.specificSlots || []).map((slot, slotIndex) => (
                        <div
                          key={`specific-slot-${serviceIndex}-${slotIndex}`}
                          className={classes.rowCard}
                        >
                          <Grid container spacing={1} alignItems="center">
                            <Grid xs={12} sm={6} md={2} item>
                              <TextField
                                fullWidth
                                margin="dense"
                                type="date"
                                variant="outlined"
                                label="Data"
                                className={classes.fieldControl}
                                InputLabelProps={{ shrink: true }}
                                value={slot.slotDate || ""}
                                onChange={event =>
                                  updateListItem(
                                    serviceIndex,
                                    "specificSlots",
                                    slotIndex,
                                    "slotDate",
                                    event.target.value
                                  )
                                }
                              />
                            </Grid>
                            <Grid xs={12} sm={6} md={2} item>
                              <TextField
                                fullWidth
                                margin="dense"
                                type="time"
                                variant="outlined"
                                label="Inicio"
                                className={classes.fieldControl}
                                InputLabelProps={{ shrink: true }}
                                value={slot.startTime || ""}
                                onChange={event =>
                                  updateListItem(
                                    serviceIndex,
                                    "specificSlots",
                                    slotIndex,
                                    "startTime",
                                    event.target.value
                                  )
                                }
                              />
                            </Grid>
                            <Grid xs={12} sm={6} md={2} item>
                              <TextField
                                fullWidth
                                margin="dense"
                                type="time"
                                variant="outlined"
                                label="Fim (opcional)"
                                className={classes.fieldControl}
                                InputLabelProps={{ shrink: true }}
                                value={slot.endTime || ""}
                                onChange={event =>
                                  updateListItem(
                                    serviceIndex,
                                    "specificSlots",
                                    slotIndex,
                                    "endTime",
                                    event.target.value
                                  )
                                }
                              />
                            </Grid>
                            <Grid xs={12} sm={6} md={2} item>
                              <TextField
                                fullWidth
                                margin="dense"
                                type="number"
                                variant="outlined"
                                label="Capacidade (opcional)"
                                className={classes.fieldControl}
                                value={slot.capacity || ""}
                                onChange={event =>
                                  updateListItem(
                                    serviceIndex,
                                    "specificSlots",
                                    slotIndex,
                                    "capacity",
                                    event.target.value
                                  )
                                }
                              />
                            </Grid>
                            <Grid xs={12} sm={6} md={2} item>
                              <TextField
                                fullWidth
                                margin="dense"
                                type="number"
                                variant="outlined"
                                label="Profissional ID (opcional)"
                                className={classes.fieldControl}
                                value={slot.professionalId || ""}
                                onChange={event =>
                                  updateListItem(
                                    serviceIndex,
                                    "specificSlots",
                                    slotIndex,
                                    "professionalId",
                                    event.target.value
                                  )
                                }
                              />
                            </Grid>
                            <Grid xs={8} sm={4} md={1} item>
                              <FormControlLabel
                                control={
                                  <Switch
                                    color="primary"
                                    checked={slot.isActive !== false}
                                    onChange={event =>
                                      updateListItem(
                                        serviceIndex,
                                        "specificSlots",
                                        slotIndex,
                                        "isActive",
                                        Boolean(event.target.checked)
                                      )
                                    }
                                  />
                                }
                                label="Ativo"
                              />
                            </Grid>
                            <Grid xs={4} sm={2} md={1} item>
                              <IconButton
                                className={classes.removeServiceButton}
                                onClick={() =>
                                  removeListItem(serviceIndex, "specificSlots", slotIndex)
                                }
                              >
                                <DeleteOutlineIcon />
                              </IconButton>
                            </Grid>
                          </Grid>
                        </div>
                      ))
                    ) : (
                      <span className={classes.sectionHint}>
                        Sem data especifica configurada.
                      </span>
                    )}
                  </div>
                </Grid>

                <Grid xs={12} item>
                  <div className={classes.sectionCard}>
                    <div className={classes.servicesHeader}>
                      <span className={classes.sectionTitle}>
                        Preview do que o cliente vera
                      </span>
                      {service?.id ? (
                        <Button
                          size="small"
                          variant="outlined"
                          className={classes.addSectionButton}
                          onClick={() => loadPreviewForService(company.id, service.id)}
                        >
                          Atualizar preview
                        </Button>
                      ) : null}
                    </div>
                    <span className={classes.sectionHint}>
                      Este preview mostra os proximos horarios realmente ofertaveis no WhatsApp.
                    </span>
                    {!service?.id ? (
                      <div className={classes.previewList}>
                        <span className={classes.sectionHint}>
                          Salve o servico para visualizar o preview real.
                        </span>
                      </div>
                    ) : previewLoadingByServiceId[service.id] ? (
                      <div className={classes.previewList}>
                        <span className={classes.sectionHint}>Gerando preview...</span>
                      </div>
                    ) : (previewByServiceId[service.id] || []).length > 0 ? (
                      <div className={classes.previewList}>
                        {(previewByServiceId[service.id] || []).slice(0, 20).map(item => (
                          <span
                            key={`${service.id}-${item.startAtIso}`}
                            className={classes.previewItem}
                          >
                            {item.dateLabel} {item.hourLabel}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className={classes.previewList}>
                        <span className={classes.sectionHint}>
                          Nenhum horario ofertavel encontrado para os proximos dias.
                        </span>
                      </div>
                    )}
                  </div>
                </Grid>
              </Grid>
            </div>
          ))
        ) : (
          <span className={classes.sectionHint}>
            {loadingData
              ? "Carregando servicos da empresa..."
              : "Nenhum servico cadastrado para esta empresa."}
          </span>
        )}
      </div>

      <div className={classes.actions}>
        <ButtonWithSpinner
          loading={saving || loadingData}
          onClick={handleSave}
          variant="contained"
          className={classes.btnPrimary}
        >
          Salvar servicos
        </ButtonWithSpinner>
      </div>
    </Paper>
  );
};

export default CompanyServicesManager;
