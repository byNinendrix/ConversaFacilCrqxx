import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";

const useStyles = makeStyles(theme => ({
	mainContainer: {
		display: "flex",
		flexDirection: "column",
		flex: 1,
		minHeight: 0,
		minWidth: 0,
		width: "100%",
		padding: theme.spacing(2),
		boxSizing: "border-box",
	},

	contentWrapper: {
		display: "flex",
		flexDirection: "column",
		flex: 1,
		minHeight: 0,
		width: "100%",
		overflowY: "auto",
		overflowX: "hidden",
		...theme.scrollbarStyles,
	},
}));

const MainContainer = ({ children, className = "", ...rest }) => {
	const classes = useStyles();
	const mergedClassName = `${classes.mainContainer}${className ? ` ${className}` : ""}`;

	return (
		<Container className={mergedClassName} {...rest}>
			<div className={classes.contentWrapper}>{children}</div>
		</Container>
	);
};

export default MainContainer;
