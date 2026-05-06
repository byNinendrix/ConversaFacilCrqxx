import { useState, useEffect, useReducer, useContext } from "react";
import toastError from "../../errors/toastError";

import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_WHATSAPPS") {
    const whatsApps = action.payload;

    return [...whatsApps];
  }

  if (action.type === "UPDATE_WHATSAPPS") {
    const whatsApp = action.payload;
    const whatsAppIndex = state.findIndex((s) => Number(s.id) === Number(whatsApp.id));

    if (whatsAppIndex !== -1) {
      state[whatsAppIndex] = whatsApp;
      return [...state];
    } else {
      return [whatsApp, ...state];
    }
  }

  if (action.type === "UPDATE_SESSION") {
    const whatsApp = action.payload;
    const whatsAppIndex = state.findIndex((s) => Number(s.id) === Number(whatsApp.id));

    if (whatsAppIndex !== -1) {
      state[whatsAppIndex].status = whatsApp.status;
      state[whatsAppIndex].updatedAt = whatsApp.updatedAt;
      state[whatsAppIndex].qrcode = whatsApp.qrcode;
      state[whatsAppIndex].retries = whatsApp.retries;
      return [...state];
    } else {
      return [...state];
    }
  }

  if (action.type === "DELETE_WHATSAPPS") {
    const whatsAppId = action.payload;

    const whatsAppIndex = state.findIndex((s) => Number(s.id) === Number(whatsAppId));
    if (whatsAppIndex !== -1) {
      state.splice(whatsAppIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useWhatsApps = () => {
  const [whatsApps, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(true);

  const socketManager = useContext(SocketContext);
  const { isAuth, loading: authLoading } = useContext(AuthContext);

  useEffect(() => {
    let isMounted = true;
    let retryTimeout;

    if (authLoading) {
      return () => {
        isMounted = false;
      };
    }

    if (!isAuth) {
      dispatch({ type: "RESET" });
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setLoading(true);
    const fetchSession = async (attempt = 0) => {
      try {
        const { data } = await api.get("/whatsapp/?session=0");
        if (!isMounted) return;
        dispatch({ type: "LOAD_WHATSAPPS", payload: data });
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        const status = err?.response?.status;
        if ((status === 401 || status === 403) && attempt < 2) {
          retryTimeout = setTimeout(() => fetchSession(attempt + 1), 500);
          return;
        }
        setLoading(false);
        toastError(err);
      }
    };
    fetchSession();
    return () => {
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [authLoading, isAuth]);

  useEffect(() => {
    if (authLoading || !isAuth) return;

    const companyId = localStorage.getItem("companyId");
    if (!companyId) return;
    const socket = socketManager.getSocket(companyId);

    socket.on(`company-${companyId}-whatsapp`, (data) => {
      if (data.action === "update") {
        dispatch({ type: "UPDATE_WHATSAPPS", payload: data.whatsapp });
      }
    });

    socket.on(`company-${companyId}-whatsapp`, (data) => {
      if (data.action === "delete") {
        dispatch({ type: "DELETE_WHATSAPPS", payload: data.whatsappId });
      }
    });

    socket.on(`company-${companyId}-whatsappSession`, (data) => {
      if (data.action === "update") {
        dispatch({ type: "UPDATE_SESSION", payload: data.session });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [socketManager, authLoading, isAuth]);

  return { whatsApps, loading };
};

export default useWhatsApps;
