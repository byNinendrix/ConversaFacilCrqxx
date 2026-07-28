import React, { useEffect, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import api from "../../services/api";

import { i18n } from "../../translate/i18n";
import {
  Box,
  Button,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@material-ui/core";
import ConfirmationModal from "../../components/ConfirmationModal";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
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

const initialSettings = {
  intervals: [{ finalQuantity: 10, min: 600, max: 1200 }],
  variables: [],
};

const normalizeIntervals = (intervals) => {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return initialSettings.intervals;
  }

  return intervals
    .map((interval) => ({
      finalQuantity:
        interval.finalQuantity === null ||
        interval.finalQuantity === "" ||
        typeof interval.finalQuantity === "undefined"
          ? null
          : Number(interval.finalQuantity),
      min: Number(interval.min) || 0,
      max: Number(interval.max) || 0,
    }))
    .sort((a, b) => {
      if (a.finalQuantity === null) return 1;
      if (b.finalQuantity === null) return -1;
      return a.finalQuantity - b.finalQuantity;
    });
};

const CampaignsConfig = () => {
  const classes = useStyles();

  const [settings, setSettings] = useState(initialSettings);
  const [showVariablesForm, setShowVariablesForm] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [variable, setVariable] = useState({ key: "", value: "" });

  useEffect(() => {
    api.get("/campaign-settings").then(({ data }) => {
      const settingsList = [];
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((item) => {
          settingsList.push([item.key, JSON.parse(item.value)]);
        });
        const parsedSettings = Object.fromEntries(settingsList);
        setSettings({
          ...initialSettings,
          ...parsedSettings,
          intervals: normalizeIntervals(parsedSettings.intervals),
          variables: Array.isArray(parsedSettings.variables)
            ? parsedSettings.variables
            : [],
        });
      }
    });
  }, []);

  const handleOnChangeVariable = (e) => {
    if (e.target.value !== null) {
      const changedProp = {};
      changedProp[e.target.name] = e.target.value;
      setVariable((prev) => ({ ...prev, ...changedProp }));
    }
  };

  const getIntervalStart = (index) => {
    if (index === 0) return 1;
    return Number(settings.intervals[index - 1].finalQuantity) + 1;
  };

  const getIntervalLabel = (interval, index) => {
    const start = getIntervalStart(index);

    if (interval.finalQuantity === null || interval.finalQuantity === "") {
      return `A partir do ${start}`;
    }

    return `${start} ate ${interval.finalQuantity}`;
  };

  const handleOnChangeInterval = (index, field, value) => {
    setSettings((prev) => {
      const intervals = prev.intervals.map((interval, intervalIndex) => {
        if (intervalIndex !== index) return interval;

        return {
          ...interval,
          [field]: value === "" ? "" : Number(value),
        };
      });

      return { ...prev, intervals };
    });
  };

  const addInterval = () => {
    setSettings((prev) => {
      const intervals = [...prev.intervals];
      const limitedIntervals = intervals.filter(
        (interval) => interval.finalQuantity !== null
      );
      const previousFinalQuantity = limitedIntervals.length
        ? Number(limitedIntervals[limitedIntervals.length - 1].finalQuantity)
        : 0;

      intervals.push({
        finalQuantity: previousFinalQuantity + 10,
        min: 600,
        max: 1200,
      });

      return { ...prev, intervals: normalizeIntervals(intervals) };
    });
  };

  const addFinalInterval = () => {
    setSettings((prev) => {
      if (prev.intervals.some((interval) => interval.finalQuantity === null)) {
        return prev;
      }

      return {
        ...prev,
        intervals: [
          ...prev.intervals,
          { finalQuantity: null, min: 600, max: 1200 },
        ],
      };
    });
  };

  const removeInterval = (index) => {
    setSettings((prev) => {
      const intervals = prev.intervals.filter(
        (_, intervalIndex) => intervalIndex !== index
      );

      return {
        ...prev,
        intervals: intervals.length
          ? normalizeIntervals(intervals)
          : initialSettings.intervals,
      };
    });
  };

  const addVariable = () => {
    setSettings((prev) => {
      const variablesExists = settings.variables.filter(
        (v) => v.key === variable.key
      );
      const variables = [...prev.variables];
      if (variablesExists.length === 0) {
        variables.push(Object.assign({}, variable));
        setVariable({ key: "", value: "" });
      }
      return { ...prev, variables };
    });
  };

  const removeVariable = () => {
    const newList = settings.variables.filter((v) => v.key !== selectedKey);
    setSettings((prev) => ({ ...prev, variables: newList }));
    setSelectedKey(null);
  };

  const saveSettings = async () => {
    const intervals = normalizeIntervals(settings.intervals);
    const finalIntervals = intervals.filter(
      (interval) => interval.finalQuantity === null
    );
    const invalidInterval = intervals.find((interval, index) => {
      const start =
        index === 0 ? 1 : Number(intervals[index - 1].finalQuantity) + 1;

      return (
        finalIntervals.length > 1 ||
        Number(interval.min) < 0 ||
        Number(interval.max) < Number(interval.min) ||
        (interval.finalQuantity !== null &&
          Number(interval.finalQuantity) < start)
      );
    });

    if (invalidInterval) {
      toast.error("Confira as faixas de intervalo antes de salvar");
      return;
    }

    await api.post("/campaign-settings", {
      settings: {
        ...settings,
        intervals,
      },
    });
    toast.success("Configuracoes salvas");
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={i18n.t("campaigns.confirmationModal.deleteTitle")}
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={removeVariable}
      >
        {i18n.t("campaigns.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <MainHeader>
        <Grid style={{ width: "99.6%" }} container>
          <Grid xs={12} item>
            <Title>{i18n.t("campaignsConfig.title")}</Title>
          </Grid>
        </Grid>
      </MainHeader>
      <Paper className={classes.mainPaper} variant="outlined">
        <Box className={classes.tabPanelsContainer}>
          <Grid spacing={2} container>
            <Grid xs={12} item>
              <Typography component={"h3"}>Intervalos de disparo</Typography>
              <Typography variant="body2">
                Configure faixas em segundos. A ordem e calculada
                automaticamente pelo limite de contatos, e a ultima faixa pode
                ficar sem limite.
              </Typography>
            </Grid>
            <Grid xs={12} item>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Faixa</TableCell>
                    <TableCell>Contatos</TableCell>
                    <TableCell>Quantidade final</TableCell>
                    <TableCell>Minimo (segundos)</TableCell>
                    <TableCell>Maximo (segundos)</TableCell>
                    <TableCell align="center">Acoes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {settings.intervals.map((interval, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{getIntervalLabel(interval, index)}</TableCell>
                      <TableCell>
                        {interval.finalQuantity === null ? (
                          <Typography variant="body2">Sem limite</Typography>
                        ) : (
                          <TextField
                            type="number"
                            variant="outlined"
                            size="small"
                            value={interval.finalQuantity}
                            onChange={(e) =>
                              handleOnChangeInterval(
                                index,
                                "finalQuantity",
                                e.target.value
                              )
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          variant="outlined"
                          size="small"
                          value={interval.min}
                          onChange={(e) =>
                            handleOnChangeInterval(index, "min", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          variant="outlined"
                          size="small"
                          value={interval.max}
                          onChange={(e) =>
                            handleOnChangeInterval(index, "max", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => removeInterval(index)}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Grid>
            <Grid xs={12} className={classes.textRight} item>
              <Button
                onClick={addInterval}
                color="primary"
                style={{ marginRight: 10 }}
              >
                Adicionar Faixa
              </Button>
              <Button
                onClick={addFinalInterval}
                color="primary"
                disabled={settings.intervals.some(
                  (interval) => interval.finalQuantity === null
                )}
                style={{ marginRight: 10 }}
              >
                Adicionar Faixa Final
              </Button>
              <Button
                onClick={() => setShowVariablesForm(!showVariablesForm)}
                color="primary"
                style={{ marginRight: 10 }}
              >
                Adicionar Variavel
              </Button>
              <Button
                onClick={saveSettings}
                color="primary"
                variant="contained"
              >
                Salvar Configuracoes
              </Button>
            </Grid>
            {showVariablesForm && (
              <>
                <Grid xs={12} md={6} item>
                  <TextField
                    label="Atalho"
                    variant="outlined"
                    value={variable.key}
                    name="key"
                    onChange={handleOnChangeVariable}
                    fullWidth
                  />
                </Grid>
                <Grid xs={12} md={6} item>
                  <TextField
                    label="Conteudo"
                    variant="outlined"
                    value={variable.value}
                    name="value"
                    onChange={handleOnChangeVariable}
                    fullWidth
                  />
                </Grid>
                <Grid xs={12} className={classes.textRight} item>
                  <Button
                    onClick={() => setShowVariablesForm(!showVariablesForm)}
                    color="primary"
                    style={{ marginRight: 10 }}
                  >
                    Fechar
                  </Button>
                  <Button
                    onClick={addVariable}
                    color="primary"
                    variant="contained"
                  >
                    Adicionar
                  </Button>
                </Grid>
              </>
            )}
            {settings.variables.length > 0 && (
              <Grid xs={12} className={classes.textRight} item>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell style={{ width: "1%" }}></TableCell>
                      <TableCell>Atalho</TableCell>
                      <TableCell>Conteudo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(settings.variables) &&
                      settings.variables.map((v, k) => (
                        <TableRow key={k}>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedKey(v.key);
                                setConfirmationOpen(true);
                              }}
                            >
                              <DeleteOutlineIcon />
                            </IconButton>
                          </TableCell>
                          <TableCell>{"{" + v.key + "}"}</TableCell>
                          <TableCell>{v.value}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Grid>
            )}
          </Grid>
        </Box>
      </Paper>
    </MainContainer>
  );
};

export default CampaignsConfig;
