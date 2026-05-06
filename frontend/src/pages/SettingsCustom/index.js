import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { makeStyles, Paper, Tab, Tabs } from "@material-ui/core";
import { toast } from "react-toastify";
import { Settings2 } from "lucide-react";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import TabPanel from "../../components/TabPanel";
import SchedulesForm from "../../components/SchedulesForm";
import CompaniesManager from "../../components/CompaniesManager";
import CompanyServicesManager from "../../components/CompanyServicesManager";
import BookingPaymentSettingsManager from "../../components/BookingPaymentSettingsManager";
import ServiceBookingsManager from "../../components/ServiceBookingsManager";
import PlansManager from "../../components/PlansManager";
import HelpsManager from "../../components/HelpsManager";
import Options from "../../components/Settings/Options";
import Uploader from "../../components/Settings/Uploader";
import AppearancePanel from "../../components/Settings/AppearancePanel";
import NewCompaniesManager from "../../pages/Companies";
import OnlyForSuperUser from "../../components/OnlyForSuperUser";

import { i18n } from "../../translate/i18n.js";
import useCompanies from "../../hooks/useCompanies";
import usePlans from "../../hooks/usePlans";
import useAuth from "../../hooks/useAuth.js";
import useSettings from "../../hooks/useSettings";

const useStyles = makeStyles((theme) => ({
    root: {
        flex: 1,
    },
    layoutWrapper: {
        width: "100%",
        padding: "24px 16px",
        [theme.breakpoints.up("sm")]: {
            padding: "32px 24px",
        },
        [theme.breakpoints.up("lg")]: {
            padding: "32px",
        },
    },
    headerCard: {
        borderRadius: 16,
        border: "1px solid #f3f4f6",
        background: "#ffffff",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
        padding: theme.spacing(2.5),
        marginBottom: theme.spacing(2),
    },
    mainPaper: {
        ...theme.scrollbarStyles,
        overflowY: "auto",
        flex: 1,
        borderRadius: 16,
        border: "1px solid #f3f4f6",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
        background: "#ffffff",
    },
    tabsShell: {
        padding: theme.spacing(1.5),
        borderBottom: "1px solid #f1f5f9",
        background: "#f8fafc",
    },
    tab: {
        backgroundColor: "#ffffff",
        borderRadius: 12,
        padding: theme.spacing(0.5),
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
    },
    tabItem: {
        textTransform: "none",
        fontWeight: 600,
        fontSize: "0.875rem",
        minHeight: 42,
        borderRadius: 10,
        paddingLeft: theme.spacing(1.5),
        paddingRight: theme.spacing(1.5),
    },
    contentArea: {
        ...theme.scrollbarStyles,
        overflowY: "auto",
        padding: theme.spacing(2),
        width: "100%",
    },
    container: {
        width: "100%",
        maxHeight: "100%",
    },
    titleWrap: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1.25),
    },
    titleIconBadge: {
        width: 34,
        height: 34,
        borderRadius: 10,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ecfeff",
        color: "#0e7490",
        border: "1px solid #a5f3fc",
    },
    titleText: {
        color: "#111827",
        fontSize: "1.125rem",
        fontWeight: 700,
        lineHeight: 1.3,
    },
    subtitleText: {
        marginTop: 4,
        color: "#6b7280",
        fontSize: "0.875rem",
        lineHeight: 1.4,
    },
}));

