import { Box, Chip, TextField } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(() => ({
  root: {
    padding: "0px 10px 10px",
    borderBottom: "1px solid #f3f4f6",
    backgroundColor: "#ffffff",
  },
  autocomplete: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor: "#f8fafc",
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
    "& .MuiInputBase-input": {
      fontSize: "0.875rem",
    },
  },
  chip: {
    backgroundColor: "#0e7490",
    color: "#ffffff",
    fontWeight: 700,
    borderRadius: 999,
    border: "none",
    textTransform: "uppercase",
    fontSize: "0.65rem",
    letterSpacing: "0.04em",
  },
}));

export function StatusFilter({ onFiltered }) {
  const classes = useStyles();
  const [selecteds, setSelecteds] = useState([]);

  useEffect(() => {
    async function fetchData() {
      
    }
    fetchData();
  }, []);

  const onChange = async (value) => {
    setSelecteds(value);
    onFiltered(value);
  };

  const status = [
    { status: 'open', name: `${i18n.t("tickets.search.filterConectionsOptions.open")}` },
    { status: 'closed', name: `${i18n.t("tickets.search.filterConectionsOptions.closed")}` },
    { status: 'pending', name: `${i18n.t("tickets.search.filterConectionsOptions.pending")}` },
    { status: 'group', name: 'Grupos' },

  ]

  return (
    <Box className={classes.root}>
      <Autocomplete 
       className={classes.autocomplete}
       multiple      
       size="small"
       options={status}
       value={selecteds}
       onChange={(e, v, r) => onChange(v)}
       getOptionLabel={(option) => option.name}
       renderTags={(value, getTagProps) =>
         value.map((option, index) => (
           <Chip
             variant="outlined"
             className={classes.chip}
             label={option.name}
             {...getTagProps({ index })}
             size="small"
           />
         ))
       }
       renderInput={(params) => (
         <TextField
           {...params}
           variant="outlined"
           placeholder="Filtro por Status"
         />
       )}
      />
    </Box>
  );
}
