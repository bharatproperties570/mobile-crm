const axios = require('axios');
(async () => {
    try {
        const res = await axios.get('http://192.168.1.13:4000/api/lookups', { params: { limit: 2500 } });
        const responseData = res.data;
        let data = [];
        
        if (Array.isArray(responseData)) {
            data = responseData;
        } else if (responseData?.data && Array.isArray(responseData.data)) {
            data = responseData.data;
        } else if (responseData?.records && Array.isArray(responseData.records)) {
            data = responseData.records;
        } else if (responseData?.success && responseData?.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data)) {
            data = Object.values(responseData.data).flat();
        } else if (responseData?.success && responseData?.data && Array.isArray(responseData.data)) {
            data = responseData.data;
        }

        console.log("Lookups parsed count:", data.length);
        if (data.length > 0) {
            console.log("Sample lookup type:", data[0].lookup_type);
            const facings = data.filter(l => l.lookup_type === 'Facing' || l.lookup_type === 'facing');
            console.log("Facings count:", facings.length);
            if (facings.length > 0) {
                console.log("Facings sample:", facings[0].lookup_value);
            }
        }
    } catch (err) {
        console.error("API error:", err.message);
    }
})();
