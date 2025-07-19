# 🔐 Secure File Sharing System using QR Code Encryption

A secure and user-friendly file sharing system that encrypts files using AES-256 encryption and generates a unique QR code for secure transfer. The system ensures confidentiality, temporary storage, and easy access through a scanned QR code.

## 📌 Features

- 🔒 **AES-256 Encryption**: Files are encrypted using a key derived from a user-defined secret key via PBKDF2 + SHA-256.
- 📷 **QR Code Generation**: Encrypted download links are embedded in QR codes for easy and secure sharing.
- 🕒 **Temporary Access**: Files are automatically deleted after a configurable time or after being accessed.
- 📦 **File Size Limit**: Supports files up to 50MB, with warning and validation.
- 📤 **User-Friendly Interface**: Clean and responsive UI with a countdown timer, copy/share options, and status alerts.
- 🔐 **OTP or Secret Key Verification**: Users must enter a valid secret key to decrypt the file after scanning the QR code.
- 🌐 **Ngrok Tunnel Support**: Enables secure remote access and QR scanning over the internet.

## 🚀 How It Works

1. **Upload File** → Enter a **Secret Key** → File gets encrypted.
2. **Encrypted File** → Download link is generated → **QR Code is created**.
3. **Recipient Scans QR Code** → Enters the same Secret Key → File gets decrypted and downloaded.

## 🛠️ Technologies Used

- **Backend**: Node.js, Express.js, Multer, Crypto
- **Frontend**: HTML, CSS, JavaScript
- **Encryption**: AES-256 via Crypto module
- **QR Code**: `qrcode` npm package
- **Others**: Ngrok for tunneling, File system module for storage and cleanup

## 📂 Project Structure

