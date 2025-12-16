const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Default route for SPA (if we had client-side routing, but we are using simple HTML files)
// For now, index.html is served automatically by express.static

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
