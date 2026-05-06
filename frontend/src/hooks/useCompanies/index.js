import api from "../../services/api";

const useCompanies = () => {

    const save = async (data) => {
        const { data: responseData } = await api.request({
            url: '/companies',
            method: 'POST',
            data
        });
        return responseData;
    }

    const findAll = async (id) => {
        const { data } = await api.request({
            url: `/companies`,
            method: 'GET'
        });
        return data;
    }

    const list = async (id) => {
        const { data } = await api.request({
            url: `/companies/list`,
            method: 'GET'
        });
        return data;
    }

    const find = async (id) => {
        const { data } = await api.request({
            url: `/companies/${id}`,
            method: 'GET'
        });
        return data;
    }

    const finding = async (id) => {
        const { data } = await api.request({
            url: `/companies/${id}`,
            method: 'GET'
        });
        return data;
    }


    const update = async (data) => {
        const { data: responseData } = await api.request({
            url: `/companies/${data.id}`,
            method: 'PUT',
            data
        });
        return responseData;
    }

    const remove = async (id) => {
        const { data } = await api.request({
            url: `/companies/${id}`,
            method: 'DELETE'
        });
        return data;
    }

    const updateSchedules = async (data) => {
        const { data: responseData } = await api.request({
            url: `/companies/${data.id}/schedules`,
            method: 'PUT',
            data
        });
        return responseData;
    }

    const updateServices = async (id, companyServices, options = {}) => {
        const {
            allowLegacyFallback = false,
            fallbackPayload = null
        } = options || {};

        try {
            const { data: responseData } = await api.request({
                url: `/companies/${id}/services`,
                method: 'PUT',
                data: { companyServices }
            });
            return responseData;
        } catch (error) {
            const statusCode = error?.response?.status;

            if (statusCode === 404 && allowLegacyFallback && fallbackPayload) {
                const { data: responseData } = await api.request({
                    url: `/companies/${id}`,
                    method: 'PUT',
                    data: {
                        ...fallbackPayload,
                        companyServices
                    }
                });
                return responseData;
            }

            throw error;
        }
    }

    const previewServiceSlots = async (companyId, serviceId, params = {}) => {
        const { data } = await api.request({
            url: `/companies/${companyId}/services/${serviceId}/slots-preview`,
            method: "GET",
            params
        });
        return data;
    }

    return {
        save,
        update,
        remove,
        list,
        find,
        finding,
        findAll,
        updateSchedules,
        updateServices,
        previewServiceSlots
    }
}

export default useCompanies;
