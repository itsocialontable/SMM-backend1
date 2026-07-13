// const jwt = require("jsonwebtoken");

// module.exports = (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     // 1. Check header
//     if (!authHeader) {
//       return res.status(401).json({ msg: "Authorization header missing" });
//     }

//     // 2. Extract token
//     const token = authHeader.startsWith("Bearer ")
//       ? authHeader.split(" ")[1]
//       : null;

//     if (!token) {
//       return res.status(401).json({ msg: "Token format invalid" });
//     }

//     // 3. Verify token
//    const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     // 4. Attach user
    
// req.user = {
//   id: decoded.id,
//   role: decoded.role
// };

//     next();

//   } catch (error) {
//     return res.status(401).json({ msg: "Invalid or expired token" });
//   }
// };

const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
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

    // ✅ IMPORTANT: we use req.user for both user/admin
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