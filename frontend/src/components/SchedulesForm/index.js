import React, { useState, useEffect } from "react";
import { makeStyles, TextField } from "@material-ui/core";
import { Formik, Form, FastField, FieldArray } from "formik";
import { isArray } from "lodash";
import NumberFormat from "react-number-format";
import ButtonWithSpinner from "../ButtonWithSpinner";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
  },
  fullWidth: {
    width: "100%",
  },
  formCard: {
    border: "1px solid #f3f4f6",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
    padding: theme.spacing(2),
  },
  sectionTitle: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#155e75",
    marginBottom: theme.spacing(1.5),
  },
  daysContainer: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(1),
  },
  dayRow: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(1),
    border: "1px solid #f3f4f6",
    borderRadius: 12,
    padding: theme.spacing(1.25),
    [theme.breakpoints.up("md")]: {
      gridTemplateColumns: "1fr 1fr 1fr",
    },
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
  fieldDisabled: {
    "& .MuiOutlinedInput-root": {
      backgroundColor: "#f8fafc",
    },
  },
  actionsRow: {
    marginTop: theme.spacing(1.5),
    borderTop: "2px solid #f3f4f6",
    paddingTop: theme.spacing(1.5),
    display: "flex",
    justifyContent: "flex-end",
  },
  buttonContainer: {
    "&.MuiButton-root": {
      borderRadius: 12,
      padding: "10px 18px",
      fontSize: "0.875rem",
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
}));

function SchedulesForm(props) {
  const { initialValues, onSubmit, loading, labelSaveButton } = props;
  const classes = useStyles();

  const [schedules, setSchedules] = useState([
    { weekday: "Segunda-feira", weekdayEn: "monday", startTime: "", endTime: "", },
    { weekday: "Terça-feira", weekdayEn: "tuesday", startTime: "", endTime: "", },
    { weekday: "Quarta-feira", weekdayEn: "wednesday", startTime: "", endTime: "", },
    { weekday: "Quinta-feira", weekdayEn: "thursday", startTime: "", endTime: "", },
    { weekday: "Sexta-feira", weekdayEn: "friday", startTime: "", endTime: "" },
    { weekday: "Sábado", weekdayEn: "saturday", startTime: "", endTime: "" },
    { weekday: "Domingo", weekdayEn: "sunday", startTime: "", endTime: "" },
  ]);

  useEffect(() => {
    if (isArray(initialValues) && initialValues.length > 0) {
      setSchedules(initialValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  const handleSubmit = (data) => {
    onSubmit(data);
  };

  return (
    <Formik
      enableReinitialize
      className={classes.fullWidth}
      initialValues={{ schedules }}
      onSubmit={({ schedules }) =>
        setTimeout(() => {
          handleSubmit(schedules);
        }, 500)
      }
    >
      {({ values }) => (
        <Form className={`${classes.fullWidth} ${classes.root}`}>
          <div className={classes.formCard}>
            <div className={classes.sectionTitle}>Horários de atendimento</div>
          <FieldArray
            name="schedules"
            render={() => (
              <div className={classes.daysContainer}>
                {values.schedules.map((item, index) => {
                  return (
                      <div key={item.weekdayEn || index} className={classes.dayRow}>
                          <FastField
                            as={TextField}
                            label="Dia da Semana"
                            name={`schedules[${index}].weekday`}
                            disabled
                            variant="outlined"
                            className={`${classes.fullWidth} ${classes.fieldControl} ${classes.fieldDisabled}`}
                            margin="dense"
                          />
                          <FastField
                            name={`schedules[${index}].startTime`}
                            >
                            {({ field }) => (
                              <NumberFormat
                                label="Hora de Inicial"
                                {...field}
                                variant="outlined"
                                margin="dense"
                                customInput={TextField}
                                format="##:##"
                                className={`${classes.fullWidth} ${classes.fieldControl}`}
                              />
                            )}
                          </FastField>
                          <FastField
                            name={`schedules[${index}].endTime`}
                            >
                            {({ field }) => (
                              <NumberFormat
                                label="Hora de Final"
                                {...field}
                                variant="outlined"
                                margin="dense"
                                customInput={TextField}
                                format="##:##"
                                className={`${classes.fullWidth} ${classes.fieldControl}`}
                              />
                            )}
                          </FastField>
                      </div>

                  );
                })}
              </div>
            )}
          ></FieldArray>
          <div className={classes.actionsRow}>
            <ButtonWithSpinner
              className={classes.buttonContainer}
              loading={loading}
              type="submit"
              color="primary"
              variant="contained"
            >
              {labelSaveButton ?? "Salvar"}
            </ButtonWithSpinner>
          </div>
          </div>
        </Form>
      )}
    </Formik>
  );
}

export default SchedulesForm;
