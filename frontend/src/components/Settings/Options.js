import React, { useEffect, useState } from "react";

import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import OnlyForSuperUser from "../../components/OnlyForSuperUser";
import useAuth from "../../hooks/useAuth.js";
import useSettings from "../../hooks/useSettings";

const useStyles = makeStyles(theme => ({
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
	textFieldControl: {
		"& .MuiOutlinedInput-root": {
			borderRadius: 12,
			background: "#ffffff",
		},
	},
	helperText: {
		fontSize: "0.75rem",
		color: "#0891b2",
	},
}));

export default function Options(props) {
	const { settings, scheduleTypeChanged } = props;
	const classes = useStyles();

	const [currentUser, setCurrentUser] = useState({});
	const { getCurrentUserInfo } = useAuth();
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		async function findData() {
			setLoading(true);
			try {
				const user = await getCurrentUserInfo();
				setCurrentUser(user);
			} catch (e) {
				toast.error(e);
			}
			setLoading(false);
		}
		findData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const [userRating, setUserRating] = useState("disabled");
	const [scheduleType, setScheduleType] = useState("disabled");
	const [callType, setCallType] = useState("enabled");
	const [chatbotType, setChatbotType] = useState("");
	const [CheckMsgIsGroup, setCheckMsgIsGroupType] = useState("enabled");

	const [loadingUserRating, setLoadingUserRating] = useState(false);
	const [loadingScheduleType, setLoadingScheduleType] = useState(false);
	const [loadingCallType, setLoadingCallType] = useState(false);
	const [loadingChatbotType, setLoadingChatbotType] = useState(false);
	const [loadingCheckMsgIsGroup, setCheckMsgIsGroup] = useState(false);

	const [viewclosed, setviewclosed] = useState("disabled");
	const [loadingviewclosed, setLoadingviewclosed] = useState(false);

	const [viewgroups, setviewgroups] = useState("disabled");
	const [loadingviewgroups, setLoadingviewgroups] = useState(false);

	const [ipixcType, setIpIxcType] = useState("");
	const [loadingIpIxcType, setLoadingIpIxcType] = useState(false);
	const [tokenixcType, setTokenIxcType] = useState("");
	const [loadingTokenIxcType, setLoadingTokenIxcType] = useState(false);

	const [ipmkauthType, setIpMkauthType] = useState("");
	const [loadingIpMkauthType, setLoadingIpMkauthType] = useState(false);
	const [clientidmkauthType, setClientIdMkauthType] = useState("");
	const [loadingClientIdMkauthType, setLoadingClientIdMkauthType] = useState(false);
	const [clientsecretmkauthType, setClientSecrectMkauthType] = useState("");
	const [loadingClientSecrectMkauthType, setLoadingClientSecrectMkauthType] = useState(false);

	const [asaasType, setAsaasType] = useState("");
	const [loadingAsaasType, setLoadingAsaasType] = useState(false);

	const [trial, settrial] = useState("3");
	const [loadingtrial, setLoadingtrial] = useState(false);

	const [viewregister, setviewregister] = useState("disabled");
	const [loadingviewregister, setLoadingviewregister] = useState(false);

	const [allowregister, setallowregister] = useState("disabled");
	const [loadingallowregister, setLoadingallowregister] = useState(false);

	const [SendGreetingAccepted, setSendGreetingAccepted] = useState("disabled");
	const [loadingSendGreetingAccepted, setLoadingSendGreetingAccepted] = useState(false);

	const [SettingsTransfTicket, setSettingsTransfTicket] = useState("disabled");
	const [loadingSettingsTransfTicket, setLoadingSettingsTransfTicket] = useState(false);

	const [sendGreetingMessageOneQueues, setSendGreetingMessageOneQueues] = useState("disabled");
	const [loadingSendGreetingMessageOneQueues, setLoadingSendGreetingMessageOneQueues] = useState(false);

	const { update } = useSettings();

	useEffect(() => {
		if (Array.isArray(settings) && settings.length) {
			const userRating = settings.find(s => s.key === "userRating");
			if (userRating) {
				setUserRating(userRating.value);
			}
			const scheduleType = settings.find(s => s.key === "scheduleType");
			if (scheduleType) {
				setScheduleType(scheduleType.value);
			}
			const callType = settings.find(s => s.key === "call");
			if (callType) {
				setCallType(callType.value);
			}
			const CheckMsgIsGroup = settings.find(s => s.key === "CheckMsgIsGroup");
			if (CheckMsgIsGroup) {
				setCheckMsgIsGroupType(CheckMsgIsGroup.value);
			}

			const allowregister = settings.find(s => s.key === "allowregister");
			if (allowregister) {
				setallowregister(allowregister.value);
			}

			const viewclosed = settings.find(s => s.key === "viewclosed");
			if (viewclosed) {
				setviewclosed(viewclosed.value);
			}

			const viewgroups = settings.find(s => s.key === "viewgroups");
			if (viewgroups) {
				setviewgroups(viewgroups.value);
			}

			const SendGreetingAccepted = settings.find(s => s.key === "sendGreetingAccepted");
			if (SendGreetingAccepted) {
				setSendGreetingAccepted(SendGreetingAccepted.value);
			}

			const SettingsTransfTicket = settings.find(s => s.key === "sendMsgTransfTicket");
			if (SettingsTransfTicket) {
				setSettingsTransfTicket(SettingsTransfTicket.value);
			}

			const viewregister = settings.find(s => s.key === "viewregister");
			if (viewregister) {
				setviewregister(viewregister.value);
			}

			const sendGreetingMessageOneQueues = settings.find(
				s => s.key === "sendGreetingMessageOneQueues"
			);
			if (sendGreetingMessageOneQueues) {
				setSendGreetingMessageOneQueues(sendGreetingMessageOneQueues.value);
			}

			const chatbotType = settings.find(s => s.key === "chatBotType");
			if (chatbotType) {
				setChatbotType(chatbotType.value);
			}

			const trial = settings.find(s => s.key === "trial");
			if (trial) {
				settrial(trial.value);
			}

			const ipixcType = settings.find(s => s.key === "ipixc");
			if (ipixcType) {
				setIpIxcType(ipixcType.value);
			}

			const tokenixcType = settings.find(s => s.key === "tokenixc");
			if (tokenixcType) {
				setTokenIxcType(tokenixcType.value);
			}

			const ipmkauthType = settings.find(s => s.key === "ipmkauth");
			if (ipmkauthType) {
				setIpMkauthType(ipmkauthType.value);
			}

			const clientidmkauthType = settings.find(s => s.key === "clientidmkauth");
			if (clientidmkauthType) {
				setClientIdMkauthType(clientidmkauthType.value);
			}

			const clientsecretmkauthType = settings.find(s => s.key === "clientsecretmkauth");
			if (clientsecretmkauthType) {
				setClientSecrectMkauthType(clientsecretmkauthType.value);
			}

			const asaasType = settings.find(s => s.key === "asaas");
			if (asaasType) {
				setAsaasType(asaasType.value);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [settings]);

	async function handleChangeUserRating(value) {
		setUserRating(value);
		setLoadingUserRating(true);
		await update({
			key: "userRating",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingUserRating(false);
	}

	async function handleallowregister(value) {
		setallowregister(value);
		setLoadingallowregister(true);
		await update({
			key: "allowregister",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingallowregister(false);
	}

	async function handleviewclosed(value) {
		setviewclosed(value);
		setLoadingviewclosed(true);
		await update({
			key: "viewclosed",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingviewclosed(false);
	}

	async function handleviewgroups(value) {
		setviewgroups(value);
		setLoadingviewgroups(true);
		await update({
			key: "viewgroups",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingviewgroups(false);
	}

	async function handleSendGreetingMessageOneQueues(value) {
		setSendGreetingMessageOneQueues(value);
		setLoadingSendGreetingMessageOneQueues(true);
		await update({
			key: "sendGreetingMessageOneQueues",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingSendGreetingMessageOneQueues(false);
	}

	async function handleviewregister(value) {
		setviewregister(value);
		setLoadingviewregister(true);
		await update({
			key: "viewregister",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingviewregister(false);
	}

	async function handletrial(value) {
		settrial(value);
		setLoadingtrial(true);
		await update({
			key: "trial",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingtrial(false);
	}

	async function handleScheduleType(value) {
		setScheduleType(value);
		setLoadingScheduleType(true);
		await update({
			key: "scheduleType",
			value,
		});
		toast.success("Operação atualizada com sucesso.", {
			position: "top-right",
			autoClose: 2000,
			hideProgressBar: false,
			closeOnClick: true,
			pauseOnHover: false,
			draggable: true,
			theme: "light",
		});
		setLoadingScheduleType(false);
		if (typeof scheduleTypeChanged === "function") {
			scheduleTypeChanged(value);
		}
	}

	async function handleCallType(value) {
		setCallType(value);
		setLoadingCallType(true);
		await update({
			key: "call",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingCallType(false);
	}

	async function handleChatbotType(value) {
		setChatbotType(value);
		setLoadingChatbotType(true);
		await update({
			key: "chatBotType",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingChatbotType(false);
	}

	async function handleGroupType(value) {
		setCheckMsgIsGroupType(value);
		setCheckMsgIsGroup(true);
		await update({
			key: "CheckMsgIsGroup",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setCheckMsgIsGroupType(false);
	}

	async function handleSendGreetingAccepted(value) {
		setSendGreetingAccepted(value);
		setLoadingSendGreetingAccepted(true);
		await update({
			key: "sendGreetingAccepted",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingSendGreetingAccepted(false);
	}

	async function handleSettingsTransfTicket(value) {
		setSettingsTransfTicket(value);
		setLoadingSettingsTransfTicket(true);
		await update({
			key: "sendMsgTransfTicket",
			value,
		});

		toast.success("Operação atualizada com sucesso.");
		setLoadingSettingsTransfTicket(false);
	}

	async function handleChangeIPIxc(value) {
		setIpIxcType(value);
		setLoadingIpIxcType(true);
		await update({
			key: "ipixc",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingIpIxcType(false);
	}

	async function handleChangeTokenIxc(value) {
		setTokenIxcType(value);
		setLoadingTokenIxcType(true);
		await update({
			key: "tokenixc",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingTokenIxcType(false);
	}

	async function handleChangeIpMkauth(value) {
		setIpMkauthType(value);
		setLoadingIpMkauthType(true);
		await update({
			key: "ipmkauth",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingIpMkauthType(false);
	}

	async function handleChangeClientIdMkauth(value) {
		setClientIdMkauthType(value);
		setLoadingClientIdMkauthType(true);
		await update({
			key: "clientidmkauth",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingClientIdMkauthType(false);
	}

	async function handleChangeClientSecrectMkauth(value) {
		setClientSecrectMkauthType(value);
		setLoadingClientSecrectMkauthType(true);
		await update({
			key: "clientsecretmkauth",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingClientSecrectMkauthType(false);
	}

	async function handleChangeAsaas(value) {
		setAsaasType(value);
		setLoadingAsaasType(true);
		await update({
			key: "asaas",
			value,
		});
		toast.success("Operação atualizada com sucesso.");
		setLoadingAsaasType(false);
	}

	const renderSelectField = ({
		id,
		label,
		value,
		onChange,
		loadingState,
		options,
		xs = 12,
		sm = 12,
		md = 6,
	}) => (
		<Grid item xs={xs} sm={sm} md={md} key={id}>
			<FormControl variant="outlined" className={classes.selectContainer}>
				<InputLabel id={`${id}-label`} className={classes.inputLabel}>
					{label}
				</InputLabel>
				<Select
					labelId={`${id}-label`}
					value={value}
					onChange={async e => onChange(e.target.value)}
					label={label}
					className={classes.selectControl}
					disabled={loading}
				>
					{options.map(option => (
						<MenuItem key={`${id}-${option.value}`} value={option.value}>
							{option.label}
						</MenuItem>
					))}
				</Select>
				<FormHelperText className={classes.helperText}>
					{loadingState && "Atualizando..."}
				</FormHelperText>
			</FormControl>
		</Grid>
	);

	const renderTextField = ({
		id,
		label,
		value,
		onChange,
		loadingState,
		xs = 12,
		sm = 12,
		md = 6,
	}) => (
		<Grid item xs={xs} sm={sm} md={md} key={id}>
			<FormControl className={classes.selectContainer}>
				<TextField
					id={id}
					name={id}
					label={label}
					variant="outlined"
					margin="dense"
					value={value}
					onChange={async e => onChange(e.target.value)}
					className={classes.textFieldControl}
					disabled={loading}
				/>
				<FormHelperText className={classes.helperText}>
					{loadingState && "Atualizando..."}
				</FormHelperText>
			</FormControl>
		</Grid>
	);

	return (
		<div className={classes.root}>
			<div className={classes.sectionCard}>
				<div className={classes.sectionHeader}>
					<Typography className={classes.sectionTitle}>Operações</Typography>
					<Typography className={classes.sectionSubtitle}>
						Defina regras gerais do atendimento e comportamento do chatbot.
					</Typography>
				</div>

				<Grid container spacing={2} className={classes.formGrid}>
					{renderSelectField({
						id: "ratings",
						label: "Avaliações",
						value: userRating,
						onChange: handleChangeUserRating,
						loadingState: loadingUserRating,
						options: [
							{ value: "disabled", label: "Desabilitadas" },
							{ value: "enabled", label: "Habilitadas" },
						],
					})}
					{renderSelectField({
						id: "schedule-type",
						label: "Gerenciamento de Expediente",
						value: scheduleType,
						onChange: handleScheduleType,
						loadingState: loadingScheduleType,
						options: [
							{ value: "disabled", label: "Desabilitado" },
							{ value: "queue", label: "Fila" },
							{ value: "company", label: "Empresa" },
						],
					})}
					{renderSelectField({
						id: "group-type",
						label: "Ignorar Mensagens de Grupos",
						value: CheckMsgIsGroup,
						onChange: handleGroupType,
						loadingState: loadingCheckMsgIsGroup,
						options: [
							{ value: "disabled", label: "Desativado" },
							{ value: "enabled", label: "Ativado" },
						],
					})}
					{renderSelectField({
						id: "call-type",
						label: "Aceitar Chamada",
						value: callType,
						onChange: handleCallType,
						loadingState: loadingCallType,
						options: [
							{ value: "disabled", label: "Não Aceitar" },
							{ value: "enabled", label: "Aceitar" },
						],
					})}
					{renderSelectField({
						id: "chatbot-type",
						label: "Tipo Chatbot",
						value: chatbotType,
						onChange: handleChatbotType,
						loadingState: loadingChatbotType,
						options: [{ value: "text", label: "Texto" }],
					})}
					{renderSelectField({
						id: "send-greeting-accepted",
						label: "Enviar saudação ao aceitar o ticket",
						value: SendGreetingAccepted,
						onChange: handleSendGreetingAccepted,
						loadingState: loadingSendGreetingAccepted,
						options: [
							{ value: "disabled", label: "Desabilitado" },
							{ value: "enabled", label: "Habilitado" },
						],
					})}
					{renderSelectField({
						id: "send-msg-transf-ticket",
						label: "Enviar mensagem de transferencia de Fila/agente",
						value: SettingsTransfTicket,
						onChange: handleSettingsTransfTicket,
						loadingState: loadingSettingsTransfTicket,
						options: [
							{ value: "disabled", label: "Desabilitado" },
							{ value: "enabled", label: "Habilitado" },
						],
					})}
					{renderSelectField({
						id: "send-greeting-one-queue",
						label: "Enviar saudação quando houver somente 1 fila",
						value: sendGreetingMessageOneQueues,
						onChange: handleSendGreetingMessageOneQueues,
						loadingState: loadingSendGreetingMessageOneQueues,
						options: [
							{ value: "disabled", label: "Desabilitado" },
							{ value: "enabled", label: "Habilitado" },
						],
					})}
					{renderSelectField({
						id: "viewclosed",
						label: "Operador Visualiza Tickets Fechados?",
						value: viewclosed,
						onChange: handleviewclosed,
						loadingState: loadingviewclosed,
						options: [
							{ value: "disabled", label: "Não" },
							{ value: "enabled", label: "Sim" },
						],
					})}
					{renderSelectField({
						id: "viewgroups",
						label: "Operador Visualiza Grupos?",
						value: viewgroups,
						onChange: handleviewgroups,
						loadingState: loadingviewgroups,
						options: [
							{ value: "disabled", label: "Não" },
							{ value: "enabled", label: "Sim" },
						],
					})}
				</Grid>
			</div>

			<OnlyForSuperUser
				user={currentUser}
				yes={() => (
					<div className={classes.sectionCard}>
						<div className={classes.sectionHeader}>
							<Typography className={classes.sectionTitle}>Configurações Globais</Typography>
							<Typography className={classes.sectionSubtitle}>
								Ajustes de registro e período de trial visíveis para superusuário.
							</Typography>
						</div>

						<Grid container spacing={2} className={classes.formGrid}>
							{renderSelectField({
								id: "allowregister",
								label: "Registro (Inscrição) Permitida?",
								value: allowregister,
								onChange: handleallowregister,
								loadingState: loadingallowregister,
								options: [
									{ value: "disabled", label: "Não" },
									{ value: "enabled", label: "Sim" },
								],
							})}
							{renderSelectField({
								id: "viewregister",
								label: "Registro (Inscrição) Visível?",
								value: viewregister,
								onChange: handleviewregister,
								loadingState: loadingviewregister,
								options: [
									{ value: "disabled", label: "Não" },
									{ value: "enabled", label: "Sim" },
								],
							})}
							{renderSelectField({
								id: "trial",
								label: "Tempo de Trial?",
								value: trial,
								onChange: handletrial,
								loadingState: loadingtrial,
								options: [
									{ value: "1", label: "1" },
									{ value: "2", label: "2" },
									{ value: "3", label: "3" },
									{ value: "4", label: "4" },
									{ value: "5", label: "5" },
									{ value: "6", label: "6" },
									{ value: "7", label: "7" },
								],
							})}
						</Grid>
					</div>
				)}
			/>

			<div className={classes.sectionCard}>
				<div className={classes.sectionHeader}>
					<Typography className={classes.sectionTitle}>Integrações</Typography>
					<Typography className={classes.sectionSubtitle}>
						Credenciais de integração para IXC, MK-AUTH e ASAAS.
					</Typography>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
					<div>
						<Typography className={classes.sectionTitle} style={{ fontSize: 12 }}>
							IXC
						</Typography>
						<Grid container spacing={2} className={classes.formGrid}>
							{renderTextField({
								id: "ipixc",
								label: "IP do IXC",
								value: ipixcType,
								onChange: handleChangeIPIxc,
								loadingState: loadingIpIxcType,
							})}
							{renderTextField({
								id: "tokenixc",
								label: "Token do IXC",
								value: tokenixcType,
								onChange: handleChangeTokenIxc,
								loadingState: loadingTokenIxcType,
							})}
						</Grid>
					</div>

					<div>
						<Typography className={classes.sectionTitle} style={{ fontSize: 12 }}>
							MK-AUTH
						</Typography>
						<Grid container spacing={2} className={classes.formGrid}>
							{renderTextField({
								id: "ipmkauth",
								label: "Ip Mk-Auth",
								value: ipmkauthType,
								onChange: handleChangeIpMkauth,
								loadingState: loadingIpMkauthType,
								md: 4,
							})}
							{renderTextField({
								id: "clientidmkauth",
								label: "Client Id",
								value: clientidmkauthType,
								onChange: handleChangeClientIdMkauth,
								loadingState: loadingClientIdMkauthType,
								md: 4,
							})}
							{renderTextField({
								id: "clientsecretmkauth",
								label: "Client Secret",
								value: clientsecretmkauthType,
								onChange: handleChangeClientSecrectMkauth,
								loadingState: loadingClientSecrectMkauthType,
								md: 4,
							})}
						</Grid>
					</div>

					<div>
						<Typography className={classes.sectionTitle} style={{ fontSize: 12 }}>
							ASAAS
						</Typography>
						<Grid container spacing={2} className={classes.formGrid}>
							{renderTextField({
								id: "asaas",
								label: "Token Asaas",
								value: asaasType,
								onChange: handleChangeAsaas,
								loadingState: loadingAsaasType,
								md: 12,
							})}
						</Grid>
					</div>
				</div>
			</div>
		</div>
	);
}
