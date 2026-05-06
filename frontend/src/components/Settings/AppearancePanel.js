import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import AddIcon from "@material-ui/icons/Add";
import ChatIcon from "@material-ui/icons/Chat";
import DoneAllIcon from "@material-ui/icons/DoneAll";
import GroupIcon from "@material-ui/icons/Group";
import PlaylistAddCheckOutlinedIcon from "@material-ui/icons/PlaylistAddCheckOutlined";
import SearchIcon from "@material-ui/icons/Search";
import VisibilityIcon from "@material-ui/icons/Visibility";
import { MoonStar, Palette, RotateCcw, Save, SunMedium } from "lucide-react";
import { toast } from "react-toastify";

import useAppearanceSettings from "../../hooks/useAppearanceSettings";
import toastError from "../../errors/toastError";
import {
  APPEARANCE_COLOR_FIELDS,
  DEFAULT_APPEARANCE_SETTINGS,
  normalizeAppearanceSettings,
  sanitizeHexColor
} from "../../theme/appearance";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(0.5)
  },
  hero: {
    borderRadius: 16,
    padding: theme.spacing(2.5),
    background: "#ecfeff",
    border: "1px solid #a5f3fc",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)"
  },
  heroTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1.5)
  },
  heroTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  heroSubtitle: {
    marginTop: theme.spacing(0.5),
    opacity: 0.9
  },
  statRow: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  statChip: {
    fontWeight: 700,
    borderRadius: 12,
    background: "#ffffff"
  },
  controlsCard: {
    borderRadius: 16,
    padding: theme.spacing(2),
    border: "1px solid #f3f4f6",
    backgroundColor: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)"
  },
  controlsTop: {
    display: "flex",
    gap: theme.spacing(2),
    alignItems: "center",
    flexWrap: "wrap"
  },
  defaultModeControl: {
    minWidth: 220
  },
  modeSwitch: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center",
    flexWrap: "wrap",
    marginLeft: "auto",
    [theme.breakpoints.down("sm")]: {
      marginLeft: 0
    }
  },
  editModeBtn: {
    borderRadius: 999,
    textTransform: "none",
    fontWeight: 700,
    paddingInline: theme.spacing(2)
  },
  sectionCard: {
    borderRadius: 16,
    border: "1px solid #f3f4f6",
    backgroundColor: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
    padding: theme.spacing(2)
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(2)
  },
  tokenHint: {
    marginTop: -theme.spacing(1),
    marginBottom: theme.spacing(1),
    color: "#64748b",
    fontSize: "0.78rem"
  },
  tokensGrid: {
    marginTop: theme.spacing(1.5)
  },
  tokenCard: {
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: theme.spacing(1.5),
    backgroundColor: "#f8fafc"
  },
  tokenHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1)
  },
  tokenName: {
    fontWeight: 700,
    fontSize: 13
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,0.5)",
    boxShadow: "0 0 0 1px rgba(0,0,0,0.18)"
  },
  tokenInputs: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center"
  },
  colorPicker: {
    width: 36,
    height: 36,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer"
  },
  previewShell: {
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid transparent"
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing(1.5, 2)
  },
  previewBody: {
    padding: theme.spacing(2)
  },
  previewCard: {
    borderRadius: 10,
    padding: theme.spacing(2)
  },
  previewBadges: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginTop: theme.spacing(1.5)
  },
  previewButtons: {
    marginTop: theme.spacing(1.5),
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  ticketsPreviewSection: {
    marginTop: theme.spacing(2),
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #e5e7eb"
  },
  ticketsPreviewTopBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing(0.9, 1.3),
    fontSize: "0.72rem",
    fontWeight: 700
  },
  ticketsPreviewTopGreeting: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0
  },
  ticketsPreviewTopIcons: {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.6),
    marginLeft: theme.spacing(1)
  },
  ticketsPreviewTopIcon: {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.45)"
  },
  ticketsPreviewModeSwitch: {
    display: "flex",
    gap: theme.spacing(0.8),
    padding: theme.spacing(1),
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#ffffff"
  },
  ticketsPreviewModeBtn: {
    borderRadius: 999,
    padding: "5px 12px",
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "none",
    minWidth: 0,
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "all 0.2s ease"
  },
  ticketsPreviewWorkspace: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 46%) 1fr",
    minHeight: 290,
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "1fr"
    }
  },
  ticketsPreviewSidebar: {
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #e5e7eb",
    minWidth: 0
  },
  ticketsPreviewNav: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    borderBottom: "1px solid #e5e7eb"
  },
  ticketsPreviewNavItem: {
    minHeight: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.68rem",
    fontWeight: 700,
    borderBottom: "2px solid transparent",
    transition: "background-color 0.2s ease, color 0.2s ease"
  },
  ticketsPreviewNavIcon: {
    fontSize: "1.05rem !important"
  },
  ticketsPreviewToolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    padding: theme.spacing(1),
    borderBottom: "1px solid #e5e7eb",
    flexWrap: "wrap",
    minHeight: 48
  },
  ticketsPreviewIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: "0.92rem",
    border: "1px solid #e5e7eb",
    "& svg": {
      fontSize: "1.1rem"
    }
  },
  ticketsPreviewToggle: {
    width: 22,
    height: 12,
    borderRadius: 999,
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    padding: 1
  },
  ticketsPreviewToggleDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginLeft: "auto"
  },
  ticketsPreviewQueue: {
    margin: theme.spacing(1),
    marginTop: 0,
    borderRadius: 10,
    padding: theme.spacing(0.7, 1),
    fontSize: "0.78rem",
    fontWeight: 700,
    border: "1px solid #e5e7eb",
    display: "inline-flex",
    width: "fit-content"
  },
  ticketsPreviewStatusRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb"
  },
  ticketsPreviewStatusItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(0.5),
    minHeight: 46,
    fontSize: "0.82rem",
    fontWeight: 700
  },
  ticketsPreviewStatusCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    padding: "0 6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.7rem",
    fontWeight: 700
  },
  ticketsPreviewCardWrap: {
    padding: theme.spacing(1)
  },
  ticketsPreviewCard: {
    position: "relative",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: theme.spacing(1.2, 1.2, 1.2, 1.5),
    minWidth: 0
  },
  ticketsPreviewQueueStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12
  },
  ticketsPreviewCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    minWidth: 0
  },
  ticketsPreviewIdentity: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(0.8),
    minWidth: 0
  },
  ticketsPreviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10
  },
  ticketsPreviewName: {
    fontSize: "0.9rem",
    fontWeight: 700,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  ticketsPreviewNameMeta: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2
  },
  ticketsPreviewNameRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    minWidth: 0
  },
  ticketsPreviewAgeBadge: {
    borderRadius: 999,
    padding: "1px 7px",
    fontSize: "0.64rem",
    fontWeight: 700,
    lineHeight: 1.3,
    whiteSpace: "nowrap"
  },
  ticketsPreviewEye: {
    fontSize: "0.88rem !important"
  },
  ticketsPreviewTime: {
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: "0.72rem",
    fontWeight: 700,
    padding: "2px 7px",
    whiteSpace: "nowrap"
  },
  ticketsPreviewMessage: {
    marginTop: theme.spacing(0.8),
    fontSize: "0.8rem",
    lineHeight: 1.4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  ticketsPreviewTags: {
    display: "flex",
    gap: theme.spacing(0.6),
    flexWrap: "wrap",
    marginTop: theme.spacing(0.8)
  },
  ticketsPreviewTag: {
    borderRadius: 999,
    padding: "3px 9px",
    fontSize: "0.66rem",
    fontWeight: 700,
    border: "1px solid #d1d5db",
    lineHeight: 1.2
  },
  ticketsPreviewActions: {
    display: "flex",
    gap: theme.spacing(0.7),
    marginTop: theme.spacing(1),
    flexWrap: "wrap"
  },
  ticketsPreviewActionBtn: {
    borderRadius: 999,
    padding: "5px 11px",
    fontSize: "0.68rem",
    fontWeight: 700,
    lineHeight: 1.2
  },
  ticketsPreviewChatArea: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    minWidth: 0,
    fontSize: "0.8rem",
    fontWeight: 700,
    padding: theme.spacing(2),
    gap: theme.spacing(0.8),
    [theme.breakpoints.down("sm")]: {
      minHeight: 110,
      borderTop: "1px solid #e5e7eb"
    }
  },
  ticketsPreviewWatermark: {
    width: 74,
    height: 74,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.7rem",
    fontWeight: 800,
    border: "2px solid",
    opacity: 0.42
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  loadingWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
    borderRadius: 16,
    border: "1px solid #f3f4f6",
    backgroundColor: "#ffffff"
  }
}));

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#") || hex.length !== 7) {
    return null;
  }

  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
};

