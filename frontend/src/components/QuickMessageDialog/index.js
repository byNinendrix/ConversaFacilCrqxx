import React, { useContext, useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import IconButton from "@material-ui/core/IconButton";
import { i18n } from "../../translate/i18n";
import { head } from "lodash";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import MessageVariablesPicker from "../MessageVariablesPicker";

import {
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
} from "@material-ui/core";
import ConfirmationModal from "../ConfirmationModal";

const getFilenameFromPath = (value = "") => {
    const normalizedPath = String(value).replace(/\\/g, "/");
    const pathSegments = normalizedPath.split("/");
    return pathSegments[pathSegments.length - 1] || "";
};

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        flexWrap: "wrap",
    },
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
    hiddenInput: {
        display: "none",
    },
    btnWrapper: {
        position: "relative",
        borderRadius: 12,
        minWidth: 120,
        fontWeight: 700,
        textTransform: "none",
        padding: "10px 20px",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
        transition: "background-color 0.2s ease",
        "&:hover": {
            backgroundColor: "#155e75",
        },
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
            borderColor: "#d1d5db",
        },
    },
    attachButton: {
        borderRadius: 12,
        fontWeight: 700,
        textTransform: "none",
        padding: "10px 20px",
        color: "#0e7490",
        borderColor: "#a5f3fc",
        backgroundColor: "#ecfeff",
        transition: "background-color 0.2s ease",
        "&:hover": {
            backgroundColor: "#cffafe",
            borderColor: "#67e8f9",
        },
    },
    textField: {
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
            padding: "10px 12px",
        },
    },
    buttonProgress: {
        color: "#ffffff",
        position: "absolute",
        top: "50%",
        left: "50%",
        marginTop: -12,
        marginLeft: -12,
    },
    formControl: {
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
        "& .MuiOutlinedInput-input": {
            fontSize: "0.875rem",
            padding: "10px 12px",
        },
    },
    attachmentRow: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(0.5),
        flexWrap: "wrap",
    },
    attachmentPreviewButton: {
        textTransform: "none",
        borderRadius: 10,
        backgroundColor: "#f8fafc",
        color: "#0e7490",
        fontWeight: 600,
        "&:hover": {
            backgroundColor: "#ecfeff",
        },
    },
    attachmentDeleteButton: {
        color: "#dc2626",
        "&:hover": {
            backgroundColor: "#fef2f2",
        },
    },
}));

const QuickeMessageSchema = Yup.object().shape({
    shortcode: Yup.string().required("Obrigatório"),
    //   message: Yup.string().required("Obrigatório"),
});

