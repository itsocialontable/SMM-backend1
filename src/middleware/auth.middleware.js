// // const jwt = require("jsonwebtoken");

// // module.exports = (req, res, next) => {
// //   try {
// //     const authHeader = req.headers.authorization;

// //     // 1. Check header
// //     if (!authHeader) {
// //       return res.status(401).json({ msg: "Authorization header missing" });
// //     }

// //     // 2. Extract token
// //     const token = authHeader.startsWith("Bearer ")
// //       ? authHeader.split(" ")[1]
// //       : null;

// //     if (!token) {
// //       return res.status(401).json({ msg: "Token format invalid" });
// //     }

// //     // 3. Verify token
// //    const decoded = jwt.verify(token, process.env.JWT_SECRET);

// //     // 4. Attach user
    
// // req.user = {
// //   id: decoded.id,
// //   role: decoded.role
// // };

// //     next();

// //   } catch (error) {
// //     return res.status(401).json({ msg: "Invalid or expired token" });
// //   }
// // };

// const jwt = require("jsonwebtoken");

// module.exports = (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader) {
//       return res.status(401).json({
//         success: false,
//         msg: "Authorization header missing"
//       });
//     }

//     const token = authHeader.startsWith("Bearer ")
//       ? authHeader.split(" ")[1]
//       : null;

//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         msg: "Token format invalid"
//       });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     // ✅ IMPORTANT: we use req.user for both user/admin
//     req.user = {
//       id: decoded.id,
//       role: decoded.role
//     };

//     next();

//   } catch (error) {
//     return res.status(401).json({
//       success: false,
//       msg: "Invalid or expired token"
//     });
//   }
// };




// new-------------------

// ==========================================
// FILE: src/middleware/auth.middleware.js
// FIXED v21: SECURITY BUG — middleware sirf JWT ka signature/expiry
//   check karta tha, DATABASE me user abhi bhi exist karta hai ya nahi
//   ye kabhi verify nahi karta tha. Login pe token 7 din ke liye milta
//   hai (jwt.sign expiresIn: "7d") — matlab agar koi user (SMM/Client/
//   Graphic Designer/Agency) ko admin delete ya deactivate kar de,
//   uska PURANA token abhi bhi 7 din tak "valid" rehta tha (signature
//   sahi hai, expire nahi hua), aur wo user apna already-saved token
//   use karke system access karta rehta tha jaise kuch hua hi na ho —
//   naya fresh login karta toh loginUser() sahi se block kar deta
//   ("User not found"), lekin ye check purane sessions pe kabhi lagta
//   hi nahi tha.
//
//   Fix: token decode hone ke baad ab HAR request pe DB me ek chhoti
//   lookup hoti hai — user/agency exist karta hai aur isActive hai,
//   tabhi request aage jaane di jaati hai. Delete/deactivate hote hi
//   agla hi API call turant block ho jaata hai, chahe token expire
//   na hua ho.
// ==========================================

const jwt    = require("jsonwebtoken");
const User   = require("../models/user2.model");
const Agency = require("../models/agency.model");

const ADMIN_ROLES = ["admin", "Admin", "agency", "Agency"];

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        msg: "Authorization header missing"
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        msg: "Token format invalid"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // NEW v21: DB me confirm karo ye account abhi bhi exist karta
    // hai aur active hai — sirf token valid hone se kaam nahi
    // chalega, warna deleted/deactivated user purane token se
    // login-jaisa access continue rakh sakta hai.
    const isAdminRole = ADMIN_ROLES.includes(decoded.role);
    const account = isAdminRole
      ? await Agency.findById(decoded.id).select("isActive").lean()
      : await User.findById(decoded.id).select("isActive deletedAt").lean();

    if (!account) {
      return res.status(401).json({
        success: false,
        msg: "This account no longer exists. Please contact your agency."
      });
    }

    if (account.isActive === false) {
      return res.status(401).json({
        success: false,
        msg: account.deletedAt
          ? "This account has been deleted. Please contact your agency."
          : "This account has been deactivated. Please contact your agency admin."
      });
    }

    // IMPORTANT: we use req.user for both user/admin
    req.user = {
      id: decoded.id,
      role: decoded.role
    };

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      msg: "Invalid or expired token"
    });
  }
};