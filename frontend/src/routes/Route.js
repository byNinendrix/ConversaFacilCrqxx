import React, { useContext, useEffect, useState } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";

import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";

const Route = ({ component: Component, isPrivate = false, ...rest }) => {
	const { isAuth, loading } = useContext(AuthContext);
	const [allowBlockingLoader, setAllowBlockingLoader] = useState(true);

	useEffect(() => {
		if (!loading) {
			setAllowBlockingLoader(false);
			return;
		}

		const timeout = setTimeout(() => {
			setAllowBlockingLoader(false);
		}, 6000);

		return () => clearTimeout(timeout);
	}, [loading]);

	const showBlockingLoader = loading && allowBlockingLoader;

	if (!isAuth && isPrivate) {
		return (
			<>
				{showBlockingLoader && <BackdropLoading />}
				<Redirect to={{ pathname: "/login", state: { from: rest.location } }} />
			</>
		);
	}

	if (isAuth && !isPrivate) {
		return (
			<>
				{showBlockingLoader && <BackdropLoading />}
				<Redirect to={{ pathname: "/", state: { from: rest.location } }} />
			</>
		);
	}

	return (
		<>
			{showBlockingLoader && <BackdropLoading />}
			<RouterRoute {...rest} component={Component} />
		</>
	);
};

export default Route;
