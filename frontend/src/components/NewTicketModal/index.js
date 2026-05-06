import React, { useState, useEffect, useContext } from "react";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";

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
import ContactModal from "../ContactModal";
import toastError from "../../errors/toastError";
import { makeStyles } from "@material-ui/core/styles";
import { AuthContext } from "../../context/Auth/AuthContext";
import {  WhatsApp } from "@material-ui/icons";
import { Grid, ListItemText, MenuItem, Select } from "@material-ui/core";
import Typography from "@material-ui/core/Typography";
import { toast } from "react-toastify";
//import ShowTicketOpen from "../ShowTicketOpenModal";

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 16,
    border: "1px solid #f3f4f6",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)"
  },
  dialogTitle: {
    fontSize: "1.125rem",
    fontWeight: 700,
    color: "#111827",
    borderBottom: "1px solid #f3f4f6",
    padding: "16px 24px"
  },
  dialogContent: {
    padding: "20px 24px"
  },
  dialogActions: {
    borderTop: "2px solid #f3f4f6",
    padding: "16px 24px",
    gap: theme.spacing(1)
  },
  contentGrid: {
    width: "100%",
    minWidth: 320
  },
  textField: {
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
      transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      "& fieldset": {
        borderColor: "#e5e7eb"
      },
      "&:hover fieldset": {
        borderColor: "#0891b2"
      },
      "&.Mui-focused fieldset": {
        borderColor: "#0891b2",
        boxShadow: "0 0 0 3px rgba(8, 145, 178, 0.12)"
      }
    },
    "& .MuiOutlinedInput-input": {
      fontSize: "0.875rem",
      padding: "10px 12px"
    }
  },
  selectControl: {
    width: "100%",
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor: "#ffffff",
      transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      "& fieldset": {
        borderColor: "#e5e7eb"
      },
      "&:hover fieldset": {
        borderColor: "#0891b2"
      },
      "&.Mui-focused fieldset": {
        borderColor: "#0891b2",
        boxShadow: "0 0 0 3px rgba(8, 145, 178, 0.12)"
      }
    },
    "& .MuiSelect-select": {
      fontSize: "0.875rem",
      padding: "10px 12px"
    }
  },
  cancelButton: {
    borderRadius: 12,
    fontWeight: 700,
    textTransform: "none",
    padding: "10px 20px",
    color: "#374151",
    borderColor: "#e5e7eb",
    backgroundColor: "#f3f4f6",
    transition: "background-color 0.2s ease",
    "&:hover": {
      backgroundColor: "#e5e7eb",
      borderColor: "#d1d5db"
    }
  },
  submitButton: {
    borderRadius: 12,
    fontWeight: 700,
    textTransform: "none",
    padding: "10px 20px",
    backgroundColor: "#0e7490",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
    "&:hover": {
      backgroundColor: "#155e75"
    }
  },
  optionTypography: {
    fontSize: 14,
    marginLeft: "10px",
    display: "inline-flex",
    alignItems: "center",
    lineHeight: "2"
  },
  online: {
    fontSize: 11,
    color: "#25d366"
  },
  offline: {
    fontSize: 11,
    color: "#e1306c"
  }
}));

const filter = createFilterOptions({
  trim: true,
});

