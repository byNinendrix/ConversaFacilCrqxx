import { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import { has, isArray } from "lodash";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import moment from "moment";

const AUTH_BOOT_TIMEOUT_MS = 12000;
const AUTH_REQUEST_TIMEOUT_MS = 10000;
const AUTH_STATE_CHANGED_EVENT = "auth-state-changed";

const getStoredToken = () => {
  const tokenRaw = localStorage.getItem("token");
  if (!tokenRaw) return null;

  try {
    return JSON.parse(tokenRaw);
  } catch (_err) {
    localStorage.removeItem("token");
    return null;
  }
};

const emitAuthStateChanged = () => {
  window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
};

const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(() => Boolean(getStoredToken()));
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});

  const initialToken = getStoredToken();
  if (initialToken && !api.defaults.headers.Authorization) {
    api.defaults.headers.Authorization = `Bearer ${initialToken}`;
  }

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    const requestInterceptorId = api.interceptors.request.use(
      (config) => {
        const token = getStoredToken();
        if (token) {
          config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptorId = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error?.config;
        const isRefreshRequest = String(originalRequest?.url || "").includes("/auth/refresh_token");

        if (error?.response?.status === 403 && originalRequest && !originalRequest._retry && !isRefreshRequest) {
          originalRequest._retry = true;

          try {
            const { data } = await api.post("/auth/refresh_token", {}, { timeout: AUTH_REQUEST_TIMEOUT_MS });
            if (data?.token) {
              localStorage.setItem("token", JSON.stringify(data.token));
              api.defaults.headers.Authorization = `Bearer ${data.token}`;
              emitAuthStateChanged();
            }
            return api(originalRequest);
          } catch (err) {
            localStorage.removeItem("token");
            localStorage.removeItem("companyId");
            api.defaults.headers.Authorization = undefined;
            emitAuthStateChanged();
            setIsAuth(false);
            setUser({});
            return Promise.reject(err);
          }
        }

        if (error?.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("companyId");
          api.defaults.headers.Authorization = undefined;
          emitAuthStateChanged();
          setIsAuth(false);
          setUser({});
        }

        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(requestInterceptorId);
      api.interceptors.response.eject(responseInterceptorId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadingGuard = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, AUTH_BOOT_TIMEOUT_MS);

    const token = getStoredToken();
    (async () => {
      if (!token) {
        if (isMounted) {
          setLoading(false);
        }
        clearTimeout(loadingGuard);
        return;
      }

      try {
        const { data } = await api.post("/auth/refresh_token", {}, { timeout: AUTH_REQUEST_TIMEOUT_MS });
        if (!isMounted) return;
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        setIsAuth(true);
        setUser(data.user);
      } catch (err) {
        if (!isMounted) return;
        localStorage.removeItem("token");
        localStorage.removeItem("companyId");
        localStorage.removeItem("userId");
        api.defaults.headers.Authorization = undefined;
        emitAuthStateChanged();
        setIsAuth(false);
        setUser({});
      }

      if (isMounted) {
        setLoading(false);
      }
      clearTimeout(loadingGuard);
    })();

    return () => {
      isMounted = false;
      clearTimeout(loadingGuard);
    };
  }, []);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (companyId) {
   
      const socket = socketManager.getSocket(companyId);

      socket.on(`company-${companyId}-user`, (data) => {
        if (data.action === "update" && data.user.id === user.id) {
          setUser(data.user);
        }
      });
    
    
    return () => {
      socket.disconnect();
    };
  }
  }, [socketManager, user]);

  const handleLogin = async (userData) => {
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", userData);
      const {
        user: { companyId, id, company },
      } = data;

      if (has(company, "settings") && isArray(company.settings)) {
        const setting = company.settings.find(
          (s) => s.key === "campaignsEnabled"
        );
        if (setting && setting.value === "true") {
          localStorage.setItem("cshow", null); //regra pra exibir campanhas
        }
      }

      moment.locale('pt-br');
      const dueDate = data.user.company.dueDate;
      const hoje = moment(moment()).format("DD/MM/yyyy");
      const vencimento = moment(dueDate).format("DD/MM/yyyy");

      var diff = moment(dueDate).diff(moment(moment()).format());

      var before = moment(moment().format()).isBefore(dueDate);
      var dias = moment.duration(diff).asDays();

      if (before === true) {
        localStorage.setItem("token", JSON.stringify(data.token));
        localStorage.setItem("companyId", companyId);
        localStorage.setItem("userId", id);
        localStorage.setItem("companyDueDate", vencimento);
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        emitAuthStateChanged();
        setUser(data.user);
        setIsAuth(true);
        toast.success(i18n.t("auth.toasts.success"));
        if (Math.round(dias) < 5) {
          toast.warn(`Sua assinatura vence em ${Math.round(dias)} ${Math.round(dias) === 1 ? 'dia' : 'dias'} `);
        }
        history.push("/tickets");
        setLoading(false);
      } else {
        toastError(`Opss! Sua assinatura venceu ${vencimento}.
Entre em contato com o Suporte para mais informações! `);
        setLoading(false);
      }

      //quebra linha 
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);

    try {
      await api.delete("/auth/logout");
    } catch (err) {
      // ignore logout API errors
    }

    localStorage.removeItem("token");
    localStorage.removeItem("companyId");
    localStorage.removeItem("userId");
    localStorage.removeItem("cshow");
    api.defaults.headers.Authorization = undefined;
    emitAuthStateChanged();
    setIsAuth(false);
    setUser({});
    setLoading(false);
    history.push("/login");
  };

  const getCurrentUserInfo = async () => {
    try {
      const { data } = await api.get("/auth/me");
      return data;
    } catch (err) {
      toastError(err);
    }
  };

  return {
    isAuth,
    user,
    loading,
    handleLogin,
    handleLogout,
    getCurrentUserInfo,
  };
};

export default useAuth;