const SettingsCustom = () => {
    const classes = useStyles();
    const location = useLocation();
    const initialTabFromQuery = new URLSearchParams(location.search).get("tab");

    const [tab, setTab] = useState(initialTabFromQuery || "options");
    const [schedules, setSchedules] = useState([]);
    const [company, setCompany] = useState({});
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState({});
    const [settings, setSettings] = useState({});
    const [schedulesEnabled, setSchedulesEnabled] = useState(false);
    const [companyFeatures, setCompanyFeatures] = useState({
        servicesEnabled: true,
        schedulingEnabled: true,
    });

    const { getCurrentUserInfo, user: authUser } = useAuth();
    const { find, updateSchedules } = useCompanies();
    const { getPlanCompany } = usePlans();
    const { getAll: getAllSettings } = useSettings();

    const parseSettingFlag = (settingsList, key, fallbackValue) => {
        const normalizedSettings = Array.isArray(settingsList) ? settingsList : [];
        const setting = normalizedSettings
            .filter((item) => String(item?.key || "").trim() === String(key || "").trim())
            .sort((a, b) => {
                const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
                const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
                return bTime - aTime;
            })[0];

        if (!setting) {
            return fallbackValue;
        }

        const normalizedValue = String(setting.value || "")
            .trim()
            .toLowerCase();

        if (["true", "enabled", "1", "yes", "sim"].includes(normalizedValue)) {
            return true;
        }

        if (["false", "disabled", "0", "no", "nao", "não"].includes(normalizedValue)) {
            return false;
        }

        return fallbackValue;
    };

    const canAccessServicesTab = companyFeatures.servicesEnabled && companyFeatures.schedulingEnabled;

    useEffect(() => {
        if (initialTabFromQuery) {
            setTab(initialTabFromQuery);
        }
    }, [initialTabFromQuery]);

    useEffect(() => {
        async function findData() {
            setLoading(true);
            try {
                const companyId = localStorage.getItem("companyId");
                const companyData = await find(companyId);
                const companyPlan = await getPlanCompany(undefined, companyId);
                const settingList = await getAllSettings();
                const user = await getCurrentUserInfo();

                setCompany(companyData);
                setSchedules(companyData.schedules || []);
                setSettings(settingList || []);
                setCurrentUser(user || authUser || {});

                if (Array.isArray(settingList)) {
                    const scheduleType = settingList.find((d) => d.key === "scheduleType");
                    setSchedulesEnabled(scheduleType?.value === "company");
                }

                const schedulingByPlan = companyPlan?.plan?.useSchedules === false ? false : true;
                const servicesEnabled = parseSettingFlag(settingList, "servicesEnabled", true);
                const schedulingEnabled = parseSettingFlag(settingList, "schedulingEnabled", schedulingByPlan);

                setCompanyFeatures({
                    servicesEnabled,
                    schedulingEnabled,
                });
            } catch (error) {
                toast.error(error);
            } finally {
                setLoading(false);
            }
        }

        findData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (authUser?.id && !currentUser?.id) {
            setCurrentUser(authUser);
        }
    }, [authUser, currentUser]);

    useEffect(() => {
        if (tab === "services" && !canAccessServicesTab) {
            setTab("options");
        }

        if (tab === "bookings" && !companyFeatures.schedulingEnabled) {
            setTab("options");
        }
    }, [tab, companyFeatures, canAccessServicesTab]);

    const handleTabChange = (event, newValue) => {
        setTab(newValue);
    };

    const handleSubmitSchedules = async (data) => {
        setLoading(true);
        try {
            setSchedules(data);
            await updateSchedules({ id: company.id, schedules: data });
            toast.success("Horários atualizados com sucesso.");
        } catch (error) {
            toast.error(error);
        } finally {
            setLoading(false);
        }
    };

    const isSuper = () => currentUser.super;
    const isAdmin = () => currentUser?.profile === "admin" || currentUser?.super;

    return (
        <MainContainer className={classes.root} maxWidth={false}>
            <div className={classes.layoutWrapper}>
                <div className={classes.headerCard}>
                    <MainHeader>
                        <div className={classes.titleWrap}>
                            <span className={classes.titleIconBadge}>
                                <Settings2 size={18} />
                            </span>
                            <div>
                                <div className={classes.titleText}>{i18n.t("settings.title")}</div>
                                <div className={classes.subtitleText}>
                                    Personalize opções, aparência e recursos da plataforma.
                                </div>
                            </div>
                        </div>
                    </MainHeader>
                </div>

                <Paper className={classes.mainPaper} elevation={0}>
                    <div className={classes.tabsShell}>
                        <Tabs
                            value={tab}
                            indicatorColor="primary"
                            textColor="primary"
                            scrollButtons="on"
                            variant="scrollable"
                            onChange={handleTabChange}
                            className={classes.tab}
                        >
                            <Tab className={classes.tabItem} label="Opções" value={"options"} />
                            {isAdmin() ? (
                                <Tab className={classes.tabItem} label="Aparência" value={"appearance"} />
                            ) : null}

                            {schedulesEnabled ? (
                                <Tab className={classes.tabItem} label="Horários" value={"schedules"} />
                            ) : null}
                            {isSuper() ? <Tab className={classes.tabItem} label="Logo" value={"uploader"} /> : null}
                            {isSuper() ? (
                                <Tab className={classes.tabItem} label="Empresas" value={"companies"} />
                            ) : null}
                            {isSuper() ? (
                                <Tab className={classes.tabItem} label="Cadastrar Empresa" value={"newcompanie"} />
                            ) : null}
                            {isSuper() ? <Tab className={classes.tabItem} label="Planos" value={"plans"} /> : null}
                            {isSuper() ? <Tab className={classes.tabItem} label="Ajuda" value={"helps"} /> : null}
                        </Tabs>
                    </div>

                    <div className={classes.contentArea}>
                        <TabPanel className={classes.container} value={tab} name={"schedules"}>
                            <SchedulesForm
                                loading={loading}
                                onSubmit={handleSubmitSchedules}
                                initialValues={schedules}
                            />
                        </TabPanel>

                        <OnlyForSuperUser
                            user={currentUser}
                            yes={() => (
                                <TabPanel className={classes.container} value={tab} name={"companies"}>
                                    <CompaniesManager />
                                </TabPanel>
                            )}
                        />

                        <OnlyForSuperUser
                            user={currentUser}
                            yes={() => (
                                <TabPanel className={classes.container} value={tab} name={"newcompanie"}>
                                    <NewCompaniesManager />
                                </TabPanel>
                            )}
                        />

                        <OnlyForSuperUser
                            user={currentUser}
                            yes={() => (
                                <TabPanel className={classes.container} value={tab} name={"plans"}>
                                    <PlansManager />
                                </TabPanel>
                            )}
                        />

                        <OnlyForSuperUser
                            user={currentUser}
                            yes={() => (
                                <TabPanel className={classes.container} value={tab} name={"helps"}>
                                    <HelpsManager />
                                </TabPanel>
                            )}
                        />

                        <OnlyForSuperUser
                            user={currentUser}
                            yes={() => (
                                <TabPanel className={classes.container} value={tab} name={"uploader"}>
                                    <Uploader />
                                </TabPanel>
                            )}
                        />

                        <TabPanel className={classes.container} value={tab} name={"options"}>
                            <Options
                                settings={settings}
                                scheduleTypeChanged={(value) => setSchedulesEnabled(value === "company")}
                            />
                        </TabPanel>

                        {isAdmin() ? (
                            <TabPanel className={classes.container} value={tab} name={"appearance"}>
                                <AppearancePanel />
                            </TabPanel>
                        ) : null}

                        {isAdmin() && canAccessServicesTab ? (
                            <TabPanel className={classes.container} value={tab} name={"services"}>
                                <BookingPaymentSettingsManager />
                                <CompanyServicesManager companyId={company?.id || localStorage.getItem("companyId")} />
                            </TabPanel>
                        ) : null}

                        {isAdmin() && companyFeatures.schedulingEnabled ? (
                            <TabPanel className={classes.container} value={tab} name={"bookings"}>
                                <ServiceBookingsManager />
                            </TabPanel>
                        ) : null}
                    </div>
                </Paper>
            </div>
        </MainContainer>
    );
};

export default SettingsCustom;
