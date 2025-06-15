// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const msal = require('@azure/msal-node');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwksRsa = require('jwks-rsa');

const app = express();
app.use(cors());
app.use(passport.initialize());

const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://login.microsoftonline.com/common/discovery/v2.0/keys`
    }),
    audience: process.env.BACKEND_AUDIENCE, // The Client ID of your app
    algorithms: ['RS256']
};

passport.use(new JwtStrategy(options, (jwt_payload, done) => {
    const validIssuers = [
        `https://login.microsoftonline.com/${jwt_payload.tid}/v2.0`,
        `https://sts.windows.net/${jwt_payload.tid}/`
    ];
    if (validIssuers.includes(jwt_payload.iss)) {
        console.log(`Token validated for user: ${jwt_payload.name}`);
        return done(null, jwt_payload);
    }
    return done(new Error("Invalid issuer"), false);
}));

app.get(
    '/api/get-data',
    passport.authenticate('jwt', { session: false }),
    async (req, res) => {
        console.log(`User '${req.user.name}' accessed the protected route.`);

        const msalConfig = {
            auth: {
                clientId: process.env.BACKEND_CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
                clientSecret: process.env.BACKEND_CLIENT_SECRET,
            }
        };
        const cca = new msal.ConfidentialClientApplication(msalConfig);
        const tokenRequest = { scopes: [`${process.env.DATAVERSE_URL}/.default`] };

        try {
            // Step 1: Acquire token for Dataverse
            const tokenResponse = await cca.acquireTokenByClientCredential(tokenRequest);
            console.log('Successfully acquired token for Dataverse.');

            // *** NEW: Step 2: Use the token to call Dataverse Web API ***
            const dataverseApiUrl = `${process.env.DATAVERSE_URL}/api/data/v9.2/accounts?$top=5&$select=name`;
            const dataverseResponse = await fetch(dataverseApiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenResponse.accessToken}`,
                    'Content-Type': 'application/json',
                    'OData-MaxVersion': '4.0',
                    'OData-Version': '4.0'
                }
            });

            if (!dataverseResponse.ok) {
                const errorText = await dataverseResponse.text();
                throw new Error(`Dataverse API call failed: ${errorText}`);
            }

            const dataverseData = await dataverseResponse.json();
            console.log('Successfully retrieved data from Dataverse.');

            // Step 3: Send a combined response to the frontend
            res.json({
                message: `Hello ${req.user.name}! API call successful.`,
                dataverseData: dataverseData.value // Send back the array of accounts
            });

        } catch (error) {
            console.error('An error occurred:', error.message);
            res.status(500).json({ message: 'An error occurred during the process.', error: error.message });
        }
    }
);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Backend server started on port ${PORT}`));