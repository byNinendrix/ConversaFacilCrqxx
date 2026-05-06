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
    IconButton
} from "@material-ui/core";
import { Formik, Form, Field } from 'formik';
import ButtonWithSpinner from "../ButtonWithSpinner";
import ConfirmationModal from "../ConfirmationModal";

import { Edit as EditIcon } from "@material-ui/icons";

import { toast } from "react-toastify";
import useHelps from "../../hooks/useHelps";


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
	formCard: {
		border: "1px solid #f3f4f6",
		borderRadius: 12,
		padding: theme.spacing(1.5),
		backgroundColor: "#ffffff"
	},
	sectionTitle: {
		fontSize: "0.75rem",
		fontWeight: 700,
		letterSpacing: "0.08em",
		textTransform: "uppercase",
		color: "#155e75",
		marginBottom: theme.spacing(1.5)
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
		minWidth: 760
	},
	tableHead: {
		backgroundColor: "#f8fafc",
		"& .MuiTableCell-root": {
			fontSize: "0.75rem",
			fontWeight: 700,
			color: "#374151",
			textTransform: "uppercase",
			letterSpacing: "0.04em",
			borderBottom: "1px solid #e5e7eb",
			padding: "10px 12px",
			whiteSpace: "nowrap"
		}
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

export function HelpManagerForm (props) {
    const { onSubmit, onDelete, onCancel, initialValue, loading } = props;
    const classes = useStyles()

    const [record, setRecord] = useState(initialValue);

    useEffect(() => {
        setRecord(initialValue)
    }, [initialValue])

    const handleSubmit = async(data) => {
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
                    <div className={classes.sectionTitle}>Cadastro de ajuda</div>
                    <Grid spacing={2} justifyContent="flex-end" container>
                        <Grid xs={12} sm={6} md={3} item>
                            <Field
                                as={TextField}
                                label="Título"
                                name="title"
                                variant="outlined"
                                className={`${classes.fullWidth} ${classes.fieldControl}`}
                                margin="dense"
                            />
                        </Grid>
                        <Grid xs={12} sm={6} md={3} item>
                            <Field
                                as={TextField}
                                label="Código do Vídeo"
                                name="video"
                                variant="outlined"
                                className={`${classes.fullWidth} ${classes.fieldControl}`}
                                margin="dense"
                            />
                        </Grid>
                        <Grid xs={12} sm={12} md={6} item>
                            <Field
                                as={TextField}
                                label="Descrição"
                                name="description"
                                variant="outlined"
                                className={`${classes.fullWidth} ${classes.fieldControl}`}
                                margin="dense"
                            />
                        </Grid>
                        <Grid sm={3} md={1} item>
                            <ButtonWithSpinner className={`${classes.fullWidth} ${classes.btnSecondary}`} loading={loading} onClick={() => onCancel()} variant="contained">
                                Limpar
                            </ButtonWithSpinner>
                        </Grid>
                        { record.id !== undefined ? (
                            <Grid sm={3} md={1} item>
                                <ButtonWithSpinner className={`${classes.fullWidth} ${classes.btnDanger}`} loading={loading} onClick={() => onDelete(record)} variant="contained" color="secondary">
                                    Excluir
                                </ButtonWithSpinner>
                            </Grid>
                        ) : null}
                        <Grid sm={3} md={1} item>
                            <ButtonWithSpinner className={`${classes.fullWidth} ${classes.btnPrimary}`} loading={loading} type="submit" variant="contained" color="primary">
                                Salvar
                            </ButtonWithSpinner>
                        </Grid>
                    </Grid>
                    </div>
                </Form>
            )}
        </Formik>
    )
}

export function HelpsManagerGrid (props) {
    const { records, onSelect } = props
    const classes = useStyles()

    return (
        <Paper className={classes.tableContainer}>
            <Table className={`${classes.fullWidth} ${classes.tableRoot}`} size="small" aria-label="a dense table">
                <TableHead className={classes.tableHead}>
                <TableRow>
                    <TableCell className={classes.tableHeadCell} align="center" style={{width: "1%"}}>#</TableCell>
                    <TableCell align="left">Título</TableCell>
                    <TableCell align="left">Descrição</TableCell>
                    <TableCell align="left">Vídeo</TableCell>
                </TableRow>
                </TableHead>
                <TableBody>
                {records.map((row) => (
                    <TableRow key={row.id}>
                        <TableCell className={classes.tableBodyCell} align="center" style={{width: "1%"}}>
                            <IconButton className={classes.editButton} onClick={() => onSelect(row)} aria-label="delete">
                                <EditIcon />
                            </IconButton>
                        </TableCell>
                        <TableCell className={classes.tableBodyCell} align="left">{row.title || '-'}</TableCell>
                        <TableCell className={classes.tableBodyCell} align="left">{row.description || '-'}</TableCell>
                        <TableCell className={classes.tableBodyCell} align="left">{row.video || '-'}</TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
        </Paper>
    )
}

export default function HelpsManager () {
    const classes = useStyles()
    const { list, save, update, remove } = useHelps()
    
    const [showConfirmDialog, setShowConfirmDialog] = useState(false)
    const [loading, setLoading] = useState(false)
    const [records, setRecords] = useState([])
    const [record, setRecord] = useState({
        title: '',
        description: '',
        video: ''
    })

    useEffect(() => {
        async function fetchData () {
            await loadHelps()
        }
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const loadHelps = async () => {
        setLoading(true)
        try {
            const helpList = await list()
            setRecords(helpList)
        } catch (e) {
            toast.error('Não foi possível carregar a lista de registros')
        }
        setLoading(false)
    }

    const handleSubmit = async (data) => {
        setLoading(true)
        try {
            if (data.id !== undefined) {
                await update(data)
            } else {
                await save(data)
            }
            await loadHelps()
            handleCancel()
            toast.success('Operação realizada com sucesso!')
        } catch (e) {
            toast.error('Não foi possível realizar a operação. Verifique se já existe uma helpo com o mesmo nome ou se os campos foram preenchidos corretamente')
        }
        setLoading(false)
    }

    const handleDelete = async () => {
        setLoading(true)
        try {
            await remove(record.id)
            await loadHelps()
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
            title: '',
            description: '',
            video: ''
        })
    }

    const handleSelect = (data) => {
        setRecord({
            id: data.id,
            title: data.title || '',
            description: data.description || '',
            video: data.video || ''
        })
    }

    return (
        <Paper className={`${classes.mainPaper} ${classes.root}`} elevation={0}>
            <Grid spacing={2} container>
                <Grid xs={12} item>
                    <HelpManagerForm 
                        initialValue={record} 
                        onDelete={handleOpenDeleteDialog} 
                        onSubmit={handleSubmit} 
                        onCancel={handleCancel} 
                        loading={loading}
                    />
                </Grid>
                <Grid xs={12} item>
                    <HelpsManagerGrid 
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
