import { Box, Chip, TextField } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import toastError from "../../errors/toastError";
import api from "../../services/api";

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
    backgroundColor: "#164e63",
    color: "#ffffff",
    fontWeight: 700,
    borderRadius: 999,
    border: "none",
    textTransform: "uppercase",
    fontSize: "0.65rem",
    letterSpacing: "0.04em",
  },
}));

export function UsersFilter({ onFiltered, initialUsers }) {
  const classes = useStyles();
  const [users, setUsers] = useState([]);
  const [selecteds, setSelecteds] = useState([]);

  useEffect(() => {
    async function fetchData() {
      await loadUsers();
    }
    fetchData();
  }, []);

  useEffect(() => {
    setSelecteds([]);
    if (
      Array.isArray(initialUsers) &&
      Array.isArray(users) &&
      users.length > 0
    ) {
      onChange(initialUsers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUsers, users]);

  const loadUsers = async () => {
    try {
      const { data } = await api.get(`/users/list`);
      const userList = data.map((u) => ({ id: u.id, name: u.name }));
      setUsers(userList);
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
        options={users}
        value={selecteds}
        onChange={(e, v, r) => onChange(v)}
        getOptionLabel={(option) => option.name}
        getOptionSelected={(option, value) => {
          return (
            option?.id === value?.id ||
            option?.name.toLowerCase() === value?.name.toLowerCase()
          );
        }}
        renderTags={(value, getUserProps) =>
          value.map((option, index) => (
            <Chip
              variant="outlined"
              className={classes.chip}
              label={option.name}
              {...getUserProps({ index })}
              size="small"
            />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            placeholder="Filtro por Users"
          />
        )}
      />
    </Box>
  );
}
