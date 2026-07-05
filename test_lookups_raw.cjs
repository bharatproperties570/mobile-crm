const axios = require('axios');
(async () => {
    try {
        const res = await axios.get('http://192.168.1.13:4000/api/lookups', { params: { limit: 2500 } });
        console.log(JSON.stringify(res.data).substring(0, 500));
    } catch (err) {
        console.error("API error:", err.message);
    }
})();
