import React, { useState, useEffect, useRef, useContext } from "react";
import { useHistory } from "react-router-dom";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import Select from "@material-ui/core/Select";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import { Grid, ListItemText, Typography, makeStyles } from "@material-ui/core";

import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Autocomplete, {
  createFilterOptions,
} from "@material-ui/lab/Autocomplete";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import useQueues from "../../hooks/useQueues";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 16,
    border: "1px solid #f3f4f6",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  },
  dialogTitle: {
    fontSize: "1.125rem",
    fontWeight: 700,
    color: "#111827",
    borderBottom: "1px solid #f3f4f6",
    padding: "16px 24px",
  },
  dialogContent: {
    padding: "20px 24px",
  },
  dialogActions: {
    borderTop: "2px solid #f3f4f6",
    padding: "16px 24px",
    gap: theme.spacing(1),
  },
  userAutoComplete: {
    width: "100%",
    marginBottom: 16,
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
  },
  fieldControl: {
    width: "100%",
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
    "& .MuiSelect-select": {
      fontSize: "0.875rem",
      padding: "10px 12px",
    },
  },
  optionTypography: {
    fontSize: 14,
    marginLeft: "10px",
    display: "inline-flex",
    alignItems: "center",
    lineHeight: "2",
  },
  online: {
    fontSize: 11,
    color: "#25d366",
    margin: 0,
  },
  offline: {
    fontSize: 11,
    color: "#e1306c",
    margin: 0,
  },
  cancelButton: {
    borderRadius: 12,
    fontWeight: 700,
    textTransform: "none",
    padding: "10px 20px",
    color: "#374151",
    borderColor: "#e5e7eb",
    backgroundColor: "#f3f4f6",
    "&:hover": {
      backgroundColor: "#e5e7eb",
      borderColor: "#d1d5db",
    },
  },
  submitButton: {
    borderRadius: 12,
    fontWeight: 700,
    textTransform: "none",
    padding: "10px 20px",
    backgroundColor: "#0e7490",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
    "&:hover": {
      backgroundColor: "#155e75",
    },
  },
  whatsappGrid: {
    marginTop: 8,
  },
}));

const filterOptions = createFilterOptions({
  trim: true,
});