const QuickMessageDialog = ({ open, onClose, quickemessageId, reload }) => {
    const classes = useStyles();
    const { user } = useContext(AuthContext);
    const { profile } = user;
    const messageInputRef = useRef();

    const initialState = {
        shortcode: "",
        message: "",
        geral: false,
        status: true,
    };

    const [confirmationOpen, setConfirmationOpen] = useState(false);
    const [quickemessage, setQuickemessage] = useState(initialState);
    const [attachment, setAttachment] = useState(null);
    const attachmentFile = useRef(null);

    useEffect(() => {
        try {
            (async () => {
                if (!quickemessageId) return;

                const { data } = await api.get(`/quick-messages/${quickemessageId}`);

                setQuickemessage((prevState) => {
                    return { ...prevState, ...data };
                });
            })();
        } catch (err) {
            toastError(err);
        }
    }, [quickemessageId, open]);

    const handleClose = () => {
        setQuickemessage(initialState);
        setAttachment(null);
        onClose();
    };

    const handleAttachmentFile = (e) => {
      
        const file = head(e.target.files);
        if (file) {
            setAttachment(file);
        }
    };

    const handleSaveQuickeMessage = async (values) => {

        const quickemessageData = {
            ...values,
            isMedia: true,
            mediaPath: attachment
                ? String(attachment.name).replace(/ /g, "_")
                : values.mediaPath
                    ? getFilenameFromPath(values.mediaPath).replace(/ /g, "_")
                    : null
        };

        try {
            if (quickemessageId) {
                await api.put(`/quick-messages/${quickemessageId}`, quickemessageData);
                if (attachment != null) {
                    const formData = new FormData();
                    formData.append("typeArch", "quickMessage");
                    formData.append("file", attachment);
                    await api.post(
                        `/quick-messages/${quickemessageId}/media-upload`,
                        formData
                    );
                }
            } else {
                const { data } = await api.post("/quick-messages", quickemessageData);
                if (attachment != null) {
                    const formData = new FormData();
                    formData.append("typeArch", "quickMessage");
                    formData.append("file", attachment);
                    await api.post(`/quick-messages/${data.id}/media-upload`, formData);
                }
            }
            toast.success(i18n.t("quickMessages.toasts.success"));
            if (typeof reload == "function") {

                reload();
            }
        } catch (err) {
            toastError(err);
        }
        handleClose();
    };

    const deleteMedia = async () => {
        if (attachment) {
            setAttachment(null);
            attachmentFile.current.value = null;
        }

        if (quickemessage.mediaPath) {
            await api.delete(`/quick-messages/${quickemessage.id}/media-upload`);
            setQuickemessage((prev) => ({
                ...prev,
                mediaPath: null,
            }));
            toast.success(i18n.t("quickMessages.toasts.deleted"));
            if (typeof reload == "function") {

                reload();
            }
        }
    };

    const handleClickMsgVar = async (msgVar, setValueFunc) => {
        const el = messageInputRef.current;
        const firstHalfText = el.value.substring(0, el.selectionStart);
        const secondHalfText = el.value.substring(el.selectionEnd);
        const newCursorPos = el.selectionStart + msgVar.length;

        setValueFunc("message", `${firstHalfText}${msgVar}${secondHalfText}`);

        await new Promise(r => setTimeout(r, 100));
        messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
    };

    return (
        <div className={classes.root}>
            <ConfirmationModal
                title={i18n.t("quickMessages.confirmationModal.deleteTitle")}
                open={confirmationOpen}
                onClose={() => setConfirmationOpen(false)}
                onConfirm={deleteMedia}
            >
                {i18n.t("quickMessages.confirmationModal.deleteMessage")}
            </ConfirmationModal>
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="xs"
                fullWidth
                scroll="paper"
                PaperProps={{ className: classes.dialogPaper }}
            >
                <DialogTitle id="form-dialog-title" className={classes.dialogTitle}>
                    {quickemessageId
                        ? `${i18n.t("quickMessages.dialog.edit")}`
                        : `${i18n.t("quickMessages.dialog.add")}`}
                </DialogTitle>
                <div className={classes.hiddenInput}>
                    <input
                        type="file"
                        ref={attachmentFile}
                        onChange={(e) => handleAttachmentFile(e)}
                    />
                </div>
                <Formik
                    initialValues={quickemessage}
                    enableReinitialize={true}
                    validationSchema={QuickeMessageSchema}
                    onSubmit={(values, actions) => {
                        setTimeout(() => {
                            handleSaveQuickeMessage(values);
                            actions.setSubmitting(false);
                        }, 400);
                    }}
                >
                    {({ touched, errors, isSubmitting, setFieldValue, values }) => (
                        <Form>
                            <DialogContent dividers className={classes.dialogContent}>
                                <Grid spacing={2} container>
                                    <Grid xs={12} item>
                                        <Field
                                            as={TextField}
                                            autoFocus
                                            label={i18n.t("quickMessages.dialog.shortcode")}
                                            name="shortcode"
                                            error={touched.shortcode && Boolean(errors.shortcode)}
                                            helperText={touched.shortcode && errors.shortcode}
                                            variant="outlined"
                                            margin="dense"
                                            fullWidth
                                            className={classes.textField}
                                        />
                                    </Grid>
									{(profile === "admin") && (
									  <Grid xs={12} item>
										<FormControl variant="outlined" margin="dense" fullWidth className={classes.formControl}>
										  <InputLabel id="geral-selection-label">
											{i18n.t("quickMessages.dialog.geral")}
										  </InputLabel>
										  <Field
											as={Select}
											label={i18n.t("quickMessages.dialog.geral")}
											placeholder={i18n.t("quickMessages.dialog.geral")}
											labelId="geral-selection-label"
											id="geral"
											name="geral"
											error={touched.geral && Boolean(errors.geral)}
										  >
											<MenuItem value={true}>Ativo</MenuItem>
											<MenuItem value={false}>Inativo</MenuItem>
										  </Field>
										</FormControl>
									  </Grid>
									  )}
                                    <Grid xs={12} item>
                                        <Field
                                            as={TextField}
                                            label={i18n.t("quickMessages.dialog.message")}
                                            name="message"
                                            inputRef={messageInputRef}
                                            error={touched.message && Boolean(errors.message)}
                                            helperText={touched.message && errors.message}
                                            variant="outlined"
                                            margin="dense"
                                            multiline={true}
                                            rows={7}
                                            fullWidth
                                            className={classes.textField}
                                        // disabled={quickemessage.mediaPath || attachment ? true : false}
                                        />
                                    </Grid>
                                    <Grid item>
                                        <MessageVariablesPicker
                                            disabled={isSubmitting}
                                            onClick={value => handleClickMsgVar(value, setFieldValue)}
                                        />
                                    </Grid>
                                    {(quickemessage.mediaPath || attachment) && (
                                        <Grid xs={12} item className={classes.attachmentRow}>
                                            <Button startIcon={<AttachFileIcon />} className={classes.attachmentPreviewButton}>
                                                {attachment ? attachment.name : quickemessage.mediaName}
                                            </Button>
                                            <IconButton
                                                onClick={() => setConfirmationOpen(true)}
                                                className={classes.attachmentDeleteButton}
                                            >
                                                <DeleteOutlineIcon color="secondary" />
                                            </IconButton>
                                        </Grid>
                                    )}
                                </Grid>
                            </DialogContent>
                            <DialogActions className={classes.dialogActions}>
                                {!attachment && !quickemessage.mediaPath && (
                                    <Button
                                        onClick={() => attachmentFile.current.click()}
                                        disabled={isSubmitting}
                                        variant="outlined"
                                        className={classes.attachButton}
                                    >
                                        {i18n.t("quickMessages.buttons.attach")}
                                    </Button>
                                )}
                                <Button
                                    onClick={handleClose}
                                    disabled={isSubmitting}
                                    variant="outlined"
                                    className={classes.cancelButton}
                                >
                                    {i18n.t("quickMessages.buttons.cancel")}
                                </Button>
                                <Button
                                    type="submit"
                                    color="primary"
                                    disabled={isSubmitting}
                                    variant="contained"
                                    className={classes.btnWrapper}
                                >
                                    {quickemessageId
                                        ? `${i18n.t("quickMessages.buttons.edit")}`
                                        : `${i18n.t("quickMessages.buttons.add")}`}
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

export default QuickMessageDialog;
