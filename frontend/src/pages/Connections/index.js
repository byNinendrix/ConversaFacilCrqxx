import React, { useState, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import { makeStyles } from "@material-ui/core/styles";
import {
	TableBody,
	TableRow,
	TableCell,
	IconButton,
	Table,
	TableHead,
	Paper,
	Tooltip,
} from "@material-ui/core";
import {
	CheckCircle2,
	Pencil,
	RefreshCcw,
	Trash2,
	Wifi,
	WifiOff,
	QrCode,
	Unplug,
	LoaderCircle,
	Plus,
} from "lucide-react";
import formatSerializedId from "../../utils/formatSerializedId";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";

import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		overflowY: "auto",
		borderRadius: 16,
		border: "1px solid #f3f4f6",
		boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
		background: "#ffffff",
		...theme.scrollbarStyles,
	},
	tableHeadCell: {
		background: "#f8fafc",
		color: "#334155",
		fontSize: 12,
		fontWeight: 700,
		textTransform: "uppercase",
		letterSpacing: "0.06em",
		borderBottom: "1px solid #e5e7eb",
		whiteSpace: "nowrap",
	},
	tableBodyCell: {
		borderBottom: "1px solid #f1f5f9",
		fontSize: 14,
		color: "#1f2937",
	},
	rowHover: {
		"&:hover": {
			background: "#f8fafc",
		},
	},
	customTableCell: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing(1),
	},
	actionsStack: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing(1),
		flexWrap: "wrap",
	},
	iconButton: {
		border: "1px solid #e5e7eb",
		borderRadius: 10,
		padding: 8,
		background: "#ffffff",
		"&:hover": {
			background: "#f8fafc",
		},
	},
	tooltip: {
		backgroundColor: "#f8fafc",
		color: "#0f172a",
		fontSize: theme.typography.pxToRem(12),
		border: "1px solid #e2e8f0",
		maxWidth: 320,
		padding: theme.spacing(1.25),
		borderRadius: 10,
	},
	tooltipPopper: {
		textAlign: "center",
	},
}));

const STATUS_BADGE_CLASS = {
	DISCONNECTED: "bg-red-100 text-red-700",
	OPENING: "bg-amber-100 text-amber-700",
	qrcode: "bg-brand-100 text-brand-700",
	CONNECTED: "bg-emerald-100 text-emerald-700",
	TIMEOUT: "bg-orange-100 text-orange-700",
	PAIRING: "bg-orange-100 text-orange-700",
};

const CustomToolTip = ({ title, content, children }) => {
	const classes = useStyles();

	return (
		<Tooltip
			arrow
			classes={{
				tooltip: classes.tooltip,
				popper: classes.tooltipPopper,
			}}
			title={
				<div>
					<div className="text-xs font-semibold text-slate-800">{title}</div>
					{content ? <div className="mt-1 text-xs text-slate-600">{content}</div> : null}
				</div>
			}
		>
			{children}
		</Tooltip>
	);
};

