import api from "../services/api";

const useAppearanceSettings = () => {
  const getAppearance = async () => {
    const { data } = await api.get("/settings/appearance");
    return data;
  };

  const updateAppearance = async (payload) => {
    const { data } = await api.put("/settings/appearance", payload);
    return data;
  };

  return {
    getAppearance,
    updateAppearance
  };
};

export default useAppearanceSettings;

