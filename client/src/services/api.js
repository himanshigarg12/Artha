const BASE_URL = "http://localhost:5000/api";

export const getHealth = async () => {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
};s