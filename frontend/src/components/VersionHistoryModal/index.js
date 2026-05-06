import React, { useEffect, useMemo, useState } from "react";
import {
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Grid,
  MenuItem,
  TextField,
  Typography
} from "@material-ui/core";
import UpdateIcon from "@material-ui/icons/Update";

const VersionHistoryModal = ({ open, onClose, version, history }) => {
  const safeHistory = useMemo(
    () => (Array.isArray(history) ? history : []),
    [history]
  );
  const [selectedVersion, setSelectedVersion] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const versionOptions = useMemo(() => {
    const unique = new Set(safeHistory.map(item => item?.version).filter(Boolean));
    return Array.from(unique);
  }, [safeHistory]);

  const normalizedTerm = searchTerm.trim().toLowerCase();

  const filteredHistory = useMemo(() => {
    return safeHistory.filter(item => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const matchVersion =
        selectedVersion === "all" || item.version === selectedVersion;

      if (!matchVersion) {
        return false;
      }

      if (!normalizedTerm) {
        return true;
      }

      const versionText = String(item.version || "").toLowerCase();
      const dateText = String(item.date || "").toLowerCase();
      const titleText = String(item.title || "").toLowerCase();
      const changesText = Array.isArray(item.changes)
        ? item.changes.join(" ").toLowerCase()
        : "";

      return (
        versionText.includes(normalizedTerm) ||
        dateText.includes(normalizedTerm) ||
        titleText.includes(normalizedTerm) ||
        changesText.includes(normalizedTerm)
      );
    });
  }, [safeHistory, selectedVersion, normalizedTerm]);

  const handleClearFilters = () => {
    setSelectedVersion("all");
    setSearchTerm("");
  };

  useEffect(() => {
    if (!open) {
      handleClearFilters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle disableTypography>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Typography variant="h6" className="page-title">
            Histórico de Versões
          </Typography>
          <Chip
            icon={<UpdateIcon />}
            className="bg-brand-50 text-brand-700"
            variant="outlined"
            label={`Versão atual: ${version || "-"}`}
          />
        </div>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              select
              variant="outlined"
              size="small"
              label="Filtrar por versão"
              value={selectedVersion}
              onChange={event => setSelectedVersion(event.target.value)}
              fullWidth
            >
              <MenuItem value="all">Todas</MenuItem>
              {versionOptions.map(option => (
                <MenuItem key={option} value={option}>
                  v{option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField
              variant="outlined"
              size="small"
              label="Buscar por versão ou palavra-chave"
              placeholder="Ex: 5.3.7, aparência, login, dashboard..."
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              fullWidth
            />
          </Grid>
        </Grid>

        <div className="mt-4 mb-4 flex flex-wrap items-center justify-between gap-2">
          <Typography variant="caption" color="textSecondary">
            Exibindo {filteredHistory.length} de {safeHistory.length} versões
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={handleClearFilters}
            disabled={selectedVersion === "all" && !searchTerm}
          >
            Limpar filtros
          </Button>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center">
            <Typography variant="body2">
              Nenhum resultado para os filtros aplicados.
            </Typography>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map(item => (
              <div
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                key={`${item.version}-${item.date}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Chip
                    className="bg-brand-100 text-brand-700"
                    size="small"
                    label={`v${item.version}`}
                  />
                  <Typography variant="caption" color="textSecondary">
                    {item.date || "-"}
                  </Typography>
                </div>

                <Typography variant="subtitle2" className="mt-3 mb-2 font-semibold">
                  {item.title || `Release ${item.version}`}
                </Typography>

                {Array.isArray(item.changes) && item.changes.length > 0 ? (
                  item.changes.map((change, index) => (
                    <Typography
                      key={`${item.version}-change-${index}`}
                      variant="body2"
                      className="mb-1"
                    >
                      - {change}
                    </Typography>
                  ))
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    Sem detalhes para esta versão.
                  </Typography>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VersionHistoryModal;
