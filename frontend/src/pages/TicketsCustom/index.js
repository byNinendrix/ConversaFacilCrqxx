import React from "react";
import { useParams } from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";

import TicketsManager from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";

const useStyles = makeStyles((theme) => ({
  chatContainer: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    height: "100%",
    padding: theme.spacing(0),
    minHeight: 0,
    width: "100%",
    overflow: "hidden"
  },

  chatPapper: {
    display: "flex",
    flex: 1,
    height: "100%",
    minHeight: 0,
    width: "100%"
  },

  gridRoot: {
    flex: 1,
    height: "100%",
    minHeight: 0
  },

  contactsWrapper: {
    display: "flex",
    flex: 1,
    height: "100%",
    minHeight: 0,
    flexDirection: "column",
    overflow: "hidden"
  },

  messagesWrapper: {
    display: "flex",
    flex: 1,
    height: "100%",
    minHeight: 0,
    flexDirection: "column",
    overflow: "hidden"
  },

  welcomeMsg: {
    backgroundColor: theme.palette.boxticket,
    display: "flex",
    justifyContent: "space-evenly",
    alignItems: "center",
    height: "100%",
    textAlign: "center"
  }
}));

const logo = `${process.env.REACT_APP_BACKEND_URL}/public/logotipos/login.png`;
const randomValue = Math.random();
const logoWithRandom = `${logo}?r=${randomValue}`;

const TicketsCustom = () => {
  const classes = useStyles();
  const { ticketId } = useParams();

  return (
    <div className={classes.chatContainer}>
      <div className={classes.chatPapper}>
        <Grid container spacing={0} className={classes.gridRoot}>
          <Grid item xs={4} className={classes.contactsWrapper}>
            <TicketsManager />
          </Grid>
          <Grid item xs={8} className={classes.messagesWrapper}>
            {ticketId ? (
              <Ticket />
            ) : (
              <Paper square variant="outlined" className={classes.welcomeMsg}>
                <div>
                  <center>
                    <img
                      style={{ margin: "0 auto", width: "80%" }}
                      src={logoWithRandom}
                      alt={`${process.env.REACT_APP_NAME_SYSTEM}`}
                    />
                  </center>
                </div>
              </Paper>
            )}
          </Grid>
        </Grid>
      </div>
    </div>
  );
};

export default TicketsCustom;
