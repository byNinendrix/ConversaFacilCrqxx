import React, { useState, useContext, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import useVersion from "../../hooks/useVersion";

const Login = () => {
    const [user, setUser] = useState({ email: "", password: "" });
    const { handleLogin } = useContext(AuthContext);
    const [viewregister, setviewregister] = useState("disabled");
    const [version, setVersion] = useState("-");
    const { getVersionInfo } = useVersion();

    const handleChangeInput = (e) => {
        setUser({ ...user, [e.target.name]: e.target.value });
    };

    useEffect(() => {
        fetchviewregister();
        fetchVersionInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchviewregister = async () => {
        try {
            const responsev = await api.get("/settings/viewregister");
            const viewregisterX = responsev?.data?.value;
            setviewregister(viewregisterX);
        } catch (error) {
            console.error("Error retrieving viewregister", error);
        }
    };

    const fetchVersionInfo = async () => {
        try {
            const info = await getVersionInfo();
            setVersion(info.version || "-");
        } catch (error) {
            setVersion("-");
        }
    };

    const handlSubmit = (e) => {
        e.preventDefault();
        handleLogin(user);
    };

    const logo = `${process.env.REACT_APP_BACKEND_URL}/public/logotipos/login.png`;
    const randomValue = Math.random();
    const logoWithRandom = `${logo}?r=${randomValue}`;

    return (
        <div className="min-h-screen bg-[#eef2f7]">
            <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
                <div className="relative hidden items-center justify-center bg-gradient-to-br from-[#0c3547] via-[#155e75] to-[#0891b2] p-10 lg:flex">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(103,232,249,0.25),transparent_45%)]" />
                    <div className="relative w-[520px] h-[520px] max-w-full rounded-[32px] border border-white/20 bg-white/10 p-10 shadow-[0_40px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                        <img
                            className="mx-auto h-full max-h-full w-auto rounded-3xl object-contain"
                            src={logoWithRandom}
                            alt={`${process.env.REACT_APP_NAME_SYSTEM}`}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-center p-4 sm:p-8">
                    <div className="w-full max-w-md">
                        <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-3 lg:hidden">
                            <img
                                className="mx-auto w-full max-w-[220px] object-contain"
                                src={logoWithRandom}
                                alt={`${process.env.REACT_APP_NAME_SYSTEM}`}
                            />
                        </div>

                        <div className="form-card">
                            <div className="mb-5">
                                <div>
                                    <h1 className="page-title">Acesso ao sistema</h1>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Entre para continuar seus atendimentos.
                                    </p>
                                </div>
                            </div>

                            <form className="space-y-4" noValidate onSubmit={handlSubmit}>
                                <div>
                                    <label className="form-label" htmlFor="email">
                                        {i18n.t("login.form.email")}
                                    </label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        className="form-input"
                                        value={user.email}
                                        onChange={handleChangeInput}
                                        autoComplete="email"
                                        autoFocus
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="form-label" htmlFor="password">
                                        {i18n.t("login.form.password")}
                                    </label>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        className="form-input"
                                        value={user.password}
                                        onChange={handleChangeInput}
                                        autoComplete="current-password"
                                        required
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <RouterLink
                                        className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                                        to="/forgetpsw"
                                    >
                                        Esqueceu sua senha?
                                    </RouterLink>
                                </div>

                                <button type="submit" className="btn-primary w-full">
                                    {i18n.t("login.buttons.submit")}
                                </button>

                                {viewregister === "enabled" && (
                                    <div className="text-center">
                                        <RouterLink
                                            className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                                            to="/signup"
                                        >
                                            {i18n.t("login.buttons.register")}
                                        </RouterLink>
                                    </div>
                                )}

                                <div className="mt-6 flex justify-end">
                                    <span className="badge bg-brand-100 text-brand-700">v{version}</span>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
