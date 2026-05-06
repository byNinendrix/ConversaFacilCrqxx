import api from "../services/api";

const useFlows = () => {
  const listFlows = async (params = {}) => {
    const { data } = await api.get("/flows", { params });
    return data;
  };

  const createFlow = async (payload) => {
    const { data } = await api.post("/flows", payload);
    return data;
  };

  const showFlow = async (flowId) => {
    const { data } = await api.get(`/flows/${flowId}`);
    return data;
  };

  const listVersions = async (flowId) => {
    const { data } = await api.get(`/flows/${flowId}/versions`);
    return data;
  };

  const createVersion = async (flowId) => {
    const { data } = await api.post(`/flows/${flowId}/versions`);
    return data;
  };

  const saveGraph = async (flowId, versionId, payload) => {
    const { data } = await api.put(`/flows/${flowId}/versions/${versionId}/graph`, payload);
    return data;
  };

  const validateVersion = async (flowId, versionId) => {
    const { data } = await api.post(`/flows/${flowId}/versions/${versionId}/validate`);
    return data;
  };

  const publishVersion = async (flowId, versionId, activate = true) => {
    const { data } = await api.post(`/flows/${flowId}/versions/${versionId}/publish`, { activate });
    return data;
  };

  const activateFlow = async (flowId, versionId) => {
    const { data } = await api.post(`/flows/${flowId}/activate`, { versionId });
    return data;
  };

  const deactivateFlow = async (flowId) => {
    const { data } = await api.post(`/flows/${flowId}/deactivate`);
    return data;
  };

  const duplicateFlow = async (flowId) => {
    const { data } = await api.post(`/flows/${flowId}/duplicate`);
    return data;
  };

  const deleteFlow = async (flowId) => {
    const { data } = await api.delete(`/flows/${flowId}`);
    return data;
  };

  const uploadFlowMedia = async (flowId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post(`/flows/${flowId}/media-upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  };

  return {
    listFlows,
    createFlow,
    showFlow,
    listVersions,
    createVersion,
    saveGraph,
    validateVersion,
    publishVersion,
    activateFlow,
    deactivateFlow,
    duplicateFlow,
    deleteFlow,
    uploadFlowMedia
  };
};

export default useFlows;

