const axios = require('axios');
(async () => {
    try {
        const loginRes = await axios.post('http://192.168.1.13:4000/api/auth/login', {
            email: 'admin@bharatproperties.co', // A guess, or maybe I should check DB for an admin user? Let's try.
            password: 'password123'
        });
        console.log("Login success");
    } catch(e) {
        console.log("Login failed", e.response?.status);
    }
})();
