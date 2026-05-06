import React, { useEffect, useState } from "react";
import { Field } from "formik";
import { makeStyles } from "@material-ui/core/styles";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import Typography from "@material-ui/core/Typography";

const useStyles = makeStyles(theme => ({
    root: {
        marginTop: theme.spacing(0.75),
    },
    formControl: {
        margin: 0,
        minWidth: 120,
    },
    label: {
        fontSize: "0.75rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: "#4b5563",
        marginBottom: theme.spacing(0.75),
    },
    selectRoot: {
        borderRadius: 12,
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        fontSize: "0.875rem",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
            borderColor: "#0891b2",
        },
        "&.Mui-focused": {
            borderColor: "#0891b2",
            boxShadow: "0 0 0 3px rgba(8, 145, 178, 0.12)",
        },
    },
    selectInput: {
        padding: "10px 12px",
    },
}));

const QueueSelectSingle = () => {
    const classes = useStyles();
    const [queues, setQueues] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/queue");
                setQueues(data);
            } catch (err) {
                toastError(`QUEUESELETSINGLE >>> ${err}`);
            }
        })();
    }, []);

    return (
        <div className={classes.root}>
            <FormControl
                variant="outlined"
                className={classes.formControl}
                margin="dense"
                fullWidth
            >
                <div>
                    <Typography className={classes.label}>
                        {i18n.t("queueSelect.inputLabel")}
                    </Typography>
                    <Field
                        as={Select}
                        className={classes.selectRoot}
                        inputProps={{ className: classes.selectInput }}
                        label={i18n.t("queueSelect.inputLabel")}
                        name="queueId"
                        labelId="queue-selection-label"
                        id="queue-selection"
                        fullWidth
                    >
                        {queues.map(queue => (
                            <MenuItem key={queue.id} value={queue.id}>
                                {queue.name}
                            </MenuItem>
                        ))}
                    </Field>
                </div>
            </FormControl>
        </div>
    );
};

export default QueueSelectSingle;
