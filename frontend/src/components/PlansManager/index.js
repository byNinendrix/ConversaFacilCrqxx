import React, { useState, useEffect } from "react";
import {
    makeStyles,
    Paper,
    Grid,
    TextField,
    Table,
    TableHead,
    TableBody,
    TableCell,
    TableRow,
    IconButton,
    FormControl,
    InputLabel,
    MenuItem,
    Select
} from "@material-ui/core";
import { Formik, Form, Field } from 'formik';
import ButtonWithSpinner from "../ButtonWithSpinner";
import ConfirmationModal from "../ConfirmationModal";

import { Edit as EditIcon } from "@material-ui/icons";

import { toast } from "react-toastify";
import usePlans from "../../hooks/usePlans";
import { i18n } from "../../translate/i18n";


const useStyles = makeStyles(theme => ({
    root: {
        width: "100%"
    },
    mainPaper: {
        width: "100%",
        flex: 1,
        borderRadius: 16,
        border: "1px solid #f3f4f6",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
        padding: theme.spacing(2.5),
        backgroundColor: "#ffffff"
    },
    fullWidth: {
        width: "100%"
    },
    sectionTitle: {
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#155e75",
        marginBottom: theme.spacing(1.5)
    },
    formCard: {
        border: "1px solid #f3f4f6",
        borderRadius: 12,
        padding: theme.spacing(1.5),
        backgroundColor: "#ffffff"
    },
    fieldControl: {
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
            padding: "12px 14px"
        }
    },
    tableContainer: {
        width: "100%",
        overflowX: "auto",
        border: "1px solid #f3f4f6",
        borderRadius: 12,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
        ...theme.scrollbarStyles
    },
    tableRoot: {
        minWidth: 980
    },
    tableHead: {
        backgroundColor: "#f8fafc"
    },
    tableHeadCell: {
        fontSize: "0.75rem",
        fontWeight: 700,
        color: "#374151",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        borderBottom: "1px solid #e5e7eb",
        padding: "10px 12px",
        whiteSpace: "nowrap"
    },
    tableBodyCell: {
        fontSize: "0.875rem",
        color: "#111827",
        borderBottom: "1px solid #f3f4f6",
        padding: "10px 12px",
        whiteSpace: "nowrap"
    },
    editButton: {
        color: "#0e7490",
        "&:hover": {
            backgroundColor: "#ecfeff"
        }
    },
    actionsRow: {
        marginTop: theme.spacing(1.5),
        borderTop: "2px solid #f3f4f6",
        paddingTop: theme.spacing(1.5)
    },
    btnSecondary: {
        "&.MuiButton-root": {
            borderRadius: 12,
            fontWeight: 700,
            textTransform: "none",
            backgroundColor: "#f3f4f6",
            color: "#374151",
            transition: "background-color 0.2s ease",
            "&:hover": {
                backgroundColor: "#e5e7eb"
            }
        }
    },
    btnDanger: {
        "&.MuiButton-root": {
            borderRadius: 12,
            fontWeight: 700,
            textTransform: "none",
            backgroundColor: "#dc2626",
            color: "#ffffff",
            transition: "background-color 0.2s ease",
            "&:hover": {
                backgroundColor: "#b91c1c"
            }
        }
    },
    btnPrimary: {
        "&.MuiButton-root": {
            borderRadius: 12,
            fontWeight: 700,
            textTransform: "none",
            backgroundColor: "#0e7490",
            color: "#ffffff",
            transition: "background-color 0.2s ease",
            "&:hover": {
                backgroundColor: "#155e75"
            }
        }
    }
}));

