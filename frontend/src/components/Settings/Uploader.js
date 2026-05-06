import React, { useContext, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { UploadCloud } from "lucide-react";
import { toast } from "react-toastify";

import {
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  makeStyles,
} from "@material-ui/core";

import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import ButtonWithSpinner from "../ButtonWithSpinner";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  sectionCard: {
    borderRadius: 16,
    border: "1px solid #f3f4f6",
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
    padding: theme.spacing(2),
  },
  sectionHeader: {
    marginBottom: theme.spacing(1.5),
  },
  sectionTitle: {
    color: "#155e75",
    fontSize: "0.875rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sectionSubtitle: {
    color: "#6b7280",
    fontSize: "0.8125rem",
    marginTop: 4,
  },
  formGrid: {
    marginTop: theme.spacing(0.5),
  },
  selectContainer: {
    width: "100%",
    textAlign: "left",
  },
  inputLabel: {
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 600,
    color: "#4b5563",
  },
  selectControl: {
    borderRadius: 12,
    background: "#ffffff",
  },
  helperText: {
    fontSize: "0.75rem",
    color: "#0891b2",
  },
  uploadBox: {
    border: "2px dashed #e5e7eb",
    borderRadius: 12,
    padding: theme.spacing(2),
    transition: "border-color 0.2s ease, background-color 0.2s ease",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    cursor: "pointer",
    background: "#ffffff",
  },
  uploadBoxWithFile: {
    borderStyle: "solid",
    borderColor: "#0891b2",
    background: "rgba(236, 254, 255, 0.35)",
  },
  hiddenInput: {
    display: "none",
  },
  uploadIconWrap: {
    width: 36,
    height: 36,
    minWidth: 36,
    borderRadius: 10,
    border: "1px solid #a5f3fc",
    background: "#ecfeff",
    color: "#0e7490",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTextWrap: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  uploadTitle: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#1f2937",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  uploadHint: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  submitButton: {
    width: "100%",
    marginTop: theme.spacing(1),
    borderRadius: 12,
    paddingTop: theme.spacing(1.1),
    paddingBottom: theme.spacing(1.1),
    textTransform: "none",
    fontSize: "0.875rem",
    fontWeight: 700,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  },
}));

const Uploader = () => {
  const [file, setFile] = useState(null);
  const [uploaded, setUploaded] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const history = useHistory();

  useEffect(() => {
    async function fetchData() {
      if (!user.super) {
        toast.error("Sem permissão para acessar!");
        setTimeout(() => {
          history.push(`/`);
        }, 500);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    const allowedTypes = ["image/png", "image/x-icon", "image/svg+xml"];

    if (selectedFile && allowedTypes.includes(selectedFile.type)) {
      setFile(selectedFile);
      setSelectedFileName(selectedFile.name);
    } else {
      setFile(null);
      setSelectedFileName(null);
      toast.error("Use somente arquivos em formato PNG, ICO ou SVG!");
    }
  };

  const handleOptionChange = (event) => {
    setSelectedOption(event.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      toast.warn("Escolha um arquivo!");
      return;
    }

    if (!selectedOption) {
      toast.warn("Escolha um destino!");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await api.post(`/settings/media-upload?ref=${selectedOption}`, formData);

      if (response.data.mensagem === "Arquivo Anexado") {
        setUploaded(true);
        toast.success("Arquivo enviado com sucesso!");
        window.location.reload();
      }
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className={classes.root}>
      <div className={classes.sectionCard}>
        <div className={classes.sectionHeader}>
          <Typography className={classes.sectionTitle}>Logotipos e Ícones</Typography>
          <Typography className={classes.sectionSubtitle}>
            Envie os arquivos visuais para login, registro, favicon e marca interna.
          </Typography>
        </div>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={2} className={classes.formGrid}>
            <Grid item xs={12}>
              <FormControl variant="outlined" className={classes.selectContainer}>
                <InputLabel id="selectOption-label" className={classes.inputLabel}>
                  Escolha uma opção
                </InputLabel>
                <Select
                  labelId="selectOption-label"
                  value={selectedOption}
                  onChange={handleOptionChange}
                  label="Escolha uma opção"
                  className={classes.selectControl}
                >
                  <MenuItem value="signup">Tela de Registro</MenuItem>
                  <MenuItem value="login">Tela de Login</MenuItem>
                  <MenuItem value="interno">Logotipo Interno</MenuItem>
                  <MenuItem value="favicon">Favicon.Ico</MenuItem>
                  <MenuItem value="favicon-256x256">Ícone 256x256</MenuItem>
                  <MenuItem value="apple-touch-icon">Apple Touch Icon</MenuItem>
                </Select>
                <FormHelperText className={classes.helperText}>
                  {uploaded ? "Upload concluído." : "Selecione onde o arquivo será aplicado."}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <label
                className={`${classes.uploadBox} ${selectedFileName ? classes.uploadBoxWithFile : ""}`}
              >
                <input
                  type="file"
                  onChange={handleFileChange}
                  className={classes.hiddenInput}
                  accept=".png,.ico,.svg,image/png,image/x-icon,image/svg+xml"
                />
                <span className={classes.uploadIconWrap}>
                  <UploadCloud size={18} />
                </span>
                <span className={classes.uploadTextWrap}>
                  <span className={classes.uploadTitle}>
                    {selectedFileName ? selectedFileName : "Escolher imagem"}
                  </span>
                  <span className={classes.uploadHint}>Formatos aceitos: PNG, ICO ou SVG</span>
                </span>
              </label>
            </Grid>

            <Grid item xs={12}>
              <ButtonWithSpinner
                type="submit"
                className={classes.submitButton}
                variant="contained"
                color="primary"
              >
                ENVIAR ARQUIVO
              </ButtonWithSpinner>
            </Grid>
          </Grid>
        </form>
      </div>
    </div>
  );
};

export default Uploader;
