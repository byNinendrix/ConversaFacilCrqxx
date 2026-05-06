import api from "../../services/api";

const useServiceBookings = () => {
  const list = async params => {
    const { data } = await api.request({
      url: "/service-bookings",
      method: "GET",
      params
    });

    return data;
  };

  const cancel = async (bookingId, reason = "") => {
    const { data } = await api.request({
      url: `/service-bookings/${bookingId}/cancel`,
      method: "PATCH",
      data: { reason }
    });

    return data;
  };

  const listSlots = async (serviceId, params = {}) => {
    const { data } = await api.request({
      url: `/company-services/${serviceId}/slots`,
      method: "GET",
      params
    });

    return data;
  };

  const getPaymentSettings = async () => {
    const { data } = await api.request({
      url: "/service-bookings/payment-settings",
      method: "GET"
    });

    return data;
  };

  const updatePaymentSettings = async payload => {
    const { data } = await api.request({
      url: "/service-bookings/payment-settings",
      method: "PUT",
      data: payload
    });

    return data;
  };

  const confirmPayment = async (bookingId, payload = {}) => {
    const { data } = await api.request({
      url: `/service-bookings/${bookingId}/payment/confirm`,
      method: "POST",
      data: payload
    });

    return data;
  };

  const regeneratePixPayment = async (bookingId, payload = {}) => {
    const { data } = await api.request({
      url: `/service-bookings/${bookingId}/payment/regenerate-pix`,
      method: "POST",
      data: payload
    });

    return data;
  };

  return {
    list,
    cancel,
    listSlots,
    getPaymentSettings,
    updatePaymentSettings,
    confirmPayment,
    regeneratePixPayment
  };
};

export default useServiceBookings;
