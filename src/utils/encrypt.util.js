const CryptoJS = require("crypto-js");

exports.encrypt = (text) => {
  return CryptoJS.AES.encrypt(
    text,
    process.env.SECRET_KEY
  ).toString();
};

exports.decrypt = (cipherText) => {
  const bytes = CryptoJS.AES.decrypt(
    cipherText,
    process.env.SECRET_KEY
  );

  return bytes.toString(CryptoJS.enc.Utf8);
};