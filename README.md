# School Lost & Found System (Local Mode)

A smart web-based system for managing lost and found items.
**Updated to run 100% LOCALLY without Google Cloud or Firebase billing.**

## Features
- **Student Portal**: Report lost items with image upload.
- **Admin Dashboard**: Register found items and view database.
- **AI Matching**: Matches items based on **Image Color Analysis (Vibrant.js)** and **Keyword Matching**.
- **Local Storage**: Images and Database are stored locally on your machine.

## Prerequisites
- Node.js installed.
- No Cloud Accounts required!

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run the Server**
   ```bash
   npm start
   ```

3. **Access**
   - Open browser at `http://localhost:3000`.

## Tech Stack
- **Frontend**: HTML5, CSS3 (Glassmorphism), JavaScript.
- **Backend**: Node.js, Express.
- **AI/ML**: Node-Vibrant (Color extraction) + Custom Keyword Matcher.
- **Database**: Local JSON File (`data/db.json`).
- **Storage**: Local Filesystem (`public/uploads`).
