import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import Chip from "@material-ui/core/Chip";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	root: {
		marginTop: theme.spacing(0.75),
	},
	formControl: {
		"& .MuiFormLabel-root": {
			fontSize: "0.75rem",
			fontWeight: 700,
			textTransform: "uppercase",
			letterSpacing: "0.04em",
			color: "#4b5563",
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
			padding: "10px 12px",
		},
	},
	chips: {
		display: "flex",
		flexWrap: "wrap",
		gap: theme.spacing(0.5),
	},
	chip: {
		margin: 0,
		borderRadius: 999,
		borderColor: "transparent",
		color: "#ffffff",
		fontWeight: 600,
	},
}));

const QueueSelect = ({
	selectedQueueIds,
	onChange,
	multiple = true,
	title = i18n.t("queueSelect.inputLabel"),
	disabled = false
}) => {
	const classes = useStyles();
	const [queues, setQueues] = useState([]);

	useEffect(() => {

		fetchQueues();

	}, []);

	const fetchQueues = async () => {
		try {
			const { data } = await api.get("/queue");
			setQueues(data);
		} catch (err) {
			toastError(err);
		}
	}

	const handleChange = e => {
		onChange(e.target.value);
	};

	return (
		<div className={classes.root}>
			<FormControl fullWidth margin="dense" variant="outlined" className={classes.formControl}>
				<InputLabel shrink={selectedQueueIds ? true : false} >{title}</InputLabel>
				<Select
					label={title}
					multiple={multiple}
					labelWidth={60}
					value={selectedQueueIds}
					disabled={disabled}
					onChange={handleChange}
					MenuProps={{
						anchorOrigin: {
							vertical: "bottom",
							horizontal: "left",
						},
						transformOrigin: {
							vertical: "top",
							horizontal: "left",
						},
						getContentAnchorEl: null,
					}}

					renderValue={selected => {
						return (
							<div className={classes.chips}>
								{selected?.length > 0 && multiple ? (
									selected.map(id => {
										const queue = queues.find(q => q.id === id);
										return queue ? (
											<Chip
												key={id}
												style={{ backgroundColor: queue.color }}
												variant="outlined"
												label={queue.name}
												className={classes.chip}
											/>
										) : null;
									})

								) :
									(
										<Chip
											key={selected}
											variant="outlined"
											style={{ backgroundColor: queues.find(q => q.id === selected)?.color }}
											label={queues.find(q => q.id === selected)?.name}
											className={classes.chip}
										/>
									)
								}

							</div>
						)
					}}
				>
					{!multiple && <MenuItem value={null}>Nenhum</MenuItem>}
					{queues.map(queue => (
						<MenuItem key={queue.id} value={queue.id}>
							{queue.name}
						</MenuItem>
					))}
				</Select>
			</FormControl>
		</div>
	);
};

export default QueueSelect;