export function PlanManagerForm(props) {
    const { onSubmit, onDelete, onCancel, initialValue, loading } = props;
    const classes = useStyles()

    const [record, setRecord] = useState({
        name: '',
        users: 0,
        connections: 0,
        queues: 0,
        value: 0,
        useCampaigns: true,
        useSchedules: true,
        useInternalChat: true,
        useExternalApi: true,
        useKanban: true,
        useOpenAi: true,
        useIntegrations: true,
        useInternal: true
    });

    useEffect(() => {
        setRecord(initialValue)
    }, [initialValue])

    const handleSubmit = async (data) => {
        onSubmit(data)
    }

    return (
        <Formik
            enableReinitialize
            className={classes.fullWidth}
            initialValues={record}
            onSubmit={(values, { resetForm }) =>
                setTimeout(() => {
                    handleSubmit(values)
                    resetForm()
                }, 500)
            }
        >
            {() => (
                <Form className={classes.fullWidth}>
                    <div className={classes.formCard}>
                        <div className={classes.sectionTitle}>Cadastro de plano</div>
                        <Grid spacing={1} justifyContent="flex-start" container>
                        {/* NOME */}
                        <Grid xs={12} sm={6} md={2} item>
                            <Field
                                as={TextField}
                                label={i18n.t("plans.form.name")}
                                name="name"
                                variant="outlined"
                                className={`${classes.fullWidth} ${classes.fieldControl}`}
                                margin="dense"
                            />
                        </Grid>

                        {/* USUARIOS */}
                        <Grid xs={12} sm={6} md={1} item>
                            <Field
                                as={TextField}
                                label={i18n.t("plans.form.users")}
                                name="users"
                                variant="outlined"
                                className={`${classes.fullWidth} ${classes.fieldControl}`}
                                margin="dense"
                                type="number"
                            />
                        </Grid>

                        {/* CONEXOES */}
                        <Grid xs={12} sm={6} md={1} item>
                            <Field
                                as={TextField}
                                label={i18n.t("plans.form.connections")}
                                name="connections"
                                variant="outlined"
                                className={`${classes.fullWidth} ${classes.fieldControl}`}
                                margin="dense"
                                type="number"
                            />
                        </Grid>

                        {/* FILAS */}
                        <Grid xs={12} sm={6} md={1} item>
                            <Field
                                as={TextField}
                                label="Filas"
                                name="queues"
                                variant="outlined"
                                className={`${classes.fullWidth} ${classes.fieldControl}`}
                                margin="dense"
                                type="number"
                            />
                        </Grid>

                        {/* VALOR */}
                        <Grid xs={12} sm={6} md={1} item>
                            <Field
                                as={TextField}
                                label="Valor"
                                name="value"
                                variant="outlined"
                                className={`${classes.fullWidth} ${classes.fieldControl}`}
                                margin="dense"
                                type="text"
                            />
                        </Grid>

                        {/* CAMPANHAS */}
                        <Grid xs={12} sm={6} md={2} item>
                            <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                                <InputLabel htmlFor="useCampaigns-selection">{i18n.t("plans.form.campaigns")}</InputLabel>
                                <Field
                                    as={Select}
                                    id="useCampaigns-selection"
                                    label={i18n.t("plans.form.campaigns")}
                                    labelId="useCampaigns-selection-label"
                                    name="useCampaigns"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        {/* AGENDAMENTOS */}
                        <Grid xs={12} sm={8} md={2} item>
                            <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                                <InputLabel htmlFor="useSchedules-selection">{i18n.t("plans.form.schedules")}</InputLabel>
                                <Field
                                    as={Select}
                                    id="useSchedules-selection"
                                    label={i18n.t("plans.form.schedules")}
                                    labelId="useSchedules-selection-label"
                                    name="useSchedules"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        {/* CHAT INTERNO */}
                        <Grid xs={12} sm={8} md={2} item>
                            <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                                <InputLabel htmlFor="useInternalChat-selection">Chat Interno</InputLabel>
                                <Field
                                    as={Select}
                                    id="useInternalChat-selection"
                                    label="Chat Interno"
                                    labelId="useInternalChat-selection-label"
                                    name="useInternalChat"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        {/* API Externa */}
                        <Grid xs={12} sm={8} md={4} item>
                            <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                                <InputLabel htmlFor="useExternalApi-selection">API Externa</InputLabel>
                                <Field
                                    as={Select}
                                    id="useExternalApi-selection"
                                    label="API Externa"
                                    labelId="useExternalApi-selection-label"
                                    name="useExternalApi"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        {/* KANBAN */}
                        <Grid xs={12} sm={8} md={2} item>
                            <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                                <InputLabel htmlFor="useKanban-selection">Kanban</InputLabel>
                                <Field
                                    as={Select}
                                    id="useKanban-selection"
                                    label="Kanban"
                                    labelId="useKanban-selection-label"
                                    name="useKanban"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        {/* OPENAI */}
                        <Grid xs={12} sm={8} md={2} item>
                            <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                                <InputLabel htmlFor="useOpenAi-selection">Open.Ai</InputLabel>
                                <Field
                                    as={Select}
                                    id="useOpenAi-selection"
                                    label="Talk.Ai"
                                    labelId="useOpenAi-selection-label"
                                    name="useOpenAi"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        {/* INTEGRACOES */}
                        <Grid xs={12} sm={8} md={2} item>
                            <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                                <InputLabel htmlFor="useIntegrations-selection">Integrações</InputLabel>
                                <Field
                                    as={Select}
                                    id="useIntegrations-selection"
                                    label="Integrações"
                                    labelId="useIntegrations-selection-label"
                                    name="useIntegrations"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        <Grid xs={12} sm={6} md={2} item>
                            <FormControl margin="dense" variant="outlined" fullWidth className={classes.fieldControl}>
                                <InputLabel htmlFor="useInternal-selection">Uso Interno</InputLabel>
                                <Field
                                    as={Select}
                                    id="useInternal-selection"
                                    label="Uso Interno"
                                    labelId="useInternal-selection-label"
                                    name="useInternal"
                                    margin="dense"
                                >
                                    <MenuItem value={false}>Sim</MenuItem>
                                    <MenuItem value={true}>Não</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                    </Grid>
                    <Grid spacing={2} justifyContent="flex-end" container className={classes.actionsRow}>

                        <Grid sm={3} md={2} item>
                            <ButtonWithSpinner className={`${classes.fullWidth} ${classes.btnSecondary}`} loading={loading} onClick={() => onCancel()} variant="contained">
                                {i18n.t("plans.form.clear")}
                            </ButtonWithSpinner>
                        </Grid>
                        {record.id !== undefined ? (
                            <Grid sm={3} md={2} item>
                                <ButtonWithSpinner className={`${classes.fullWidth} ${classes.btnDanger}`} loading={loading} onClick={() => onDelete(record)} variant="contained" color="secondary">
                                    {i18n.t("plans.form.delete")}
                                </ButtonWithSpinner>
                            </Grid>
                        ) : null}
                        <Grid sm={3} md={2} item>
                            <ButtonWithSpinner className={`${classes.fullWidth} ${classes.btnPrimary}`} loading={loading} type="submit" variant="contained" color="primary">
                                {i18n.t("plans.form.save")}
                            </ButtonWithSpinner>
                        </Grid>
                    </Grid>
                    </div>
                </Form>
            )}
        </Formik>
    )
}

