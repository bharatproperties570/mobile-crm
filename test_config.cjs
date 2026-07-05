const axios = require('axios');
(async () => {
    try {
        const res = await axios.get('http://192.168.1.13:4000/api/system-settings/propertyConfig');
        console.log("Config keys:", Object.keys(res.data.data.value));
        const val = res.data.data.value;
        console.log("Facings:", val.facings ? val.facings.length : "undefined");
        if (val.facings) console.log("Facings sample:", val.facings[0]);
    } catch (err) {
        console.error("API error:", err.message);
    }
})();
