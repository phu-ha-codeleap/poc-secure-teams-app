import React, { useState, useEffect } from 'react';
import { app, authentication } from '@microsoft/teams-js';
import './App.css';

function App() {
  const [userName, setUserName] = useState('');
  const [apiData, setApiData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    app.initialize().then(() => {
      app.getContext().then((context) => {
        setUserName(context.user.userPrincipalName);
      });
    });
  }, []);

  const handleCallApi = async () => {
    setApiData(null);
    setError(null);

    try {
      const accessToken = await authentication.getAuthToken();
      console.log("Acquired Access Token via Teams SDK.");
      console.log("Access Token to be sent:", accessToken); 

      const response = await fetch('<frontend-url>/api/get-data', {
          headers: {
              'Authorization': `Bearer ${accessToken}`,
              'ngrok-skip-browser-warning': 'true' 
          }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API call failed with status ${response.status}: ${errText}`);
      }

      const data = await response.json();
      setApiData(data);

    } catch (e) {
      console.error(e);
      setError(e.message);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Teams SSO PoC</h1>
        <p>Welcome, {userName}</p>
        <button onClick={handleCallApi}>Call Protected Backend API</button>
        {apiData && <pre className="result">{JSON.stringify(apiData, null, 2)}</pre>}
        {error && <pre className="error">Error: {error}</pre>}
      </header>
    </div>
  );
}

export default App;