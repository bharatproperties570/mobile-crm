import api from "./api";

export interface Booking {
    _id: string;
    type?: 'Sale' | 'Rent' | 'Lease';
    applicationNo?: string;
    bookingDate: string;
    status: 'Pending' | 'Booked' | 'Agreement' | 'Registry' | 'Cancelled';
    lead?: string | any;
    deal?: string | any;
    project?: string | any;
    property?: string | any; // Inventory reference
    unitNumber?: string;
    
    // Financials
    totalDealAmount?: number;
    tokenAmount?: number;
    agreementAmount?: number;
    agreementDate?: string;
    isPartPaymentEnabled?: boolean;
    partPayments?: Array<{ amount: string; date: string }>;
    finalPaymentDate?: string;
    
    // Stakeholders
    salesAgent?: string | any;
    executiveIncentivePercent?: number;
    executiveIncentiveAmount?: number;
    isChannelPartnerEnabled?: boolean;
    channelPartner?: string | any;
    partnerSide?: 'Buyer Side' | 'Seller Side';
    
    // Commissions
    sellerBrokeragePercent?: number;
    sellerBrokerageAmount?: number;
    buyerBrokeragePercent?: number;
    buyerBrokerageAmount?: number;
    
    remarks?: string;
    createdAt?: string;
}

export const getBookings = async (params?: any) => {
    const res = await api.get("/bookings", { params: { limit: "200", ...params } });
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
