const express = require("express");
const cors = require("cors");
const path = require("path");

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const app = express();
const PORT = 3000;

// ========================================
// FIREBASE ADMIN
// ========================================

const serviceAccount = require("./serviceAccountKey.json");

const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth(firebaseApp);

// ========================================
// MIDDLEWARE
// ========================================

app.use(cors());
app.use(express.json());

// Serve files from main CampusCart folder
app.use(express.static(__dirname));

// Serve files from Student folder
app.use(express.static(path.join(__dirname, "Student")));

// ========================================
// STUDENT DASHBOARD PAGE
// ========================================

app.get("/student-dashboard.html", (req, res) => {
  res.sendFile(
    path.join(__dirname, "Student", "student-dashboard.html")
  );
});

// ========================================
// CHECK REGISTERED ACCOUNT
// ========================================

app.post("/api/check-account", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    const role = String(req.body?.role || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required."
      });
    }

    if (!["student", "canteen"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account type."
      });
    }

    try {
      const user = await auth.getUserByEmail(email);

      return res.json({
        success: true,
        exists: true,
        uid: user.uid
      });

    } catch (error) {
      if (error.code === "auth/user-not-found") {
        return res.json({
          success: true,
          exists: false
        });
      }

      console.error("Firebase error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to check account."
      });
    }

  } catch (error) {
    console.error("CHECK ACCOUNT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
});

// ========================================
// RESET PASSWORD
// ========================================

app.post("/api/reset-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters."
      });
    }

    const user = await auth.getUserByEmail(email);

    await auth.updateUser(user.uid, {
      password: password
    });

    return res.json({
      success: true,
      message: "Password updated successfully."
    });

  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);

    if (error.code === "auth/user-not-found") {
      return res.status(404).json({
        success: false,
        message: "Account not found."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to reset password."
    });
  }
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log("");
  console.log("====================================");
  console.log(" CAMPUS CART BACKEND");
  console.log("====================================");
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Firebase Admin connected.");
  console.log("====================================");
  console.log("");
});