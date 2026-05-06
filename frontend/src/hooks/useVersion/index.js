import api from "../../services/api";

const useVersion = () => {
  const getVersionInfo = async () => {
    const { data } = await api.request({
      url: "/version",
      method: "GET"
    });

    return {
      version: data?.version || "-",
      history: Array.isArray(data?.history) ? data.history : []
    };
  };

  const getVersion = async () => {
    const info = await getVersionInfo();
    return {
      version: info.version
    };
  };

  return {
    getVersion,
    getVersionInfo
  };
};

export default useVersion;



