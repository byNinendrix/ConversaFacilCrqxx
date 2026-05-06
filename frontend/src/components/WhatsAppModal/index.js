import React, { useState, useEffect, useRef } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  DialogActions,
  CircularProgress,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from "@material-ui/core";
import { AttachFile, DeleteOutline } from "@material-ui/icons";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { head } from "lodash";
import QueueSelect from "../QueueSelect";
import ConfirmationModal from "../ConfirmationModal";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },

  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },

  btnWrapper: {
    position: "relative",
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },

  flowLocksNotice: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    padding: theme.spacing(1, 1.25),
    borderRadius: 8,
    border: "1px solid #f0c36d",
    backgroundColor: "#fff6e6",
    color: "#7a4a00",
    fontSize: "0.9rem",
    lineHeight: 1.35
  }
}));

const SessionSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
});

const WhatsAppModal = ({ open, onClose, whatsAppId }) => {
  const classes = useStyles();
  const initialState = {
    name: "",
    greetingMessage: "",
    complationMessage: "",
    outOfHoursMessage: "",
    ratingMessage: "",
    isDefault: false,
    token: "",
    provider: "beta",
    //timeSendQueue: 0,
    //sendIdQueue: 0,
    expiresInactiveMessage: "",
    expiresTicket: 0,
    timeUseBotQueues: 0,
    maxUseBotQueues: 3,
    flowAutomationEnabled: false,
    schedulingAutomationEnabled: false,
    schedulingOfferMessage: "",
    schedulingShowPrice: true,
    schedulingRequireConfirmation: true
  };
  const [whatsApp, setWhatsApp] = useState(initialState);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [queues, setQueues] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState(null)
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [attachment, setAttachment] = useState(null);
  const attachmentFile = useRef(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [availableFlows, setAvailableFlows] = useState([]);
  const [existingFlowBindings, setExistingFlowBindings] = useState([]);
  const [flowAutomationEnabled, setFlowAutomationEnabled] = useState(false);
  const [schedulingAutomationEnabled, setSchedulingAutomationEnabled] = useState(false);
  const [schedulingOfferMessage, setSchedulingOfferMessage] = useState("");
  const [schedulingShowPrice, setSchedulingShowPrice] = useState(true);
  const [schedulingRequireConfirmation, setSchedulingRequireConfirmation] = useState(true);
  const [schedulingFeatureEnabled, setSchedulingFeatureEnabled] = useState(true);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [selectedFlowVersionId, setSelectedFlowVersionId] = useState("");
  const [loadingFlowBindings, setLoadingFlowBindings] = useState(false);

  const parseSettingFlag = (settingsList, key, fallbackValue) => {
    const normalizedSettings = Array.isArray(settingsList) ? settingsList : [];
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

    if (["false", "disabled", "0", "no", "nao", "não"].includes(normalizedValue)) {
      return false;
    }

    return fallbackValue;
  };
  
    useEffect(() => {
    const fetchSession = async () => {
      if (!whatsAppId) return;

      try {
        const { data } = await api.get(`whatsapp/${whatsAppId}?session=0`);
        setWhatsApp(data);
        setSchedulingAutomationEnabled(Boolean(data?.schedulingAutomationEnabled));
        setSchedulingOfferMessage(String(data?.schedulingOfferMessage || ""));
        setSchedulingShowPrice(
          data?.schedulingShowPrice === undefined
            ? true
            : Boolean(data?.schedulingShowPrice)
        );
        setSchedulingRequireConfirmation(
          data?.schedulingRequireConfirmation === undefined
            ? true
            : Boolean(data?.schedulingRequireConfirmation)
        );

        const whatsQueueIds = data.queues?.map((queue) => queue.id);
        setSelectedQueueIds(whatsQueueIds);
		setSelectedQueueId(data.transferQueueId);
        setSelectedPrompt(data.promptId || null);
      } catch (err) {
        toastError(err);
      }
    };
    fetchSession();
  }, [whatsAppId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/prompt");
        setPrompts(data.prompts);
      } catch (err) {
        toastError(err);
      }
    })();
  }, [whatsAppId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/queue");
        setQueues(data);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  useEffect(() => {
    const loadSchedulingFeatureFlag = async () => {
      if (!open) return;

      try {
        const companyId = localStorage.getItem("companyId");
        if (!companyId) {
          setSchedulingFeatureEnabled(true);
          return;
        }

        const [planConfigResponse, settingsResponse] = await Promise.all([
          api.get(`/companies/listPlan/${companyId}`),
          api.get("/settings")
        ]);

        const schedulingByPlan =
          planConfigResponse?.data?.plan?.useSchedules === false ? false : true;
        const schedulingByCompany = parseSettingFlag(
          settingsResponse?.data,
          "schedulingEnabled",
          schedulingByPlan
        );

        setSchedulingFeatureEnabled(Boolean(schedulingByCompany));
      } catch (err) {
        setSchedulingFeatureEnabled(true);
      }
    };

    loadSchedulingFeatureFlag();
  }, [open]);

  useEffect(() => {
    if (schedulingFeatureEnabled) return;
    setSchedulingAutomationEnabled(false);
    setSchedulingOfferMessage("");
    setSchedulingShowPrice(true);
    setSchedulingRequireConfirmation(true);
  }, [schedulingFeatureEnabled]);

  const normalizeFlowList = (payload) => {
    const list = Array.isArray(payload) ? payload : [];

    return list.map((flow) => {
      const versionsRaw = Array.isArray(flow?.versions) ? flow.versions : [];
      const versions = versionsRaw
        .filter((version) => String(version?.state || "") === "published")
        .sort((a, b) => Number(b?.version || 0) - Number(a?.version || 0));

      return {
        id: Number(flow.id),
        name: flow.name || `Fluxo ${flow.id}`,
        activeVersionId: flow.activeVersionId ? Number(flow.activeVersionId) : null,
        versions,
        bindings: Array.isArray(flow?.bindings) ? flow.bindings : []
      };
    });
  };

  const loadFlowBindingsForConnection = async (targetWhatsAppId = null) => {
    setLoadingFlowBindings(true);
    try {
      const { data } = await api.get("/flows");
      const normalized = normalizeFlowList(data);
      setAvailableFlows(normalized);

      if (!targetWhatsAppId) {
        setExistingFlowBindings([]);
        setFlowAutomationEnabled(false);
        setSelectedFlowId("");
        setSelectedFlowVersionId("");
        return;
      }

      const flattenedBindings = normalized
        .flatMap((flow) =>
          (flow.bindings || []).map((binding) => ({
            ...binding,
            flowId: Number(flow.id)
          }))
        )
        .filter((binding) =>
          Number(binding.whatsappId) === Number(targetWhatsAppId) &&
          String(binding.channel || "whatsapp") === "whatsapp" &&
          String(binding.event || "inbound_message") === "inbound_message" &&
          (binding.queueId == null || Number(binding.queueId) === 0)
        )
        .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));

      setExistingFlowBindings(flattenedBindings);

      if (flattenedBindings.length) {
        const mainBinding = flattenedBindings[0];
        setFlowAutomationEnabled(Boolean(mainBinding.isActive));
        setSelectedFlowId(String(mainBinding.flowId || ""));
        setSelectedFlowVersionId(String(mainBinding.flowVersionId || ""));
      } else {
        setFlowAutomationEnabled(false);
        setSelectedFlowId("");
        setSelectedFlowVersionId("");
      }
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingFlowBindings(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadFlowBindingsForConnection(whatsAppId || null);
  }, [open, whatsAppId]);

  useEffect(() => {
    if (whatsApp?.flowAutomationEnabled === false) {
      setFlowAutomationEnabled(false);
    }
  }, [whatsApp?.flowAutomationEnabled]);

  const selectedFlow = availableFlows.find((flow) => String(flow.id) === String(selectedFlowId)) || null;
  const selectedFlowVersions = selectedFlow?.versions || [];

  useEffect(() => {
    if (!flowAutomationEnabled) return;
    if (!selectedFlowId) return;
    if (!selectedFlowVersions.length) {
      setSelectedFlowVersionId("");
      return;
    }

    const hasCurrent = selectedFlowVersions.some((version) => String(version.id) === String(selectedFlowVersionId));
    if (hasCurrent) return;

    const preferredVersion =
      selectedFlowVersions.find((version) => Number(version.id) === Number(selectedFlow?.activeVersionId)) ||
      selectedFlowVersions[0];
    setSelectedFlowVersionId(preferredVersion ? String(preferredVersion.id) : "");
  }, [flowAutomationEnabled, selectedFlowId, selectedFlowVersionId, selectedFlowVersions, selectedFlow]);

  useEffect(() => {
    if (!flowAutomationEnabled) return;
    setSelectedQueueIds([]);
    setSelectedPrompt(null);
  }, [flowAutomationEnabled]);

  const handleAttachmentFile = (e) => {
    const file = head(e.target.files);
    if (file) {
      setAttachment(file);
    }
  };

  const deleteMedia = async () => {
    if (attachment) {
      setAttachment(null);
      attachmentFile.current.value = null;
    }

    if (whatsApp.greetingMediaPath) {
      await api.delete(`/whatsapp/${whatsApp.id}/media-upload`);
      setWhatsApp((prev) => ({ ...prev, greetingMediaPath: null, greetingMediaName: null }));
      toast.success("Arquivo excluído");
    }
  };

  const syncFlowBinding = async (savedWhatsAppId) => {
    const targetId = Number(savedWhatsAppId);

    if (!targetId) return;

    const staleBindings = (existingFlowBindings || []).filter((binding) => Number(binding.whatsappId) === targetId);

    if (!flowAutomationEnabled) {
      await Promise.all(
        staleBindings.map((binding) =>
          api.delete(`/flows/${binding.flowId}/bindings/${binding.id}`)
        )
      );
      return;
    }

    const parsedFlowId = Number(selectedFlowId || 0);
    const parsedFlowVersionId = Number(selectedFlowVersionId || 0);

    if (!parsedFlowId || !parsedFlowVersionId) {
      throw new Error("Selecione um fluxo e uma versao publicada para ativar a automacao.");
    }

    const sameFlowBinding = staleBindings.find((binding) => Number(binding.flowId) === parsedFlowId);

    const payload = {
      flowVersionId: parsedFlowVersionId,
      channel: "whatsapp",
      event: "inbound_message",
      whatsappId: targetId,
      queueId: null,
      keywordStart: null,
      priority: 0,
      isActive: true
    };

    if (sameFlowBinding) {
      await api.put(`/flows/${parsedFlowId}/bindings/${sameFlowBinding.id}`, payload);
    } else {
      await api.post(`/flows/${parsedFlowId}/bindings`, payload);
    }

    const obsoleteBindings = staleBindings.filter((binding) => Number(binding.flowId) !== parsedFlowId);
    await Promise.all(
      obsoleteBindings.map((binding) =>
        api.delete(`/flows/${binding.flowId}/bindings/${binding.id}`)
      )
    );
  };

  const handleSaveWhatsApp = async (values) => {
    if (flowAutomationEnabled) {
      if (!selectedFlowId || !selectedFlowVersionId) {
        toast.warn("Selecione fluxo e versao publicada para habilitar a automacao.");
        return;
      }
    }

    const normalizedQueueIds = Array.isArray(selectedQueueIds)
      ? selectedQueueIds.filter((id) => id !== null && id !== undefined && `${id}` !== "").map(Number)
      : [];

    const normalizedTransferQueueId =
      selectedQueueId === null || selectedQueueId === undefined || `${selectedQueueId}` === ""
        ? null
        : Number(selectedQueueId);

    const normalizedPromptId =
      selectedPrompt === null || selectedPrompt === undefined || `${selectedPrompt}` === ""
        ? null
        : Number(selectedPrompt);

    const effectiveQueueIds = flowAutomationEnabled ? [] : normalizedQueueIds;
    const effectivePromptId = flowAutomationEnabled ? null : normalizedPromptId;

    const normalizeNumberField = (value, fallback = 0) => {
      if (value === null || value === undefined || `${value}`.trim() === "") return fallback;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const whatsappData = {
      ...values,
      queueIds: effectiveQueueIds,
      transferQueueId: normalizedTransferQueueId,
      promptId: effectivePromptId,
      flowAutomationEnabled,
      schedulingAutomationEnabled: schedulingFeatureEnabled
        ? schedulingAutomationEnabled
        : false,
      schedulingOfferMessage:
        schedulingFeatureEnabled && schedulingAutomationEnabled
          ? schedulingOfferMessage || ""
          : "",
      schedulingShowPrice:
        schedulingFeatureEnabled && schedulingAutomationEnabled
          ? schedulingShowPrice
          : true,
      schedulingRequireConfirmation:
        schedulingFeatureEnabled && schedulingAutomationEnabled
          ? schedulingRequireConfirmation
          : true,
      timeToTransfer: normalizeNumberField(values.timeToTransfer, 0),
      expiresTicket: normalizeNumberField(values.expiresTicket, 0),
      timeUseBotQueues: normalizeNumberField(values.timeUseBotQueues, 0),
      maxUseBotQueues: normalizeNumberField(values.maxUseBotQueues, 3)
    };
    delete whatsappData["queues"];
    delete whatsappData["session"];

    try {
      let savedId = whatsAppId;
      if (whatsAppId) {
        await api.put(`/whatsapp/${whatsAppId}`, whatsappData);
      } else {
        const { data } = await api.post("/whatsapp", whatsappData);
        savedId = data.id;
      }
      if (attachment != null && savedId) {
        const formData = new FormData();
        formData.append("file", attachment);
        await api.post(`/whatsapp/${savedId}/media-upload`, formData);
      }
      await syncFlowBinding(savedId);
      toast.success(i18n.t("whatsappModal.success"));
      handleClose();
    } catch (err) {
      if (err?.response) {
        toastError(err);
      } else if (err?.message) {
        toast.error(err.message);
      } else {
        toast.error("Falha ao salvar conexao.");
      }
    }
  };

  const handleChangeQueue = (e) => {
    if (flowAutomationEnabled) return;
    setSelectedQueueIds(e);
    setSelectedPrompt(null);
  };

  const handleChangePrompt = (e) => {
    if (flowAutomationEnabled) return;
    setSelectedPrompt(e.target.value);
    setSelectedQueueIds([]);
  };

  const handleToggleFlowAutomation = (event) => {
    const enabled = Boolean(event.target.checked);
    setFlowAutomationEnabled(enabled);

    if (enabled && !availableFlows.some((flow) => (flow.versions || []).length > 0)) {
      toast.warn("Nao ha fluxo com versao publicada para vincular.");
      setFlowAutomationEnabled(false);
      return;
    }

    if (enabled && !selectedFlowId && availableFlows.length) {
      const firstWithPublished = availableFlows.find((flow) => (flow.versions || []).length > 0);
      if (firstWithPublished) {
        setSelectedFlowId(String(firstWithPublished.id));
        const preferredVersion =
          (firstWithPublished.versions || []).find((version) => Number(version.id) === Number(firstWithPublished.activeVersionId)) ||
          firstWithPublished.versions[0];
        setSelectedFlowVersionId(preferredVersion ? String(preferredVersion.id) : "");
      }
    }

    if (enabled) {
      setSelectedQueueIds([]);
      setSelectedPrompt(null);
    }
  };

  const handleFlowSelection = (event) => {
    const flowId = String(event.target.value || "");
    setSelectedFlowId(flowId);
    const flow = availableFlows.find((item) => String(item.id) === flowId);
    const preferredVersion =
      (flow?.versions || []).find((version) => Number(version.id) === Number(flow?.activeVersionId)) ||
      (flow?.versions || [])[0];
    setSelectedFlowVersionId(preferredVersion ? String(preferredVersion.id) : "");
  };

  const handleFlowVersionSelection = (event) => {
    setSelectedFlowVersionId(String(event.target.value || ""));
  };

  const handleClose = () => {
    onClose();
    setWhatsApp(initialState);
	  setSelectedQueueId(null);
    setSelectedQueueIds([]);
    setAttachment(null);
    setFlowAutomationEnabled(false);
    setSchedulingAutomationEnabled(false);
    setSchedulingOfferMessage("");
    setSchedulingShowPrice(true);
    setSchedulingRequireConfirmation(true);
    setSelectedFlowId("");
    setSelectedFlowVersionId("");
    setExistingFlowBindings([]);
  };

  return (
    <div className={classes.root}>
      <ConfirmationModal
        title="Excluir anexo de saudação?"
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={deleteMedia}
      />
      <div style={{ display: "none" }}>
        <input
          type="file"
          ref={attachmentFile}
          onChange={(e) => handleAttachmentFile(e)}
        />
      </div>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle>
          {whatsAppId
            ? i18n.t("whatsappModal.title.edit")
            : i18n.t("whatsappModal.title.add")}
        </DialogTitle>
        <Formik
          initialValues={whatsApp}
          enableReinitialize={true}
          validationSchema={SessionSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveWhatsApp(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ values, touched, errors, isSubmitting }) => (
            <Form>
              <DialogContent dividers>
                <div className={classes.multFieldLine}>
                  <Grid spacing={2} container>
                    <Grid item>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.name")}
                        autoFocus
                        name="name"
                        error={touched.name && Boolean(errors.name)}
                        helperText={touched.name && errors.name}
                        variant="outlined"
                        margin="dense"
                        className={classes.textField}
                      />
                    </Grid>
                    <Grid style={{ paddingTop: 15 }} item>
                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            color="primary"
                            name="isDefault"
                            checked={values.isDefault}
                          />
                        }
                        label={i18n.t("whatsappModal.form.default")}
                      />
                    </Grid>
                  </Grid>
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.greetingMessage")}
                    type="greetingMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="greetingMessage"
                    error={
                      touched.greetingMessage && Boolean(errors.greetingMessage)
                    }
                    helperText={
                      touched.greetingMessage && errors.greetingMessage
                    }
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <Grid container spacing={1} style={{ marginTop: 5 }}>
                  {!attachment && !whatsApp.greetingMediaPath && (
                    <Grid item>
                      <Button
                        color="primary"
                        onClick={() => attachmentFile.current.click()}
                        disabled={isSubmitting}
                        variant="outlined"
                        startIcon={<AttachFile />}
                      >
                        Anexar Arquivo
                      </Button>
                    </Grid>
                  )}
                  {(whatsApp.greetingMediaPath || attachment) && (
                    <Grid item xs={12}>
                      <Button startIcon={<AttachFile />}>
                        {attachment != null
                          ? attachment.name
                          : whatsApp.greetingMediaName}
                      </Button>
                      <IconButton
                        onClick={() => setConfirmationOpen(true)}
                        color="secondary"
                      >
                        <DeleteOutline />
                      </IconButton>
                    </Grid>
                  )}
                </Grid>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.complationMessage")}
                    type="complationMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="complationMessage"
                    error={
                      touched.complationMessage &&
                      Boolean(errors.complationMessage)
                    }
                    helperText={
                      touched.complationMessage && errors.complationMessage
                    }
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.outOfHoursMessage")}
                    type="outOfHoursMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="outOfHoursMessage"
                    error={
                      touched.outOfHoursMessage &&
                      Boolean(errors.outOfHoursMessage)
                    }
                    helperText={
                      touched.outOfHoursMessage && errors.outOfHoursMessage
                    }
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.ratingMessage")}
                    type="ratingMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="ratingMessage"
                    error={
                      touched.ratingMessage && Boolean(errors.ratingMessage)
                    }
                    helperText={touched.ratingMessage && errors.ratingMessage}
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.token")}
                    type="token"
                    fullWidth
                    name="token"
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <QueueSelect
                  selectedQueueIds={selectedQueueIds}
                  onChange={(selectedIds) => handleChangeQueue(selectedIds)}
                  disabled={flowAutomationEnabled}
                />
                <FormControl
                  margin="dense"
                  variant="outlined"
                  fullWidth
                  disabled={flowAutomationEnabled}
                >
                  <InputLabel>
                    {i18n.t("whatsappModal.form.prompt")}
                  </InputLabel>
                  <Select
                    labelId="dialog-select-prompt-label"
                    id="dialog-select-prompt"
                    name="promptId"
                    value={selectedPrompt || ""}
                    onChange={handleChangePrompt}
                    label={i18n.t("whatsappModal.form.prompt")}
                    fullWidth
                    MenuProps={{
                      anchorOrigin: {
                        vertical: "bottom",
                        horizontal: "left",
                      },
                      transformOrigin: {
                        vertical: "top",
                        horizontal: "left",
                      },
                      getContentAnchorEl: null,
                    }}
                  >
                    {prompts.map((prompt) => (
                      <MenuItem
                        key={prompt.id}
                        value={prompt.id}
                      >
                        {prompt.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {flowAutomationEnabled && (
                  <div className={classes.flowLocksNotice}>
                    Fluxo ativo: os campos Filas e Prompt ficam bloqueados e sao limpos ao salvar esta conexao.
                  </div>
                )}
                <div style={{ marginTop: 14, padding: 12, border: "1px solid #d9d9d9", borderRadius: 10 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 6 }}>Fluxo automatizado (opcional)</h3>
                  <p style={{ marginTop: 0, marginBottom: 8 }}>
                    Ative para iniciar este fluxo quando a mensagem entrar nesta conexao.
                  </p>
                  <FormControlLabel
                    control={
                      <Switch
                        color="primary"
                        checked={flowAutomationEnabled}
                        onChange={handleToggleFlowAutomation}
                        disabled={loadingFlowBindings}
                      />
                    }
                    label="Ativar fluxo nesta conexao"
                  />
                  {flowAutomationEnabled ? (
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <FormControl margin="dense" variant="outlined" fullWidth>
                          <InputLabel id="connection-flow-label">Fluxo</InputLabel>
                          <Select
                            labelId="connection-flow-label"
                            value={selectedFlowId}
                            onChange={handleFlowSelection}
                            label="Fluxo"
                          >
                            {availableFlows
                              .filter((flow) => (flow.versions || []).length > 0)
                              .map((flow) => (
                                <MenuItem key={flow.id} value={String(flow.id)}>
                                  {flow.name}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControl margin="dense" variant="outlined" fullWidth disabled={!selectedFlowId}>
                          <InputLabel id="connection-flow-version-label">Versao publicada</InputLabel>
                          <Select
                            labelId="connection-flow-version-label"
                            value={selectedFlowVersionId}
                            onChange={handleFlowVersionSelection}
                            label="Versao publicada"
                          >
                            {selectedFlowVersions.map((version) => (
                              <MenuItem key={version.id} value={String(version.id)}>
                                V{version.version} - {version.state}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  ) : null}
                </div>
                <div style={{ marginTop: 14, padding: 12, border: "1px solid #d9d9d9", borderRadius: 10 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 6 }}>Agendamento de servicos (opcional)</h3>
                  <p style={{ marginTop: 0, marginBottom: 8 }}>
                    Quando ativo, o bot oferece os servicos cadastrados e conduz o cliente no fluxo de agendamento.
                  </p>
                  <FormControlLabel
                    control={
                      <Switch
                        color="primary"
                        checked={schedulingAutomationEnabled}
                        disabled={!schedulingFeatureEnabled}
                        onChange={(event) =>
                          setSchedulingAutomationEnabled(Boolean(event.target.checked))
                        }
                      />
                    }
                    label="Ativar agendamento nesta conexao"
                  />
                  {!schedulingFeatureEnabled ? (
                    <p style={{ marginTop: 0, marginBottom: 0, color: "#6b7280" }}>
                      Scheduling is not available for this company/plan.
                    </p>
                  ) : null}
                  {schedulingFeatureEnabled && schedulingAutomationEnabled ? (
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          label="Mensagem inicial de oferta"
                          fullWidth
                          multiline
                          rows={3}
                          variant="outlined"
                          margin="dense"
                          value={schedulingOfferMessage}
                          onChange={(event) =>
                            setSchedulingOfferMessage(event.target.value)
                          }
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              color="primary"
                              checked={schedulingShowPrice}
                              onChange={(event) =>
                                setSchedulingShowPrice(Boolean(event.target.checked))
                              }
                            />
                          }
                          label="Mostrar preco no menu"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              color="primary"
                              checked={schedulingRequireConfirmation}
                              onChange={(event) =>
                                setSchedulingRequireConfirmation(Boolean(event.target.checked))
                              }
                            />
                          }
                          label="Exigir confirmacao final"
                        />
                      </Grid>
                    </Grid>
                  ) : null}
                </div>
                <div>
                  <h3>{i18n.t("whatsappModal.form.queueRedirection")}</h3>
                  <p>{i18n.t("whatsappModal.form.queueRedirectionDesc")}</p>
				<Grid container spacing={2}>
                  <Grid item sm={6} >
                    <Field
                      fullWidth
                      type="number"
                      as={TextField}
                      label='Transferir após x (minutos)'
                      name="timeToTransfer"
                      error={touched.timeToTransfer && Boolean(errors.timeToTransfer)}
                      helperText={touched.timeToTransfer && errors.timeToTransfer}
                      variant="outlined"
                      margin="dense"
                      className={classes.textField}
                      InputLabelProps={{ shrink: values.timeToTransfer ? true : false }}
                    />

                  </Grid>

                  <Grid item sm={6}>
                    <QueueSelect
                      selectedQueueIds={selectedQueueId}
                      onChange={(selectedId) => {
                        setSelectedQueueId(selectedId)
                      }}
                      multiple={false}
                      title={'Fila de Transferência'}
                    />
                  </Grid>

                  </Grid>
                  <Grid spacing={2} container>
                    {/* ENCERRAR CHATS ABERTOS APÓS X HORAS */}
                    <Grid xs={12} md={12} item>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.expiresTicket")}
                        fullWidth
                        name="expiresTicket"
                        variant="outlined"
                        margin="dense"
                        error={touched.expiresTicket && Boolean(errors.expiresTicket)}
                        helperText={touched.expiresTicket && errors.expiresTicket}
                      />
                    </Grid>
                  </Grid>
                  {/* MENSAGEM POR INATIVIDADE*/}
                  <div>
                    <Field
                      as={TextField}
                      label={i18n.t("whatsappModal.form.expiresInactiveMessage")}
                      multiline
                      rows={4}
                      fullWidth
                      name="expiresInactiveMessage"
                      error={touched.expiresInactiveMessage && Boolean(errors.expiresInactiveMessage)}
                      helperText={touched.expiresInactiveMessage && errors.expiresInactiveMessage}
                      variant="outlined"
                      margin="dense"
                    />
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("whatsappModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {whatsAppId
                    ? i18n.t("whatsappModal.buttons.okEdit")
                    : i18n.t("whatsappModal.buttons.okAdd")}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default React.memo(WhatsAppModal);
