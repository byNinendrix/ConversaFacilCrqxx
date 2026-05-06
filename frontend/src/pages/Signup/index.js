import React, { useState, useEffect } from "react";
import qs from "query-string";

import * as Yup from "yup";
import { useHistory } from "react-router-dom";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import usePlans from "../../hooks/usePlans";
import InputMask from "react-input-mask";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

import { openApi } from "../../services/api";
import toastError from "../../errors/toastError";
import moment from "moment";

const UserSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
	password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
	email: Yup.string().email("Invalid email").required("Required"),
});

const SignUp = () => {
	const history = useHistory();
	const [allowregister, setallowregister] = useState("enabled");
	const [trial, settrial] = useState("3");
	let companyId = null;

	useEffect(() => {
		fetchallowregister();
		fetchtrial();
	}, []);

	const fetchtrial = async () => {
		try {
			const responsevvv = await api.get("/settings/trial");
			const allowtrialX = responsevvv.data.value;
			settrial(allowtrialX);
		} catch (error) {
			console.error("Error retrieving trial", error);
		}
	};

	const fetchallowregister = async () => {
		try {
			const responsevv = await api.get("/settings/allowregister");
			const allowregisterX = responsevv.data.value;
			setallowregister(allowregisterX);
		} catch (error) {
			console.error("Error retrieving allowregister", error);
		}
	};

	if (allowregister === "disabled") {
		history.push("/login");
	}

	const params = qs.parse(window.location.search);
	if (params.companyId !== undefined) {
		companyId = params.companyId;
	}

	const initialState = {
		name: "",
		email: "",
		phone: "",
		password: "",
		planId: "disabled",
	};

	const [user] = useState(initialState);
	const dueDate = moment().add(trial, "day").format();

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
	const { register: listPlans } = usePlans();

	useEffect(() => {
		async function fetchData() {
			const list = await listPlans();
			setPlans(list);
		}
		fetchData();
	}, []);

	const logo = `${process.env.REACT_APP_BACKEND_URL}/public/logotipos/signup.png`;
	const randomValue = Math.random();
	const logoWithRandom = `${logo}?r=${randomValue}`;

	return (
		<div className="page-container min-h-screen">
			<div className="mx-auto max-w-xl">
				<div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-center">
					<img
						className="mx-auto w-full max-w-[240px] object-contain"
						src={logoWithRandom}
						alt={`${process.env.REACT_APP_NAME_SYSTEM}`}
					/>
				</div>

				<div className="form-card">
					<div className="mb-5">
						<h1 className="page-title">Criar conta</h1>
						<p className="mt-1 text-sm text-gray-500">
							Preencha os dados para iniciar seu acesso.
						</p>
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
						{({ touched, errors, isSubmitting }) => (
							<Form className="space-y-4">
								<div>
									<label className="form-label" htmlFor="name">Nome da Empresa</label>
									<Field
										id="name"
										name="name"
										autoComplete="name"
										className="form-input"
									/>
									{touched.name && errors.name && (
										<p className="mt-1 text-xs text-red-600">{errors.name}</p>
									)}
								</div>

								<div>
									<label className="form-label" htmlFor="email">{i18n.t("signup.form.email")}</label>
									<Field
										id="email"
										name="email"
										type="email"
										autoComplete="email"
										className="form-input"
										required
									/>
									{touched.email && errors.email && (
										<p className="mt-1 text-xs text-red-600">{errors.email}</p>
									)}
								</div>

								<div>
									<label className="form-label" htmlFor="phone">DDD988888888</label>
									<Field name="phone">
										{({ field }) => (
											<InputMask
												mask="(99) 99999-9999"
												value={field.value || ""}
												onBlur={field.onBlur}
												onChange={field.onChange}
											>
												{(inputProps) => (
													<input
														{...inputProps}
														id="phone"
														name="phone"
														autoComplete="phone"
														className="form-input"
														required
													/>
												)}
											</InputMask>
										)}
									</Field>
									{touched.phone && errors.phone && (
										<p className="mt-1 text-xs text-red-600">{errors.phone}</p>
									)}
								</div>

								<div>
									<label className="form-label" htmlFor="password">{i18n.t("signup.form.password")}</label>
									<Field
										id="password"
										name="password"
										type="password"
										autoComplete="current-password"
										className="form-input"
										required
									/>
									{touched.password && errors.password && (
										<p className="mt-1 text-xs text-red-600">{errors.password}</p>
									)}
								</div>

								<div>
									<label className="form-label" htmlFor="plan-selection">Plano</label>
									<Field
										as="select"
										id="plan-selection"
										name="planId"
										className="form-select"
										required
									>
										<option value="disabled" disabled>
											Selecione seu plano de assinatura
										</option>
										{plans.map((plan, key) => (
											<option key={key} value={plan.id}>
												{plan.name} - {plan.connections} WhatsApps - {plan.users} Usuários - R$ {plan.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
											</option>
										))}
									</Field>
								</div>

								<button
									type="submit"
									className="btn-primary w-full"
									disabled={isSubmitting}
								>
									{i18n.t("signup.buttons.submit")}
								</button>

								<div className="text-right">
									<RouterLink
										className="text-sm font-semibold text-brand-700 hover:text-brand-800"
										to="/login"
									>
										{i18n.t("signup.buttons.login")}
									</RouterLink>
								</div>
							</Form>
						)}
					</Formik>
				</div>
			</div>
		</div>
	);
};

export default SignUp;
