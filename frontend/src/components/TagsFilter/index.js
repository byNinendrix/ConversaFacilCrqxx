import { Box, Chip, TextField } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const useStyles = makeStyles(() => ({
  root: {
    padding: "10px 10px 8px",
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
    color: "#ffffff",
    fontWeight: 700,
    borderRadius: 999,
    border: "none",
    textTransform: "uppercase",
    fontSize: "0.65rem",
    letterSpacing: "0.04em",
  },
}));

export function TagsFilter({ onFiltered }) {
  const classes = useStyles();
  const [tags, setTags] = useState([]);
  const [selecteds, setSelecteds] = useState([]);

  useEffect(() => {
    async function fetchData() {
      await loadTags();
    }
    fetchData();
  }, []);

  const loadTags = async () => {
    try {
      const { data } = await api.get(`/tags/list`);
      setTags(data);
    } catch (err) {
      toastError(err);
    }
  };

  const onChange = async (value) => {
    setSelecteds(value);
    onFiltered(value);
  };

  return (
    <Box className={classes.root}>
      <Autocomplete
        className={classes.autocomplete}
        multiple
        size="small"
        options={tags}
        value={selecteds}
        onChange={(e, v, r) => onChange(v)}
        getOptionLabel={(option) => option.name}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              variant="outlined"
              className={classes.chip}
              style={{
                backgroundColor: option.color || "#eee",
              }}
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
            placeholder="Filtro por Tags"
          />
        )}
      />
    </Box>
  );
}
