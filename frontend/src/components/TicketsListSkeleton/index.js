import React from "react";

import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import Divider from "@material-ui/core/Divider";
import { makeStyles } from "@material-ui/core/styles";
import Skeleton from "@material-ui/lab/Skeleton";

const useStyles = makeStyles(() => ({
	listItem: {
		margin: "6px 8px",
		borderRadius: 12,
		border: "1px solid #e5e7eb",
		backgroundColor: "#ffffff",
		padding: "8px 10px",
	},
	avatar: {
		borderRadius: 12,
	},
	divider: {
		backgroundColor: "transparent",
	},
}));

const TicketsSkeleton = () => {
	const classes = useStyles();

	return (
		<>
			<ListItem dense className={classes.listItem}>
				<ListItemAvatar>
					<Skeleton animation="wave" variant="rect" width={44} height={44} className={classes.avatar} />
				</ListItemAvatar>
				<ListItemText
					primary={<Skeleton animation="wave" height={20} width={60} />}
					secondary={<Skeleton animation="wave" height={20} width={90} />}
				/>
			</ListItem>
			<Divider variant="inset" className={classes.divider} />
			<ListItem dense className={classes.listItem}>
				<ListItemAvatar>
					<Skeleton animation="wave" variant="rect" width={44} height={44} className={classes.avatar} />
				</ListItemAvatar>
				<ListItemText
					primary={<Skeleton animation="wave" height={20} width={70} />}
					secondary={<Skeleton animation="wave" height={20} width={120} />}
				/>
			</ListItem>
			<Divider variant="inset" className={classes.divider} />
			<ListItem dense className={classes.listItem}>
				<ListItemAvatar>
					<Skeleton animation="wave" variant="rect" width={44} height={44} className={classes.avatar} />
				</ListItemAvatar>
				<ListItemText
					primary={<Skeleton animation="wave" height={20} width={60} />}
					secondary={<Skeleton animation="wave" height={20} width={90} />}
				/>
			</ListItem>
			<Divider variant="inset" className={classes.divider} />
		</>
	);
};

export default TicketsSkeleton;
