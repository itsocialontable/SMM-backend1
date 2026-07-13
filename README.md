# SMM Backend (Multi-Agency, Multi-Client Social Media Management)

> **v18 update:** Saare bugs fix kiye gaye hain — poori list `AUDIT_REPORT.md` me hai. Admin model hata diya gaya (Agency hi "admin" hai), `User` model references `User2` me fix kiye gaye, aur platform ka core rule lock kiya gaya: **SMM apne liye nahi, hamesha apni agency ke clients ki taraf se post publish karta hai** (`clientId` mandatory). Full flow `FLOW_DOCUMENTATION.md` me, API reference `API_DOCUMENTATION.md` me, migration steps `MIGRATION_GUIDE.md` me hain.

##  Overview
This project is a backend service for an SMM (Social Media Management) platform.  
It handles user authentication, role-based access, and secure login using OTP verification.

>  Note: This project is currently under development.

---

## 🚀 Features
- User Registration (Signup API)
- Secure Login with OTP verification
- Role-based authentication (Client, SMM, Graphic Designer)
- JWT-based session management
- Email OTP integration using Nodemailer
- Input validation and error handling

---

##  Tech Stack
- Node.js
- Express.js
- MongoDB (Atlas)
- Mongoose
- JWT (jsonwebtoken)
- Bcrypt (password hashing)
- Nodemailer (email service)

---

##  Setup Instructions

### 1. Clone Repository
```bash
git clone https://github.com/your-username/smm-backend.git
cd smm-backend