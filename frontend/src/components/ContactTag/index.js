import { makeStyles } from "@material-ui/styles";
import React from "react";

const useStyles = makeStyles(theme => ({
    tag: {
        display: "inline-flex",
        alignItems: "center",
        maxWidth: "100%",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "0.64rem",
        lineHeight: 1.3,
        fontWeight: 700,
        color: "#FFF",
        border: "1px solid rgba(255,255,255,0.3)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        letterSpacing: "0.02em"
    }
}));

const ContactTag = ({ tag }) => {
    const classes = useStyles();

    return (
        <div className={classes.tag} style={{ backgroundColor: tag.color }} title={tag.name.toUpperCase()}>
            {tag.name.toUpperCase()}
        </div>
    )
}

export default ContactTag;
