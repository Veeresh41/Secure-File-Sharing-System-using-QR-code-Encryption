const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const crypto = require('crypto');
const axios = require('axios');

const app = express();

// Add this middleware to skip ngrok browser warning
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

const qrTemplatePath = path.join(__dirname, 'frontend', 'qr.html');
const port = 3000;
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.urlencoded({ extended: true }));

// File size limit: 50 MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE }
});

const algorithm = 'aes-256-cbc';

async function getNgrokURL() {
    try {
        const res = await axios.get('http://127.0.0.1:4040/api/tunnels');
        const tunnel = res.data.tunnels.find(t => t.proto === 'https');
        return tunnel ? tunnel.public_url : null;
    } catch {
        return null;
    }
}

// In-memory store for download counts
const downloadCounts = {};

// Upload + Encrypt
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.body.password) {
        return res.send("❌ Please provide a password.");
    }

    const password = req.body.password;
    const maxDownloads = parseInt(req.body.maxDownloads) || 1;
    const accessMinutes = parseInt(req.body.accessMinutes) || 10;

    const inputPath = path.join(__dirname, 'uploads', req.file.filename);
    const encryptedFileName = req.file.filename + '.enc';
    const encryptedPath = path.join(__dirname, 'uploads', encryptedFileName);

    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(encryptedPath);
    output.write(iv);
    input.pipe(cipher).pipe(output);

    output.on('finish', async () => {
        fs.unlinkSync(inputPath); // Delete original file

        const ngrokURL = await getNgrokURL();
        if (!ngrokURL) return res.send("❌ Ngrok tunnel not active.");

        const validUntil = Date.now() + accessMinutes * 60 * 1000;
        const fileURL = `${ngrokURL}/download/${encryptedFileName}?validUntil=${validUntil}`;

        // Store download count and limit
        downloadCounts[encryptedFileName] = { count: 0, max: maxDownloads };

        const qrCode = await QRCode.toDataURL(fileURL);

        // Load HTML template and inject QR code, link, and access time
        let html = fs.readFileSync(qrTemplatePath, 'utf-8');
        html = html.replace('__QR_IMAGE__', qrCode);
        html = html.replace(/__QR_LINK__/g, fileURL);
        html = html.replace('__ACCESS_SECONDS__', (accessMinutes * 60).toString());

        res.send(html);
    });

    output.on('error', err => {
        console.error(err);
        res.status(500).send("❌ Encryption failed.");
    });
});

// Limit error message
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.send("❗ File too large. Maximum allowed is 50 MB.");
    }
    next();
});

// Decryption page
app.get('/download/:filename', (req, res) => {
    const validUntil = parseInt(req.query.validUntil);
    if (Date.now() > validUntil) {
        return res.send("⏰ Link has expired.");
    }

    const filename = req.params.filename;

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Enter Password</title>
        <link rel="stylesheet" href="/style.css">
    </head>
    <body>
        <div class="password-container">
            <h2>🔐 Enter Password to Download File</h2>
            <form action="/decrypt/${filename}" method="POST">
                <input type="hidden" name="validUntil" value="${validUntil}" />
                <input type="password" name="password" placeholder="Enter password" required />
                <button type="submit">Decrypt & Download</button>
            </form>
        </div>
    </body>
    </html>
    `);
});

// Decrypt file
app.post('/decrypt/:filename', (req, res) => {
    const filename = req.params.filename;
    const password = req.body.password;
    const validUntil = parseInt(req.body.validUntil);

    if (Date.now() > validUntil) {
        return res.send("⏰ Link has expired.");
    }

    // Check download limit
    if (
        !downloadCounts[filename] ||
        downloadCounts[filename].count >= downloadCounts[filename].max
    ) {
        return res.send("❌ Download limit reached for this file.");
    }

    const encryptedPath = path.join(__dirname, 'uploads', filename);
    const decryptedPath = path.join(__dirname, 'uploads', 'dec-' + filename.replace('.enc', ''));

    const key = crypto.scryptSync(password, 'salt', 32);
    const input = fs.createReadStream(encryptedPath, { start: 16 });

    const iv = Buffer.alloc(16);
    const fd = fs.openSync(encryptedPath, 'r');
    fs.readSync(fd, iv, 0, 16, 0);
    fs.closeSync(fd);

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    const output = fs.createWriteStream(decryptedPath);
    input.pipe(decipher).pipe(output);

    output.on('finish', () => {
        // Increment download count
        downloadCounts[filename].count += 1;
        res.download(decryptedPath, err => {
            if (!err) {
                // Optionally, delete decrypted file after download
                fs.unlink(decryptedPath, () => {});
            }
        });
    });

    output.on('error', () => {
        res.send("❌ Incorrect password or file corrupted.");
    });
});

app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
});
