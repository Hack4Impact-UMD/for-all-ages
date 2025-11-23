import * as functions from "firebase-functions";

export const testConnection = functions.https.onRequest((req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", "http://localhost:5173");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  console.log("testConnection called with body:", req.body);

  res.status(200).json({
    message: "HTTP function is working!",
  });
});
