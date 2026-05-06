import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import usePlans from "../../hooks/usePlans";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Grid from "@material-ui/core/Grid";
import InputMask from "react-input-mask";
import { InputLabel, MenuItem, Select } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import { i18n } from "../../translate/i18n";

import { openApi } from "../../services/api";
import toastError from "../../errors/toastError";
import moment from "moment";

const logo = `${process.env.REACT_APP_BACKEND_URL}/public/logotipos/login.png`;
const useStyles = makeStyles(theme => ({
	pageShell: {
		minHeight: "100vh",
		display: "flex",
		alignItems: "center",
		padding: theme.spacing(4, 0),
	},
	paper: {
		width: "100%",
		maxWidth: 720,
		borderRadius: 20,
		border: "1px solid #f3f4f6",
		background: "#ffffff",
		boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
		padding: theme.spacing(4),
	},
	header: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: theme.spacing(1.5),
		marginBottom: theme.spacing(3),
	},
	logo: {
		width: "100%",
		maxWidth: 260,
		height: 80,
		objectFit: "contain",
	},
	title: {
		fontSize: "1.125rem",
		fontWeight: 700,
		color: "#111827",
	},
	subtitle: {
		fontSize: "0.875rem",
		color: "#6b7280",
		textAlign: "center",
	},
	form: {
		width: "100%",
	},
	fieldBlock: {
		"& .MuiFormLabel-root": {
			fontSize: "0.75rem",
			fontWeight: 700,
			color: "#4b5563",
			letterSpacing: "0.04em",
			textTransform: "uppercase",
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
		"& .MuiFormHelperText-root": {
			marginLeft: 4,
		},
	},
	selectLabel: {
		display: "block",
		fontSize: "0.75rem",
		fontWeight: 700,
		color: "#4b5563",
		letterSpacing: "0.04em",
		textTransform: "uppercase",
		marginBottom: theme.spacing(0.75),
	},
	selectField: {
		width: "100%",
		"& .MuiSelect-root": {
			fontSize: "0.875rem",
		},
		"& .MuiOutlinedInput-root": {
			borderRadius: 12,
			backgroundColor: "#ffffff",
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
	},
	submitWrap: {
		borderTop: "2px solid #f3f4f6",
		paddingTop: theme.spacing(2),
		marginTop: theme.spacing(2.5),
	},
	submit: {
		width: "100%",
		borderRadius: 12,
		padding: "10px 20px",
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
}));

const UserSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
	password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
	email: Yup.string().email("Invalid email").required("Required"),
});

const SignUp = () => {
	const classes = useStyles();
	const history = useHistory();

	const initialState = { name: "", email: "", phone: "", password: "", planId: "", };

	const [user] = useState(initialState);
	const dueDate = moment().add(3, "day").format();
	const handleSignUp = async values => {
		Object.assign(values, { recurrence: "MENSAL" });
		Object.assign(values, { dueDate: dueDate });
		Object.assign(values, { status: "t" });
		Object.assign(values, { campaignsEnabled: true });
		try {
			await openApi.post("/companies/cadastro", values);
			toast.success(i18n.t("signup.toasts.success"));
			history.push("/login");
		} catch (err) {
			console.log(err);
			toastError(err);
		}
	};

	const [plans, setPlans] = useState([]);
	const { list: listPlans } = usePlans();

	useEffect(() => {
		async function fetchData() {
			const list = await listPlans();
			setPlans(list);
		}
		fetchData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className={classes.pageShell}>
			<CssBaseline />
			<Container component="main" maxWidth="sm">
				<div className={classes.paper}>
					<div className={classes.header}>
						<img className={classes.logo} src={logo} alt="ConversaFacil" />
						<div className={classes.title}>{i18n.t("signup.title")}</div>
						<div className={classes.subtitle}>
							Cadastre sua empresa com os dados principais e selecione o plano.
						</div>
					</div>

					<Formik
						initialValues={user}
						enableReinitialize={true}
						validationSchema={UserSchema}
						onSubmit={(values, actions) => {
							setTimeout(() => {
								handleSignUp(values);
								actions.setSubmitting(false);
							}, 400);
						}}
					>
						{({ touched, errors }) => (
							<Form className={classes.form}>
								<Grid container spacing={2}>
									<Grid item xs={12}>
										<Field
											as={TextField}
											autoComplete="name"
											name="name"
											error={touched.name && Boolean(errors.name)}
											helperText={touched.name && errors.name}
											variant="outlined"
											fullWidth
											id="name"
											label="Nome da Empresa"
											className={classes.fieldBlock}
										/>
									</Grid>

									<Grid item xs={12}>
										<Field
											as={TextField}
											variant="outlined"
											fullWidth
											id="email"
											label={i18n.t("signup.form.email")}
											name="email"
											error={touched.email && Boolean(errors.email)}
											helperText={touched.email && errors.email}
											autoComplete="email"
											required
											className={classes.fieldBlock}
										/>
									</Grid>

									<Grid item xs={12}>
										<Field
											as={InputMask}
											mask="(99) 99999-9999"
											variant="outlined"
											fullWidth
											id="phone"
											name="phone"
											error={touched.phone && Boolean(errors.phone)}
											helperText={touched.phone && errors.phone}
											autoComplete="phone"
											required
										>
											{({ field }) => (
												<TextField
													{...field}
													variant="outlined"
													fullWidth
													label="DDD988888888"
													inputProps={{ maxLength: 11 }}
													className={classes.fieldBlock}
												/>
											)}
										</Field>
									</Grid>

									<Grid item xs={12}>
										<Field
											as={TextField}
											variant="outlined"
											fullWidth
											name="password"
											error={touched.password && Boolean(errors.password)}
											helperText={touched.password && errors.password}
											label={i18n.t("signup.form.password")}
											type="password"
											id="password"
											autoComplete="current-password"
											required
											className={classes.fieldBlock}
										/>
									</Grid>

									<Grid item xs={12}>
										<InputLabel htmlFor="plan-selection" className={classes.selectLabel}>
											Plano
										</InputLabel>
										<Field
											as={Select}
											variant="outlined"
											fullWidth
											id="plan-selection"
											label="Plano"
											name="planId"
											required
											className={classes.selectField}
										>
											{plans.map((plan, key) => (
												<MenuItem key={key} value={plan.id}>
													{plan.name} - Atendentes: {plan.users} - WhatsApp:{" "}
													{plan.connections} - Filas: {plan.queues} - R$ {plan.value}
												</MenuItem>
											))}
										</Field>
									</Grid>
								</Grid>

								<div className={classes.submitWrap}>
									<Button type="submit" fullWidth variant="contained" className={classes.submit}>
										{i18n.t("signup.buttons.submit")}
									</Button>
								</div>
							</Form>
						)}
					</Formik>
				</div>
			</Container>
		</div>
	);
};

export default SignUp;