export function PlansManagerGrid(props) {
    const { records, onSelect } = props
    const classes = useStyles()
    
    const renderCampaigns = (row) => {
        return row.useCampaigns === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderSchedules = (row) => {
        return row.useSchedules === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderInternalChat = (row) => {
        return row.useInternalChat === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderExternalApi = (row) => {
        return row.useExternalApi === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderKanban = (row) => {
        return row.useKanban === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderOpenAi = (row) => {
        return row.useOpenAi === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderIntegrations = (row) => {
        return row.useIntegrations === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderInternal = (row) => {
        return row.useInternal === false ? "Sim" : "Não";
    };

    return (
        <Paper className={classes.tableContainer}>
            <Table
                className={`${classes.fullWidth} ${classes.tableRoot}`}
                // size="small"
                padding="none"
                aria-label="a dense table"
            >
                <TableHead className={classes.tableHead}>
                    <TableRow>
                        <TableCell className={classes.tableHeadCell} align="center" style={{ width: "1%" }}>#</TableCell>
                        <TableCell className={classes.tableHeadCell} align="left">{i18n.t("plans.form.name")}</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">{i18n.t("plans.form.users")}</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">{i18n.t("plans.form.connections")}</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">Filas</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">Valor</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">{i18n.t("plans.form.campaigns")}</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">{i18n.t("plans.form.schedules")}</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">Chat Interno</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">API Externa</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">Kanban</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">Open.Ai</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">Integrações</TableCell>
						<TableCell className={classes.tableHeadCell} align="center">Plano Interno</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {records.map((row) => (
                        <TableRow key={row.id}>
                            <TableCell className={classes.tableBodyCell} align="center" style={{ width: "1%" }}>
                                <IconButton className={classes.editButton} onClick={() => onSelect(row)} aria-label="delete">
                                    <EditIcon />
                                </IconButton>
                            </TableCell>
                            <TableCell className={classes.tableBodyCell} align="left">{row.name || "-"}</TableCell>
                            <TableCell className={classes.tableBodyCell} align="center">{row.users || "-"}</TableCell>
                            <TableCell className={classes.tableBodyCell} align="center">{row.connections || "-"}</TableCell>
                            <TableCell className={classes.tableBodyCell} align="center">{row.queues || "-"}</TableCell>
                            <TableCell className={classes.tableBodyCell} align="center">{i18n.t("plans.form.money")} {row.value ? row.value.toLocaleString("pt-br", { minimumFractionDigits: 2 }) : "00.00"}</TableCell>
                            <TableCell className={classes.tableBodyCell} align="center">{renderCampaigns(row)}</TableCell>
                            <TableCell className={classes.tableBodyCell} align="center">{renderSchedules(row)}</TableCell>
                            <TableCell className={classes.tableBodyCell} align="center">{renderInternalChat(row)}</TableCell>
                            <TableCell className={classes.tableBodyCell} align="center">{renderExternalApi(row)}</TableCell>
                            <TableCell className={classes.tableBodyCell} align="center">{renderKanban(row)}</TableCell>
                            <TableCell className={classes.tableBodyCell} align="center">{renderOpenAi(row)}</TableCell>
                            <TableCell className={classes.tableBodyCell} align="center">{renderIntegrations(row)}</TableCell>
							<TableCell className={classes.tableBodyCell} align="center">{renderInternal(row)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Paper>
    )
}

export default function PlansManager() {
    const classes = useStyles()
    const { list, save, update, remove } = usePlans()

    const [showConfirmDialog, setShowConfirmDialog] = useState(false)
    const [loading, setLoading] = useState(false)
    const [records, setRecords] = useState([])
    const [record, setRecord] = useState({
        name: '',
        users: 0,
        connections: 0,
        queues: 0,
        value: 0,
        useCampaigns: true,
        useSchedules: true,
        useInternalChat: true,
        useExternalApi: true,
        useKanban: true,
        useOpenAi: true,
        useIntegrations: true,
        useInternal: true
    })

    useEffect(() => {
        async function fetchData() {
            await loadPlans()
        }
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [record])

    const loadPlans = async () => {
        setLoading(true)
        try {
            const planList = await list()
            setRecords(planList)
        } catch (e) {
            toast.error('Não foi possível carregar a lista de registros')
        }
        setLoading(false)
    }

    const handleSubmit = async (data) => {
        setLoading(true)
        console.log(data)
        try {
            if (data.id !== undefined) {
                await update(data)
            } else {
                await save(data)
            }
            await loadPlans()
            handleCancel()
            toast.success('Operação realizada com sucesso!')
        } catch (e) {
            toast.error('Não foi possível realizar a operação. Verifique se já existe uma plano com o mesmo nome ou se os campos foram preenchidos corretamente')
        }
        setLoading(false)
    }

    const handleDelete = async () => {
        setLoading(true)
        try {
            await remove(record.id)
            await loadPlans()
            handleCancel()
            toast.success('Operação realizada com sucesso!')
        } catch (e) {
            toast.error('Não foi possível realizar a operação')
        }
        setLoading(false)
    }

    const handleOpenDeleteDialog = () => {
        setShowConfirmDialog(true)
    }

    const handleCancel = () => {
        setRecord({
            id: undefined,
            name: '',
            users: 0,
            connections: 0,
            queues: 0,
            value: 0,
            useCampaigns: true,
            useSchedules: true,
            useInternalChat: true,
            useExternalApi: true,
            useKanban: true,
            useOpenAi: true,
            useIntegrations: true,
            useInternal: true
        })
    }

    const handleSelect = (data) => {

        let useCampaigns = data.useCampaigns === false ? false : true
        let useSchedules = data.useSchedules === false ? false : true
        let useInternalChat = data.useInternalChat === false ? false : true
        let useExternalApi = data.useExternalApi === false ? false : true
        let useKanban = data.useKanban === false ? false : true
        let useOpenAi = data.useOpenAi === false ? false : true
        let useIntegrations = data.useIntegrations === false ? false : true
        let useInternal= data.useInternal === true ? true : false

        setRecord({
            id: data.id,
            name: data.name || '',
            users: data.users || 0,
            connections: data.connections || 0,
            queues: data.queues || 0,
            value: data.value?.toLocaleString('pt-br', { minimumFractionDigits: 0 }) || 0,
            useCampaigns,
            useSchedules,
            useInternalChat,
            useExternalApi,
            useKanban,
            useOpenAi,
            useIntegrations,
            useInternal
        })
    }

    return (
        <Paper className={`${classes.mainPaper} ${classes.root}`} elevation={0}>
            <Grid spacing={2} container>
                <Grid xs={12} item>
                    <PlanManagerForm
                        initialValue={record}
                        onDelete={handleOpenDeleteDialog}
                        onSubmit={handleSubmit}
                        onCancel={handleCancel}
                        loading={loading}
                    />
                </Grid>
                <Grid xs={12} item>
                    <PlansManagerGrid
                        records={records}
                        onSelect={handleSelect}
                    />
                </Grid>
            </Grid>
            <ConfirmationModal
                title="Exclusão de Registro"
                open={showConfirmDialog}
                onClose={() => setShowConfirmDialog(false)}
                onConfirm={() => handleDelete()}
            >
                Deseja realmente excluir esse registro?
            </ConfirmationModal>
        </Paper>
    )
}