const TransferTicketModalCustom = ({ modalOpen, onClose, ticketid }) => {
  const history = useHistory();
  const [options, setOptions] = useState([]);
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState("");
  const classes = useStyles();
  const { findAll: findAllQueues } = useQueues();
  const isMounted = useRef(true);
  const [whatsapps, setWhatsapps] = useState([]);
  const [selectedWhatsapp, setSelectedWhatsapp] = useState("");
  const { user } = useContext(AuthContext);
  const { companyId, whatsappId } = user;

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        api
          .get(`/whatsapp`, { params: { companyId, session: 0 } })
          .then(({ data }) => setWhatsapps(data));
      };

      if (whatsappId !== null && whatsappId !== undefined) {
        setSelectedWhatsapp(whatsappId)
      }

      if (user.queues.length === 1) {
        setSelectedQueue(user.queues[0].id)
      }
      fetchContacts();
      setLoading(false);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [])

  useEffect(() => {
    if (isMounted.current) {
      const loadQueues = async () => {
        const list = await findAllQueues();
        setAllQueues(list);
        setQueues(list);
      };
      loadQueues();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!modalOpen || searchParam.length < 3) {
      setLoading(false);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/", {
            params: { searchParam },
          });
          setOptions(data.users);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };

      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, modalOpen]);

  const handleClose = () => {
    onClose();
    setSearchParam("");
    setSelectedUser(null);
  };

  const handleSaveTicket = async (e) => {
    e.preventDefault();
    if (!ticketid) return;
    if (!selectedQueue || selectedQueue === "") return;
    setLoading(true);
    try {
      let data = {};

      if (selectedUser) {
        data.userId = selectedUser.id;
      }

      if (selectedQueue && selectedQueue !== null) {
        data.queueId = selectedQueue;

        if (!selectedUser) {
          data.status = "pending";
          data.userId = null;
        }
      }

      if (selectedWhatsapp) {
        data.whatsappId = selectedWhatsapp
      }
      await api.put(`/tickets/${ticketid}`, data);

      history.push(`/tickets`);
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };

  return (
    <Dialog
      open={modalOpen}
      onClose={handleClose}
      maxWidth="lg"
      scroll="paper"
      PaperProps={{ className: classes.dialogPaper }}
    >
      <form onSubmit={handleSaveTicket}>
        <DialogTitle id="form-dialog-title" className={classes.dialogTitle}>
          {i18n.t("transferTicketModal.title")}
        </DialogTitle>
        <DialogContent dividers className={classes.dialogContent}>
          <Autocomplete
            className={classes.userAutoComplete}
            getOptionLabel={(option) => `${option.name}`}
            onChange={(e, newValue) => {
              setSelectedUser(newValue);
              if (newValue != null && Array.isArray(newValue.queues)) {
                setQueues(newValue.queues);
              } else {
                setQueues(allQueues);
                setSelectedQueue("");
              }
            }}
            options={options}
            filterOptions={filterOptions}
            freeSolo
            autoHighlight
            noOptionsText={i18n.t("transferTicketModal.noOptions")}
            loading={loading}
            renderInput={(params) => (
              <TextField
                {...params}
                label={i18n.t("transferTicketModal.fieldLabel")}
                variant="outlined"
                autoFocus
                onChange={(e) => setSearchParam(e.target.value)}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <React.Fragment>
                      {loading ? (
                        <CircularProgress color="inherit" size={20} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </React.Fragment>
                  ),
                }}
              />
            )}
          />
          <FormControl variant="outlined" className={classes.fieldControl}>
            <InputLabel>
              {i18n.t("transferTicketModal.fieldQueueLabel")}
            </InputLabel>
            <Select
              value={selectedQueue}
              onChange={(e) => setSelectedQueue(e.target.value)}
              label={i18n.t("transferTicketModal.fieldQueuePlaceholder")}
            >
              {queues.map((queue) => (
                <MenuItem key={queue.id} value={queue.id}>
                  {queue.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* CONEXAO */}
          <Grid container spacing={2} className={classes.whatsappGrid}>
            <Grid xs={12} item>
              <div className={classes.fieldControl}>
              <Select
                required
                fullWidth
                displayEmpty
                variant="outlined"
                value={selectedWhatsapp}
                onChange={(e) => {
                  setSelectedWhatsapp(e.target.value)
                }}
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
                renderValue={() => {
                  if (selectedWhatsapp === "") {
                    return "Selecione uma Conexão"
                  }
                  const whatsapp = whatsapps.find(w => w.id === selectedWhatsapp)
                  return whatsapp.name
                }}
              >
                {whatsapps?.length > 0 &&
                  whatsapps.map((whatsapp, key) => (
                    <MenuItem dense key={key} value={whatsapp.id}>
                      <ListItemText
                        primary={
                          <>
                            {/* {IconChannel(whatsapp.channel)} */}
                            <Typography component="span" className={classes.optionTypography}>
                              {whatsapp.name} &nbsp; <p className={(whatsapp.status) === 'CONNECTED' ? classes.online : classes.offline} >({whatsapp.status})</p>
                            </Typography>
                          </>
                        }
                      />
                    </MenuItem>
                  ))}
              </Select>
              </div>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions className={classes.dialogActions}>
          <Button
            onClick={handleClose}
            color="secondary"
            disabled={loading}
            variant="outlined"
            className={classes.cancelButton}
          >
            {i18n.t("transferTicketModal.buttons.cancel")}
          </Button>
          <ButtonWithSpinner
            variant="contained"
            type="submit"
            color="primary"
            loading={loading}
            className={classes.submitButton}
          >
            {i18n.t("transferTicketModal.buttons.ok")}
          </ButtonWithSpinner>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TransferTicketModalCustom;
