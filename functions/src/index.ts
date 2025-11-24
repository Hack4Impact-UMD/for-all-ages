import * as functions from "firebase-functions";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const secretClient = new SecretManagerServiceClient();

//config pinecone


export const testConnection = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", "http://localhost:5173");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  const name = `projects/for-all-ages-8a4e2/secrets/pinecone_api_key/versions/latest`;
  const [version] = await secretClient.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();

  console.log(payload)

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




// import * as functions from "firebase-functions";
// import * as admin from "firebase-admin";
// import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

// admin.initializeApp();

// const secretClient = new SecretManagerServiceClient();

// export const matching = functions.https.onRequest(async (req, res) => {
//   console.log("got here 1");
//   try {
//     // CORS headers
//     res.set("Access-Control-Allow-Origin", "http://localhost:5173");
//     res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
//     res.set("Access-Control-Allow-Headers", "Content-Type");

//     // Handle CORS preflight
//     if (req.method === "OPTIONS") {
//       res.status(204).send("");
//       return;
//     }
    
    // const name = `projects/for-all-ages/secrets/pinecone_api_key/versions/latest`;
    // console.log("got here 2");
    // const [version] = await secretClient.accessSecretVersion({ name });
    // const payload = version.payload?.data?.toString();
//     console.log("got here 3");
//     if (!payload) {
//       res.status(500).send("Secret is empty or missing.");
//       return;
//     }
//     console.log(payload)
//     // Example: Return the key (DO NOT do this in production)
//     res.status(200).send({
//       pinecone_api_key: payload.substring(0,4),
//     });

//   } catch (err) {
//     console.error("Error accessing secret:", err);
//     res.status(500).send("Error accessing secret");
//   }
// });