const NewTicketModal = ({ modalOpen, onClose, initialContact }) => {
  const classes = useStyles();
  const [options, setOptions] = useState([]);

  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState("");
  const [selectedWhatsapp, setSelectedWhatsapp] = useState("");
  const [newContact, setNewContact] = useState({});
  const [whatsapps, setWhatsapps] = useState([]);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const { user } = useContext(AuthContext);
  const { companyId, whatsappId } = user;

  const [ openAlert, setOpenAlert ] = useState(false);
	const [ userTicketOpen, setUserTicketOpen] = useState("");
	const [ queueTicketOpen, setQueueTicketOpen] = useState("");

  useEffect(() => {
    if (initialContact?.id !== undefined) {
      setOptions([initialContact]);
      setSelectedContact(initialContact);
    }
  }, [initialContact]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        api
          .get(`/whatsapp`, { params: { companyId, session: 0 } })
          .then(({ data }) => setWhatsapps(data));
      };

      if (whatsappId !== null && whatsappId!== undefined) {
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
    if (!modalOpen || searchParam.length < 3) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("contacts", {
            params: { searchParam },
          });
          setOptions(data.contacts);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, modalOpen]);

  // const IconChannel = (channel) => {
  //   switch (channel) {
  //     case "facebook":
  //       return <Facebook style={{ color: "#3b5998", verticalAlign: "middle" }} />;
  //     case "instagram":
  //       return <Instagram style={{ color: "#e1306c", verticalAlign: "middle" }} />;
  //     case "whatsapp":
  //       return <WhatsApp style={{ color: "#25d366", verticalAlign: "middle" }} />
  //     default:
  //       return "error";
  //   }
  // };

  const handleClose = () => {
    onClose();
    setSearchParam("");
    setOpenAlert(false);
    setUserTicketOpen("");
    setQueueTicketOpen("");
    setSelectedContact(null);
  };

  const handleCloseAlert = () => {
    setOpenAlert(false);
    setLoading(false);
    setOpenAlert(false);
    setUserTicketOpen("");
    setQueueTicketOpen("");
  };

  const handleSaveTicket = async contactId => {
    if (!contactId) return;
    if (selectedQueue === "" && user.profile !== 'admin') {
      toast.error("Selecione uma fila");
      return;
    }
    
    setLoading(true);
    try {
      const queueId = selectedQueue !== "" ? selectedQueue : null;
      const whatsappId = selectedWhatsapp !== "" ? selectedWhatsapp : null;
      const { data: ticket } = await api.post("/tickets", {
        contactId: contactId,
        queueId,
        whatsappId,
        userId: user.id,
        status: "open",
      });      

      onClose(ticket);
    } catch (err) {
      
      const ticket  = JSON.parse(err.response.data.error);

      if (ticket.userId !== user?.id) {
        setOpenAlert(true);
        setUserTicketOpen(ticket.user.name);
        setQueueTicketOpen(ticket.queue.name);
      } else {
        setOpenAlert(false);
        setUserTicketOpen("");
        setQueueTicketOpen("");
        setLoading(false);
        onClose(ticket);
      }
    }  
    setLoading(false);
  };

  const handleSelectOption = (e, newValue) => {
    if (newValue?.number) {
      setSelectedContact(newValue);
    } else if (newValue?.name) {
      setNewContact({ name: newValue.name });
      setContactModalOpen(true);
    }
  };

  const handleCloseContactModal = () => {
    setContactModalOpen(false);    
  };

  const handleAddNewContactTicket = contact => {
    handleSaveTicket(contact.id);
  };

  const createAddContactOption = (filterOptions, params) => {
    const filtered = filter(filterOptions, params);
    if (params.inputValue !== "" && !loading && searchParam.length >= 3) {
      filtered.push({
        name: `${params.inputValue}`,
      });
    }
    return filtered;
  };

  const renderOption = option => {
    if (option.number) {
      return <>
        {/* {IconChannel(option.channel)} */}
        <Typography component="span" className={classes.optionTypography}>
          {option.name} - {option.number}
        </Typography>
      </>
    } else {
      return `${i18n.t("newTicketModal.add")} ${option.name}`;
    }
  };

  const renderOptionLabel = option => {
    if (option.number) {
      return `${option.name} - ${option.number}`;
    } else {
      return `${option.name}`;
    }
  };

  const renderContactAutocomplete = () => {
    if (initialContact === undefined || initialContact.id === undefined) {
      return (
        <Grid xs={12} item>
          <Autocomplete
            fullWidth
            options={options}
            loading={loading}
            clearOnBlur
            autoHighlight
            freeSolo
            clearOnEscape
            getOptionLabel={renderOptionLabel}
            renderOption={renderOption}
            filterOptions={createAddContactOption}
            onChange={(e, newValue) => handleSelectOption(e, newValue)}
            renderInput={params => (
              <TextField
                {...params}
                label={i18n.t("newTicketModal.fieldLabel")}
                variant="outlined"
                autoFocus
                className={classes.textField}
                onChange={e => setSearchParam(e.target.value)}
                onKeyPress={e => {
                  if (loading || !selectedContact) return;
                  else if (e.key === "Enter") {
                    handleSaveTicket(selectedContact.id);
                  }
                }}
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
        </Grid>
      )
    }
    return null;
  }

  return (
    <>
      <ContactModal
        open={contactModalOpen}
        initialValues={newContact}
        onClose={handleCloseContactModal}
        onSave={handleAddNewContactTicket}
      ></ContactModal>
      <Dialog
        open={modalOpen}
        onClose={handleClose}
        fullWidth
        maxWidth="xs"
        PaperProps={{ className: classes.dialogPaper }}
      >
        <DialogTitle id="form-dialog-title" className={classes.dialogTitle}>
          {i18n.t("newTicketModal.title")}
        </DialogTitle>
        <DialogContent dividers className={classes.dialogContent}>
          <Grid className={classes.contentGrid} container spacing={2}>
            {/* CONTATO */}
            {renderContactAutocomplete()}
            {/* FILA */}
            <Grid xs={12} item>
              <div className={classes.selectControl}>
              <Select
                required
                fullWidth
                displayEmpty
                variant="outlined"
                value={selectedQueue}
                onChange={(e) => {
                  setSelectedQueue(e.target.value)
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
                  if (selectedQueue === "") {
                    return "Selecione uma fila"
                  }
                  const queue = user.queues.find(q => q.id === selectedQueue)
                  return queue.name
                }}
              >
                {user.queues?.length > 0 &&
                  user.queues.map((queue, key) => (
                    <MenuItem dense key={key} value={queue.id}>
                      <ListItemText primary={queue.name} />
                    </MenuItem>
                  ))
                }
              </Select>
              </div>
            </Grid>
            {/* CONEXAO */}
            <Grid xs={12} item>
              <div className={classes.selectControl}>
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
            {i18n.t("newTicketModal.buttons.cancel")}
          </Button>
          <ButtonWithSpinner
            variant="contained"
            type="button"
            disabled={!selectedContact}
            onClick={() => handleSaveTicket(selectedContact.id)}
            color="primary"
            loading={loading}
            className={classes.submitButton}
          >
            {i18n.t("newTicketModal.buttons.ok")}
          </ButtonWithSpinner>
        </DialogActions>
        {/* <ShowTicketOpen
          isOpen={openAlert}
          handleClose={handleCloseAlert}
          user={userTicketOpen}
          queue={queueTicketOpen}
			  /> */}
      </Dialog >
    </>
  );
};
export default NewTicketModal;