const Connections = () => {
	const classes = useStyles();

	const { user } = useContext(AuthContext);
	const { whatsApps, loading } = useContext(WhatsAppsContext);
	const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
	const [qrModalOpen, setQrModalOpen] = useState(false);
	const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const confirmationModalInitialState = {
		action: "",
		title: "",
		message: "",
		whatsAppId: "",
		open: false,
	};
	const [confirmModalInfo, setConfirmModalInfo] = useState(
		confirmationModalInitialState
	);

	const restartWhatsapps = async () => {
		try {
			await api.post("/whatsapp-restart/");
			toast.warn(i18n.t("Aguarde... reiniciando..."));
		} catch (err) {
			toastError(err);
		}
	};

	const handleSessionActionError = err => {
		const backendError = err?.response?.data?.error;
		if (backendError) {
			toastError(err);
			return;
		}

		toastError("Nao foi possivel iniciar a sessao do WhatsApp. Tente novamente.");
	};

	const handleStartWhatsAppSession = async whatsAppId => {
		try {
			await api.post(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			handleSessionActionError(err);
		}
	};

	const handleRequestNewQrCode = async whatsAppId => {
		try {
			await api.put(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			handleSessionActionError(err);
		}
	};

	const handleOpenWhatsAppModal = () => {
		setSelectedWhatsApp(null);
		setWhatsAppModalOpen(true);
	};

	const handleCloseWhatsAppModal = useCallback(() => {
		setWhatsAppModalOpen(false);
		setSelectedWhatsApp(null);
	}, [setSelectedWhatsApp, setWhatsAppModalOpen]);

	const handleOpenQrModal = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setQrModalOpen(true);
	};

	const handleCloseQrModal = useCallback(() => {
		setSelectedWhatsApp(null);
		setQrModalOpen(false);
	}, [setQrModalOpen, setSelectedWhatsApp]);

	const handleEditWhatsApp = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setWhatsAppModalOpen(true);
	};

	const handleOpenConfirmationModal = (action, whatsAppId) => {
		if (action === "disconnect") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.disconnectTitle"),
				message: i18n.t("connections.confirmationModal.disconnectMessage"),
				whatsAppId: whatsAppId,
			});
		}

		if (action === "delete") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.deleteTitle"),
				message: i18n.t("connections.confirmationModal.deleteMessage"),
				whatsAppId: whatsAppId,
			});
		}
		setConfirmModalOpen(true);
	};

	const handleSubmitConfirmationModal = async () => {
		if (confirmModalInfo.action === "disconnect") {
			try {
				await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
			} catch (err) {
				toastError(err);
			}
		}

		if (confirmModalInfo.action === "delete") {
			try {
				await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
				toast.success(i18n.t("connections.toasts.deleted"));
			} catch (err) {
				toastError(err);
			}
		}

		setConfirmModalInfo(confirmationModalInitialState);
	};

	const renderActionButtons = whatsApp => {
		return (
			<div className={classes.actionsStack}>
				{whatsApp.status === "qrcode" && (
					<button
						type="button"
						className="btn-primary inline-flex items-center gap-1 px-3 py-2 text-xs"
						onClick={() => handleOpenQrModal(whatsApp)}
					>
						<QrCode size={14} />
						{i18n.t("connections.buttons.qrcode")}
					</button>
				)}

				{whatsApp.status === "DISCONNECTED" && (
					<>
						<button
							type="button"
							className="btn-secondary inline-flex items-center gap-1 px-3 py-2 text-xs"
							onClick={() => handleStartWhatsAppSession(whatsApp.id)}
						>
							<RefreshCcw size={14} />
							{i18n.t("connections.buttons.tryAgain")}
						</button>
						<button
							type="button"
							className="btn-primary inline-flex items-center gap-1 px-3 py-2 text-xs"
							onClick={() => handleRequestNewQrCode(whatsApp.id)}
						>
							<QrCode size={14} />
							{i18n.t("connections.buttons.newQr")}
						</button>
					</>
				)}

				{(whatsApp.status === "CONNECTED" ||
					whatsApp.status === "PAIRING" ||
					whatsApp.status === "TIMEOUT") && (
					<button
						type="button"
						className="btn-secondary inline-flex items-center gap-1 px-3 py-2 text-xs text-red-700"
						onClick={() => {
							handleOpenConfirmationModal("disconnect", whatsApp.id);
						}}
					>
						<Unplug size={14} />
						{i18n.t("connections.buttons.disconnect")}
					</button>
				)}

				{whatsApp.status === "OPENING" && (
					<button
						type="button"
						className="btn-secondary inline-flex items-center gap-1 px-3 py-2 text-xs opacity-70"
						disabled
					>
						<LoaderCircle size={14} className="animate-spin" />
						{i18n.t("connections.buttons.connecting")}
					</button>
				)}
			</div>
		);
	};

	const renderStatusToolTips = whatsApp => {
		return (
			<div className={classes.customTableCell}>
				{whatsApp.status === "DISCONNECTED" && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.disconnected.title")}
						content={i18n.t("connections.toolTips.disconnected.content")}
					>
						<WifiOff size={18} className="text-red-500" />
					</CustomToolTip>
				)}
				{whatsApp.status === "OPENING" && <div className="spinner" />}
				{whatsApp.status === "qrcode" && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.qrcode.title")}
						content={i18n.t("connections.toolTips.qrcode.content")}
					>
						<QrCode size={18} className="text-brand-600" />
					</CustomToolTip>
				)}
				{whatsApp.status === "CONNECTED" && (
					<CustomToolTip title={i18n.t("connections.toolTips.connected.title")}>
						<Wifi size={18} className="text-emerald-600" />
					</CustomToolTip>
				)}
				{(whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING") && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.timeout.title")}
						content={i18n.t("connections.toolTips.timeout.content")}
					>
						<Unplug size={18} className="text-orange-500" />
					</CustomToolTip>
				)}
			</div>
		);
	};

	const renderStatusBadge = status => {
		const badgeClass = STATUS_BADGE_CLASS[status] || "bg-gray-100 text-gray-700";
		return <span className={`badge ${badgeClass}`}>{status || "-"}</span>;
	};

	return (
		<MainContainer>
				<ConfirmationModal
					title={confirmModalInfo.title}
					open={confirmModalOpen}
					onClose={setConfirmModalOpen}
					onConfirm={handleSubmitConfirmationModal}
				>
					{confirmModalInfo.message}
				</ConfirmationModal>
				<QrcodeModal
					open={qrModalOpen}
					onClose={handleCloseQrModal}
					whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
				/>
				<WhatsAppModal
					open={whatsAppModalOpen}
					onClose={handleCloseWhatsAppModal}
					whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
				/>

				<div className="ds-card mb-4">
					<MainHeader>
						<div>
							<h1 className="page-title">{i18n.t("connections.title")}</h1>
							<p className="mt-1 text-sm text-gray-500">
								Gerencie conexões, sessões e QR Code das contas WhatsApp.
							</p>
						</div>

						<MainHeaderButtonsWrapper>
							<Can
								role={user.profile}
								perform="connections-page:addConnection"
								yes={() => (
									<div className="flex flex-wrap items-center justify-end gap-2">
										<button
											type="button"
											className="btn-primary inline-flex items-center gap-2"
											onClick={handleOpenWhatsAppModal}
										>
											<Plus size={16} />
											{i18n.t("connections.buttons.add")}
										</button>
										<button
											type="button"
											className="btn-accent inline-flex items-center gap-2"
											onClick={restartWhatsapps}
										>
											<RefreshCcw size={16} />
											{i18n.t("REINICIAR CONEXÕES")}
										</button>
									</div>
								)}
							/>
						</MainHeaderButtonsWrapper>
					</MainHeader>
				</div>

				<Paper className={classes.mainPaper} variant="outlined">
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell align="center" className={classes.tableHeadCell}>
									{i18n.t("connections.table.name")}
								</TableCell>
								<TableCell align="center" className={classes.tableHeadCell}>
									{i18n.t("connections.table.number")}
								</TableCell>
								<TableCell align="center" className={classes.tableHeadCell}>
									{i18n.t("connections.table.status")}
								</TableCell>
								<Can
									role={user.profile}
									perform="connections-page:actionButtons"
									yes={() => (
										<TableCell align="center" className={classes.tableHeadCell}>
											{i18n.t("connections.table.session")}
										</TableCell>
									)}
								/>
								<TableCell align="center" className={classes.tableHeadCell}>
									{i18n.t("connections.table.lastUpdate")}
								</TableCell>
								<TableCell align="center" className={classes.tableHeadCell}>
									{i18n.t("connections.table.default")}
								</TableCell>
								<Can
									role={user.profile}
									perform="connections-page:editOrDeleteConnection"
									yes={() => (
										<TableCell align="center" className={classes.tableHeadCell}>
											{i18n.t("connections.table.actions")}
										</TableCell>
									)}
								/>
							</TableRow>
						</TableHead>

						<TableBody>
							{loading ? (
								<TableRowSkeleton />
							) : (
								<>
									{whatsApps?.length > 0 &&
										whatsApps.map(whatsApp => (
											<TableRow key={whatsApp.id} className={classes.rowHover}>
												<TableCell align="center" className={classes.tableBodyCell}>
													<span className="font-semibold text-slate-800">{whatsApp.name}</span>
												</TableCell>
												<TableCell align="center" className={classes.tableBodyCell}>
													{whatsApp.number ? formatSerializedId(whatsApp.number) : "-"}
												</TableCell>
												<TableCell align="center" className={classes.tableBodyCell}>
													<div className={classes.customTableCell}>
														{renderStatusToolTips(whatsApp)}
														{renderStatusBadge(whatsApp.status)}
													</div>
												</TableCell>
												<Can
													role={user.profile}
													perform="connections-page:actionButtons"
													yes={() => (
														<TableCell align="center" className={classes.tableBodyCell}>
															{renderActionButtons(whatsApp)}
														</TableCell>
													)}
												/>
												<TableCell align="center" className={classes.tableBodyCell}>
													{format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")}
												</TableCell>
												<TableCell align="center" className={classes.tableBodyCell}>
													{whatsApp.isDefault && (
														<div className={classes.customTableCell}>
															<CheckCircle2 size={18} className="text-emerald-600" />
														</div>
													)}
												</TableCell>
												<Can
													role={user.profile}
													perform="connections-page:editOrDeleteConnection"
													yes={() => (
														<TableCell align="center" className={classes.tableBodyCell}>
															<div className={classes.actionsStack}>
																<IconButton
																	size="small"
																	className={classes.iconButton}
																	onClick={() => handleEditWhatsApp(whatsApp)}
																>
																	<Pencil size={16} />
																</IconButton>

																<IconButton
																	size="small"
																	className={classes.iconButton}
																	onClick={() => {
																		handleOpenConfirmationModal("delete", whatsApp.id);
																	}}
																>
																	<Trash2 size={16} className="text-red-600" />
																</IconButton>
															</div>
														</TableCell>
													)}
												/>
											</TableRow>
										))}
								</>
							)}
						</TableBody>
					</Table>
				</Paper>
		</MainContainer>
	);
};

export default Connections;
