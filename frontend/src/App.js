import React, { useEffect, useMemo, useState } from "react";

import "react-toastify/dist/ReactToastify.css";
import { QueryClient, QueryClientProvider } from "react-query";
import { ptBR } from "@material-ui/core/locale";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { useMediaQuery } from "@material-ui/core";
import ColorModeContext from "./layout/themeContext";
import { SocketContext, SocketManager } from "./context/Socket/SocketContext";
import { openApi } from "./services/api";
import {
  buildThemeConfig,
  DEFAULT_APPEARANCE_SETTINGS,
  normalizeAppearanceSettings
} from "./theme/appearance";

import Routes from "./routes";

const queryClient = new QueryClient();

const THEME_STORAGE_KEY = "preferredTheme";
const AUTH_STATE_CHANGED_EVENT = "auth-state-changed";

const getStoredToken = () => {
  const tokenRaw = localStorage.getItem("token");
  if (!tokenRaw) {
    return null;
  }

  try {
    return JSON.parse(tokenRaw);
  } catch (_err) {
    return null;
  }
};

const App = () => {
  const [locale, setLocale] = useState();
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");

  const [appearanceSettings, setAppearanceSettings] = useState(
    DEFAULT_APPEARANCE_SETTINGS
  );

  const [mode, setMode] = useState(() => {
    const preferredTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (preferredTheme === "light" || preferredTheme === "dark") {
      return preferredTheme;
    }

    return prefersDarkMode ? "dark" : DEFAULT_APPEARANCE_SETTINGS.defaultMode;
  });

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const nextMode = prevMode === "light" ? "dark" : "light";
          window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
          return nextMode;
        });
      },
      setColorMode: (nextMode, options = {}) => {
        const safeMode = nextMode === "dark" ? "dark" : "light";
        const shouldPersistOverride = options.persistOverride !== false;

        if (shouldPersistOverride) {
          window.localStorage.setItem(THEME_STORAGE_KEY, safeMode);
        } else {
          window.localStorage.removeItem(THEME_STORAGE_KEY);
        }

        setMode(safeMode);
      },
      clearColorModeOverride: () => {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
        setMode(appearanceSettings.defaultMode || (prefersDarkMode ? "dark" : "light"));
      }
    }),
    [appearanceSettings.defaultMode, prefersDarkMode]
  );

  const theme = useMemo(() => {
    const themeConfig = buildThemeConfig(mode, locale, appearanceSettings);
    return createTheme(themeConfig, locale);
  }, [appearanceSettings, locale, mode]);

  useEffect(() => {
    const i18nlocale = localStorage.getItem("i18nextLng");
    const fallbackLocale = navigator.language || "pt-BR";
    const normalizedLocale = (i18nlocale || fallbackLocale).replace("-", "");

    if (normalizedLocale.toLowerCase() === "ptbr") {
      setLocale(ptBR);
    }
  }, []);

  useEffect(() => {
    const preferredTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (preferredTheme === "light" || preferredTheme === "dark") {
      return;
    }

    setMode(appearanceSettings.defaultMode || (prefersDarkMode ? "dark" : "light"));
  }, [appearanceSettings.defaultMode, prefersDarkMode]);

  useEffect(() => {
    let isMounted = true;

    const loadAppearanceSettings = async () => {
      const token = getStoredToken();
      if (!token) {
        if (isMounted) {
          setAppearanceSettings(DEFAULT_APPEARANCE_SETTINGS);
        }
        return;
      }

      try {
        const { data } = await openApi.get("/settings/appearance", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (isMounted) {
          setAppearanceSettings(normalizeAppearanceSettings(data));
        }
      } catch (error) {
        // No-op: keeps defaults when user is unauthenticated or endpoint fails.
      }
    };

    const handleAppearanceUpdate = (event) => {
      if (event?.detail) {
        setAppearanceSettings(normalizeAppearanceSettings(event.detail));
      }
    };
    const handleAuthStateChanged = () => {
      loadAppearanceSettings();
    };
    const handleStorage = (event) => {
      if (event.key === "token") {
        loadAppearanceSettings();
      }
    };

    loadAppearanceSettings();
    window.addEventListener("appearance-settings-updated", handleAppearanceUpdate);
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);
    window.addEventListener("storage", handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener("appearance-settings-updated", handleAppearanceUpdate);
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <ColorModeContext.Provider value={{ colorMode }}>
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <SocketContext.Provider value={SocketManager}>
            <Routes />
          </SocketContext.Provider>
        </QueryClientProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};

export default App;
