const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Basic auth middleware using DASHBOARD_PASSWORD env var
app.use((req, res, next) => {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return next(); // no password set = open access

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="TDS Engineering Weekly"');
    return res.status(401).send('Authentication required');
  }

  const decoded = Buffer.from(auth.split(' ')[1], 'base64').toString();
  const [, pwd] = decoded.split(':');
  if (pwd === password) return next();

  res.setHeader('WWW-Authenticate', 'Basic realm="TDS Engineering Weekly"');
  res.status(401).send('Invalid credentials');
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
