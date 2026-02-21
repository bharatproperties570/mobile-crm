import api from "./api";

export interface Booking {
    _id: string;
    applicationNo?: string;
    bookingDate: string;
    status: 'Pending' | 'Booked' | 'Agreement' | 'Registry' | 'Cancelled';
    lead?: string | { _id: string; name: string };
    deal?: string | { _id: string; name: string };
    inventory?: string | { _id: string; unitNo: string; projectName: string };
    totalDealAmount?: number;
    tokenAmount?: number;
    remarks?: string;
    createdAt?: string;
}

export const getBookings = async (params?: any) => {
    const res = await api.get("/bookings", { params });
    return res.data;
};

export const getBookingById = async (id: string) => {
    const res = await api.get(`/bookings/${id}`);
    return res.data;
};

export const addBooking = async (data: Partial<Booking>) => {
    const res = await api.post("/bookings", data);
    return res.data;
};

export const updateBooking = async (id: string, data: Partial<Booking>) => {
    const res = await api.put(`/bookings/${id}`, data);
    return res.data;
};

export const deleteBooking = async (id: string) => {
    const res = await api.delete(`/bookings/${id}`);
    return res.data;
};
