import React from "react";

import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import { Checkbox, ListItemText } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(() => ({
	container: {
		width: "min(132px, 100%)",
		maxWidth: "100%",
		marginTop: 0,
	},
	formControl: {
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
		"& .MuiSelect-select": {
			fontSize: "0.875rem",
			fontWeight: 600,
			color: "#374151",
			padding: "8px 12px",
		},
	},
	menuItem: {
		fontSize: "0.875rem",
	},
	checkBox: {
		padding: 6,
	},
}));

const TicketsQueueSelect = ({
	userQueues,
	selectedQueueIds = [],
	onChange,
	style,
}) => {
	const classes = useStyles();

	const handleChange = e => {
		onChange(e.target.value);
	};

	return (
		<div className={classes.container} style={style}>
			<FormControl fullWidth margin="dense" size="small" className={classes.formControl}>
				<Select
					multiple
					displayEmpty
					variant="outlined"
					value={selectedQueueIds}
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
					renderValue={() => i18n.t("ticketsQueueSelect.placeholder")}
				>
					{userQueues?.length > 0 &&
						userQueues.map(queue => (
							<MenuItem dense key={queue.id} value={queue.id} className={classes.menuItem}>
								<Checkbox
									className={classes.checkBox}
									style={{
										color: queue.color,
									}}
									size="small"
									color="primary"
									checked={selectedQueueIds.indexOf(queue.id) > -1}
								/>
								<ListItemText primary={queue.name} />
							</MenuItem>
						))}
				</Select>
			</FormControl>
		</div>
	);
};

export default TicketsQueueSelect;