const toLinear = (channel) => {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 0;
  }

  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
};

const getContrastRatio = (foreground, background) => {
  const l1 = luminance(foreground);
  const l2 = luminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

const pickTextColor = (background) =>
  getContrastRatio("#FFFFFF", background) >= 4.5 ? "#FFFFFF" : "#0B111B";

const getContrastLevel = (ratio) => {
  if (ratio >= 7) {
    return { label: "AAA", color: "primary" };
  }
  if (ratio >= 4.5) {
    return { label: "AA", color: "primary" };
  }
  if (ratio >= 3) {
    return { label: "Ajustar", color: "secondary" };
  }
  return { label: "Baixo", color: "secondary" };
};

const AppearancePanel = () => {
  const classes = useStyles();
  const { getAppearance, updateAppearance } = useAppearanceSettings();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingMode, setEditingMode] = useState("light");
  const [previewTicketMode, setPreviewTicketMode] = useState("open");
  const [form, setForm] = useState(DEFAULT_APPEARANCE_SETTINGS);

  const activePalette = useMemo(
    () =>
      form.palettes?.[editingMode] ||
      DEFAULT_APPEARANCE_SETTINGS.palettes[editingMode],
    [editingMode, form]
  );

  const contrastTextBackground = useMemo(
    () => getContrastRatio(activePalette.text, activePalette.background),
    [activePalette]
  );

  const contrastButton = useMemo(
    () => getContrastRatio(activePalette.buttonText, activePalette.button),
    [activePalette]
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await getAppearance();
        if (mounted) {
          setForm(normalizeAppearanceSettings(data));
        }
      } catch (error) {
        toastError(error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setColorField = (mode, key, value) => {
    setForm((prev) => ({
      ...prev,
      palettes: {
        ...prev.palettes,
        [mode]: {
          ...prev.palettes[mode],
          [key]: value
        }
      }
    }));
  };

  const handleColorBlur = (mode, key) => {
    setForm((prev) => ({
      ...prev,
      palettes: {
        ...prev.palettes,
        [mode]: {
          ...prev.palettes[mode],
          [key]: sanitizeHexColor(
            prev.palettes?.[mode]?.[key],
            DEFAULT_APPEARANCE_SETTINGS.palettes[mode][key]
          )
        }
      }
    }));
  };

  const handleResetField = (mode, key) => {
    setColorField(mode, key, DEFAULT_APPEARANCE_SETTINGS.palettes[mode][key]);
  };

  const handleResetAll = () => {
    setForm(DEFAULT_APPEARANCE_SETTINGS);
    toast.info("Paleta redefinida para o padrao.");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = normalizeAppearanceSettings(form);
      const response = await updateAppearance(payload);
      const normalized = normalizeAppearanceSettings(response);
      setForm(normalized);

      window.dispatchEvent(
        new CustomEvent("appearance-settings-updated", {
          detail: normalized
        })
      );

      toast.success("Aparencia atualizada com sucesso.");
    } catch (error) {
      toastError(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={classes.loadingWrap}>
        <CircularProgress size={28} />
      </div>
    );
  }

  const contrastTextInfo = getContrastLevel(contrastTextBackground);
  const contrastButtonInfo = getContrastLevel(contrastButton);
  const isClosedPreview = previewTicketMode === "closed";
  const previewTabs = [
    { id: "chat", icon: <ChatIcon className={classes.ticketsPreviewNavIcon} /> },
    { id: "group", icon: <GroupIcon className={classes.ticketsPreviewNavIcon} /> },
    { id: "done", icon: <DoneAllIcon className={classes.ticketsPreviewNavIcon} /> },
    { id: "search", icon: <SearchIcon className={classes.ticketsPreviewNavIcon} /> }
  ];
  const activeMainTab = isClosedPreview ? "done" : "chat";
  const previewLeftStatusLabel = isClosedPreview ? "Finalizados" : "Atendendo";
  const previewLeftStatusCount = isClosedPreview ? "3" : "1";
  const previewRightStatusLabel = isClosedPreview ? "Hoje" : "Aguardando";
  const previewRightStatusCount = isClosedPreview ? "2" : "7";
  const previewMessageText = isClosedPreview
    ? "Ticket encerrado pelo operador, clique para reabrir."
    : "Exemplo de mensagem para testar contraste e leitura.";
  const previewPrimaryActionLabel = isClosedPreview ? "REABRIR" : "TRANSFERIR";

  return (
    <div className={classes.root}>
      <Paper className={classes.hero} elevation={0}>
        <div className={classes.heroTop}>
          <div>
            <div className={classes.heroTitle}>
              <Palette size={18} color="#0e7490" />
              <Typography variant="h6">
                Painel de Aparencia da Empresa
              </Typography>
            </div>
            <Typography variant="body2" className={classes.heroSubtitle}>
              Personalize o visual do seu tenant com padroes claro/escuro e aplique branding sem quebrar consistencia.
            </Typography>
          </div>

          <div className={classes.statRow}>
            <Chip
              className={classes.statChip}
              label={`Texto/Fundo ${contrastTextBackground.toFixed(2)}:1 (${contrastTextInfo.label})`}
              color={contrastTextInfo.color}
              variant="outlined"
            />
            <Chip
              className={classes.statChip}
              label={`Botao ${contrastButton.toFixed(2)}:1 (${contrastButtonInfo.label})`}
              color={contrastButtonInfo.color}
              variant="outlined"
            />
          </div>
        </div>
      </Paper>

      <Paper className={classes.controlsCard} elevation={0}>
        <div className={classes.controlsTop}>
          <FormControl
            variant="outlined"
            size="small"
            className={classes.defaultModeControl}
          >
            <InputLabel id="appearance-default-mode">Tema padrao</InputLabel>
            <Select
              labelId="appearance-default-mode"
              value={form.defaultMode}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, defaultMode: event.target.value }))
              }
              label="Tema padrao"
            >
              <MenuItem value="light">Claro</MenuItem>
              <MenuItem value="dark">Escuro</MenuItem>
            </Select>
          </FormControl>

          <div className={classes.modeSwitch}>
            <Button
              variant={editingMode === "light" ? "contained" : "outlined"}
              color="primary"
              className={classes.editModeBtn}
              onClick={() => setEditingMode("light")}
              startIcon={<SunMedium size={16} />}
            >
              Editar Claro
            </Button>
            <Button
              variant={editingMode === "dark" ? "contained" : "outlined"}
              color="primary"
              className={classes.editModeBtn}
              onClick={() => setEditingMode("dark")}
              startIcon={<MoonStar size={16} />}
            >
              Editar Escuro
            </Button>
          </div>
        </div>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper className={classes.sectionCard} elevation={0}>
            <div className={classes.sectionHeader}>
              <Typography variant="h6">
                Tokens de cor - tema {editingMode === "light" ? "claro" : "escuro"}
              </Typography>
              <Chip label={`${APPEARANCE_COLOR_FIELDS.length} variaveis`} size="small" />
            </div>
            <Typography className={classes.tokenHint}>
              Dica: ajuste "Verde dos Tickets (abas/contadores)" para mudar o verde desta area.
            </Typography>

            <Grid container spacing={2} className={classes.tokensGrid}>
              {APPEARANCE_COLOR_FIELDS.map((field) => {
                const color = sanitizeHexColor(
                  activePalette[field.key],
                  DEFAULT_APPEARANCE_SETTINGS.palettes[editingMode][field.key]
                );

                return (
                  <Grid item xs={12} sm={6} key={`${editingMode}-${field.key}`}>
                    <div className={classes.tokenCard}>
                      <div className={classes.tokenHeader}>
                        <Typography className={classes.tokenName}>{field.label}</Typography>
                        <span className={classes.swatch} style={{ backgroundColor: color }} />
                      </div>

                      <div className={classes.tokenInputs}>
                        <TextField
                          value={activePalette[field.key]}
                          onChange={(event) =>
                            setColorField(
                              editingMode,
                              field.key,
                              event.target.value.toUpperCase()
                            )
                          }
                          onBlur={() => handleColorBlur(editingMode, field.key)}
                          placeholder="#RRGGBB"
                          variant="outlined"
                          size="small"
                          fullWidth
                        />

                        <input
                          className={classes.colorPicker}
                          type="color"
                          value={color}
                          onChange={(event) =>
                            setColorField(
                              editingMode,
                              field.key,
                              event.target.value.toUpperCase()
                            )
                          }
                        />

                        <Tooltip title="Restaurar cor padrao">
                          <IconButton
                            size="small"
                            onClick={() => handleResetField(editingMode, field.key)}
                          >
                            <RotateCcw size={14} />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </div>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper className={classes.sectionCard} elevation={0}>
            <Typography variant="h6" gutterBottom>
              Pre-visualizacao premium
            </Typography>

            <div
              className={classes.previewShell}
              style={{
                backgroundColor: activePalette.background,
                borderColor: activePalette.border
              }}
            >
              <div
                className={classes.previewHeader}
                style={{
                  background: `linear-gradient(120deg, ${activePalette.primary}, ${activePalette.accent}, ${activePalette.secondary})`,
                  color: pickTextColor(activePalette.primary)
                }}
              >
                <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                  Header
                </Typography>
                <Button
                  size="small"
                  style={{
                    backgroundColor: activePalette.button,
                    color: activePalette.buttonText,
                    fontWeight: 700,
                    borderRadius: 10,
                    textTransform: "none"
                  }}
                >
                  Acao
                </Button>
              </div>

              <div className={classes.previewBody}>
                <div
                  className={classes.previewCard}
                  style={{
                    backgroundColor: activePalette.surface,
                    border: `1px solid ${activePalette.border}`
                  }}
                >
                  <Typography variant="subtitle1" style={{ color: activePalette.text, fontWeight: 700 }}>
                    Card / Container
                  </Typography>
                  <Typography variant="body2" style={{ color: activePalette.textSecondary }}>
                    Exemplo de tipografia, contraste e hierarquia do tema.
                  </Typography>

                  <div className={classes.previewButtons}>
                    <Button
                      variant="contained"
                      size="small"
                      style={{
                        backgroundColor: activePalette.button,
                        color: activePalette.buttonText,
                        textTransform: "none",
                        fontWeight: 700
                      }}
                    >
                      Primario
                    </Button>

                    <Button
                      variant="outlined"
                      size="small"
                      style={{
                        borderColor: activePalette.border,
                        color: activePalette.text,
                        textTransform: "none",
                        fontWeight: 700
                      }}
                    >
                      Secundario
                    </Button>
                  </div>

                  <div className={classes.previewBadges}>
                    <Chip
                      size="small"
                      label="Sucesso"
                      style={{
                        backgroundColor: activePalette.success,
                        color: pickTextColor(activePalette.success),
                        fontWeight: 700
                      }}
                    />
                    <Chip
                      size="small"
                      label="Alerta"
                      style={{
                        backgroundColor: activePalette.warning,
                        color: pickTextColor(activePalette.warning),
                        fontWeight: 700
                      }}
                    />
                    <Chip
                      size="small"
                      label="Erro"
                      style={{
                        backgroundColor: activePalette.error,
                        color: pickTextColor(activePalette.error),
                        fontWeight: 700
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className={classes.ticketsPreviewSection}
              style={{
                borderColor: activePalette.border,
                backgroundColor: activePalette.background
              }}
            >
              <div
                className={classes.ticketsPreviewTopBar}
                style={{
                  backgroundColor: activePalette.primary,
                  color: pickTextColor(activePalette.primary)
                }}
              >
                <span className={classes.ticketsPreviewTopGreeting}>
                  Ola Admin, Bem vindo a Empresa 1!
                </span>
                  <span className={classes.ticketsPreviewTopIcons}>
                    <span className={classes.ticketsPreviewTopIcon} />
                    <span className={classes.ticketsPreviewTopIcon} />
                    <span className={classes.ticketsPreviewTopIcon} />
                  </span>
              </div>

              <div
                className={classes.ticketsPreviewModeSwitch}
                style={{ borderBottomColor: activePalette.border }}
              >
                <Button
                  size="small"
                  className={classes.ticketsPreviewModeBtn}
                  style={{
                    backgroundColor: !isClosedPreview ? activePalette.hover : activePalette.surface,
                    borderColor: !isClosedPreview ? activePalette.success : activePalette.border,
                    color: !isClosedPreview ? activePalette.success : activePalette.textSecondary
                  }}
                  onClick={() => setPreviewTicketMode("open")}
                >
                  Abertos
                </Button>
                <Button
                  size="small"
                  className={classes.ticketsPreviewModeBtn}
                  style={{
                    backgroundColor: isClosedPreview ? activePalette.hover : activePalette.surface,
                    borderColor: isClosedPreview ? activePalette.success : activePalette.border,
                    color: isClosedPreview ? activePalette.success : activePalette.textSecondary
                  }}
                  onClick={() => setPreviewTicketMode("closed")}
                >
                  Finalizados
                </Button>
              </div>

              <div className={classes.ticketsPreviewWorkspace}>
                <div
                  className={classes.ticketsPreviewSidebar}
                  style={{
                    borderRightColor: activePalette.border,
                    backgroundColor: activePalette.surface
                  }}
                >
                  <div
                    className={classes.ticketsPreviewNav}
                    style={{ borderBottomColor: activePalette.border }}
                  >
                    {previewTabs.map((tabItem) => (
                      <div
                        key={tabItem.id}
                        className={classes.ticketsPreviewNavItem}
                        style={{
                          color: tabItem.id === activeMainTab ? activePalette.success : activePalette.textSecondary,
                          backgroundColor: tabItem.id === activeMainTab ? activePalette.hover : "transparent",
                          borderBottomColor: tabItem.id === activeMainTab ? activePalette.success : "transparent"
                        }}
                      >
                        {tabItem.icon}
                      </div>
                    ))}
                  </div>

                  <div
                    className={classes.ticketsPreviewToolbar}
                    style={{ borderBottomColor: activePalette.border }}
                  >
                    <span
                      className={classes.ticketsPreviewIconBtn}
                      style={{
                        borderColor: activePalette.border,
                        color: activePalette.primary
                      }}
                    >
                      <AddIcon />
                    </span>
                    <span
                      className={classes.ticketsPreviewIconBtn}
                      style={{
                        borderColor: activePalette.success,
                        backgroundColor: activePalette.hover,
                        color: activePalette.success
                      }}
                    >
                      <PlaylistAddCheckOutlinedIcon />
                    </span>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: activePalette.text
                      }}
                    >
                      Todos
                    </span>
                    <span
                      className={classes.ticketsPreviewToggle}
                      style={{ backgroundColor: activePalette.border }}
                    >
                      <span
                        className={classes.ticketsPreviewToggleDot}
                        style={{ backgroundColor: activePalette.primary }}
                      />
                    </span>
                  </div>

                  <span
                    className={classes.ticketsPreviewQueue}
                    style={{
                      borderColor: activePalette.border,
                      color: activePalette.textSecondary,
                      backgroundColor: activePalette.surface
                    }}
                  >
                    {isClosedPreview ? "Finalizadas" : "Filas"}
                  </span>

                  <div
                    className={classes.ticketsPreviewStatusRow}
                    style={{
                      borderTopColor: activePalette.border,
                      borderBottomColor: activePalette.border
                    }}
                  >
                    <div
                      className={classes.ticketsPreviewStatusItem}
                      style={{
                        color: activePalette.success,
                        borderBottom: `2px solid ${activePalette.success}`
                      }}
                    >
                      {previewLeftStatusLabel}
                      <span
                        className={classes.ticketsPreviewStatusCount}
                        style={{
                          backgroundColor: activePalette.success,
                          color: pickTextColor(activePalette.success)
                        }}
                      >
                        {previewLeftStatusCount}
                      </span>
                    </div>
                    <div
                      className={classes.ticketsPreviewStatusItem}
                      style={{ color: activePalette.textSecondary }}
                    >
                      {previewRightStatusLabel}
                      <span
                        className={classes.ticketsPreviewStatusCount}
                        style={{
                          backgroundColor: activePalette.success,
                          color: pickTextColor(activePalette.success)
                        }}
                      >
                        {previewRightStatusCount}
                      </span>
                    </div>
                  </div>

                  <div className={classes.ticketsPreviewCardWrap}>
                    <div
                      className={classes.ticketsPreviewCard}
                      style={{
                        borderColor: activePalette.border,
                        backgroundColor: activePalette.surface
                      }}
                    >
                      <span
                        className={classes.ticketsPreviewQueueStripe}
                        style={{ backgroundColor: activePalette.secondary }}
                      />
                      <div className={classes.ticketsPreviewCardTop}>
                        <div className={classes.ticketsPreviewIdentity}>
                          <span
                            className={classes.ticketsPreviewAvatar}
                            style={{
                              backgroundColor: activePalette.hover,
                              border: `1px solid ${activePalette.border}`
                            }}
                          />
                          <div className={classes.ticketsPreviewNameMeta}>
                            <div className={classes.ticketsPreviewNameRow}>
                              <span
                                className={classes.ticketsPreviewName}
                                style={{ color: activePalette.text }}
                              >
                                Rafael
                              </span>
                              <span
                                className={classes.ticketsPreviewAgeBadge}
                                style={{
                                  backgroundColor: activePalette.hover,
                                  color: isClosedPreview ? activePalette.textSecondary : activePalette.error
                                }}
                              >
                                ha 4h
                              </span>
                              <VisibilityIcon
                                className={classes.ticketsPreviewEye}
                                style={{ color: activePalette.success }}
                              />
                            </div>
                          </div>
                        </div>
                        <span
                          className={classes.ticketsPreviewTime}
                          style={{
                            color: activePalette.textSecondary,
                            backgroundColor: activePalette.background
                          }}
                        >
                          16:16
                        </span>
                      </div>

                      <div
                        className={classes.ticketsPreviewMessage}
                        style={{ color: activePalette.textSecondary }}
                      >
                        {previewMessageText}
                      </div>

                      <div className={classes.ticketsPreviewTags}>
                        <span className={classes.ticketsPreviewTag} style={{ color: activePalette.textSecondary }}>
                          EVERTON
                        </span>
                        <span className={classes.ticketsPreviewTag} style={{ color: activePalette.textSecondary }}>
                          ADMIN
                        </span>
                        <span className={classes.ticketsPreviewTag} style={{ color: activePalette.textSecondary }}>
                          SEM FILA
                        </span>
                      </div>

                      <div className={classes.ticketsPreviewActions}>
                        <span
                          className={classes.ticketsPreviewActionBtn}
                          style={{
                            backgroundColor: isClosedPreview ? activePalette.error : activePalette.button,
                            color: isClosedPreview
                              ? pickTextColor(activePalette.error)
                              : activePalette.buttonText
                          }}
                        >
                          {previewPrimaryActionLabel}
                        </span>
                        {!isClosedPreview && (
                          <span
                            className={classes.ticketsPreviewActionBtn}
                            style={{
                              backgroundColor: activePalette.error,
                              color: pickTextColor(activePalette.error)
                            }}
                          >
                            FINALIZAR
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={classes.ticketsPreviewChatArea}
                  style={{
                    backgroundColor: activePalette.background,
                    color: activePalette.textSecondary
                  }}
                >
                  <span
                    className={classes.ticketsPreviewWatermark}
                    style={{
                      color: activePalette.primary,
                      borderColor: activePalette.primary
                    }}
                  >
                    CF
                  </span>
                  <span>Area de conversa / mensagens</span>
                </div>
              </div>
            </div>
          </Paper>
        </Grid>
      </Grid>

      <div className={classes.footer}>
        <Button
          variant="outlined"
          onClick={handleResetAll}
          startIcon={<RotateCcw size={14} />}
          disabled={saving || loading}
        >
          Restaurar padrao
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={handleSave}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save size={14} />}
          disabled={saving || loading}
        >
          {saving ? "Salvando..." : "Salvar Aparencia"}
        </Button>
      </div>
    </div>
  );
};

export default AppearancePanel;
