const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({
  maxInstances: 10,
});

/*
 * CHECK IF A STUDENT/CANTEEN ACCOUNT EXISTS
 *
 * POST /check-account
 * Body:
 * {
 *   "email": "example@gmail.com",
 *   "role": "student"
 * }
 *
 * Returns:
 * {
 *   "exists": true
 * }
 */
exports.checkAccount = onRequest(
  {
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed.",
      });
    }

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
          message: "Email is required.",
        });
      }

      if (!["student", "canteen"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid account role.",
        });
      }

      try {
        const user = await admin.auth().getUserByEmail(email);

        /*
         * Firebase Authentication confirms that this email
         * has an account.
         */
        return res.status(200).json({
          success: true,
          exists: true,
          uid: user.uid,
        });
      } catch (error) {
        if (error.code === "auth/user-not-found") {
          return res.status(200).json({
            success: true,
            exists: false,
          });
        }

        console.error("Firebase Auth error:", error);

        return res.status(500).json({
          success: false,
          message: "Unable to check account.",
        });
      }
    } catch (error) {
      console.error("checkAccount error:", error);

      return res.status(500).json({
        success: false,
        message: "Server error.",
      });
    }
  }
);