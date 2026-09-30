Quick Link: 
https://photodrop-vxl1.onrender.com/

# 📸 PhotoDrop (PicShare)

> Fast, privacy-first photo transfer from **iPhone → Windows** with on-device compression and zero cloud storage.

PhotoDrop is a lightweight web app for quickly transferring photos from an iPhone to a Windows laptop without WhatsApp, email, cables, or permanent cloud storage.

## ✨ Features

* 🚀 **P2P Transfer** — WebRTC DataChannel with STUN
* 🔒 **Zero Cloud Storage** — Photos remain in browser memory and are never permanently stored
* ⚡ **On-device Compression** — Images are resized/compressed directly on the iPhone
* 📱 **QR Pairing** — Scan a QR code to connect instantly
* 🖼️ **Batch Transfer** — Send 1 or 20+ photos at once
* 🎯 **Windows-friendly** — Right-click → Save image as / Copy image
* 📋 **Clipboard Support** — Copy images directly to Photoshop, Figma, Discord, Paint, etc.
* 📦 **Download All** — Download received photos as a ZIP
* 📊 **Transfer Stats** — Progress, speed, and compression savings
* 🔄 **Relay Fallback** — Ephemeral in-memory WebSocket relay when direct P2P fails

## 🏗️ Architecture

```text
             WebSocket
        ┌─────────────────┐
        │ Signaling Server│
        └───────┬─────────┘
                │
          WebRTC negotiation
                │
       ┌────────┴────────┐
       ▼                 ▼
   📱 iPhone          💻 Windows
       │                 │
       └── WebRTC P2P ───┘
```

Photos are compressed locally before transfer:

```text
iPhone Photo
     ↓
Resize + Compress
     ↓
WebRTC DataChannel
     ↓
Windows Browser
     ↓
Save / Copy / Download
```

No photo database, S3 bucket, or permanent server storage is used.

## ⚡ Compression Modes

| Mode           |       Max Width |  Quality |
| -------------- | --------------: | -------: |
| **Balanced** ⭐ |          2400px |      82% |
| **Fast**       |          1600px |      72% |
| **Original**   | Full resolution | Original |

Supports JPEG, PNG, and HEIC/HEIF where browser decoding is available.

## 🚀 Quick Start

### Requirements

* Node.js + npm
* iPhone with Safari
* Windows laptop
* Both devices on the same Wi-Fi or iPhone hotspot

### Install

```bash
git clone <YOUR_REPOSITORY_URL>
cd photodrop
npm install
```

### Run

```bash
npm run dev
```

The server will display something like:

```text
🚀 PhotoDrop Server Running!

💻 Laptop:  http://localhost:3000
📱 iPhone:  http://172.20.10.13:3000

🔒 Zero-Cloud Mode: Active
```

Open the laptop URL in Chrome/Edge and scan the displayed QR code with the iPhone.

Then:

```text
Scan QR
   ↓
Select Photos
   ↓
Compress Locally
   ↓
Transfer
   ↓
Save / Copy on Windows
```

## 🌐 Public Cloud Hosting (Render, Railway, Fly.io)

PhotoDrop is 100% production-ready for free cloud deployment on services supporting Node.js and WebSockets:

### Deploy on Render (Free)
1. Push this repository to your GitHub account.
2. Sign in to [Render](https://render.com/) and click **New +** → **Web Service**.
3. Select this repository.
4. Configure:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment Variables:** `NODE_ENV` = `production`
5. Click **Deploy Web Service**. You will receive an instant public HTTPS domain (e.g. `https://photodrop-xyz.onrender.com`) that automatically pairs with your iPhone from anywhere!

## 🛠️ Tech Stack

* **Frontend:** React 19, TypeScript, Vite
* **UI:** Lucide Icons
* **Image Processing:** Canvas API
* **Compression:** Browser-side JPEG compression
* **Backend:** Node.js, Express
* **Signaling:** WebSocket (`ws`)
* **Transfer:** WebRTC DataChannel
* **NAT Traversal:** STUN
* **ZIP:** JSZip

## 🔐 Privacy

PhotoDrop is designed around a simple principle:

> **Your photos should go from your phone to your laptop, not to someone else's cloud.**

Photos are processed in browser memory and are not intentionally persisted by the application.
