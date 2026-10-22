import { useEffect, useState } from "react";
import { getHealth } from "./services/api";

function App() {
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    getHealth()
      .then((data) => setStatus(`${data.app}: ${data.status}`))
      .catch(() => setStatus("Server not reachable"));
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Artha</h1>
      <p>{status}</p>
    </div>
  );
}

export default App;