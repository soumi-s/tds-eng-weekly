const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Allowed email domains (comma-separated in env, defaults to thedigitalstronghold.com)
const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || 'thedigitalstronghold.com')
  .split(',').map(d => d.trim().toLowerCase());

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'tds-weekly-dashboard-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

// Trust Heroku's proxy for secure cookies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Passport setup
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || '/auth/google/callback',
    proxy: true
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
    if (!email) return done(null, false, { message: 'No email found' });

    const domain = email.split('@')[1].toLowerCase();
    if (ALLOWED_DOMAINS.includes(domain)) {
      return done(null, { id: profile.id, email, name: profile.displayName, photo: profile.photos?.[0]?.value });
    }
    return done(null, false, { message: 'Email domain not authorized' });
  }));
}

app.use(passport.initialize());
app.use(passport.session());

// Auth check middleware
function requireAuth(req, res, next) {
  // If Google OAuth is not configured, fall back to basic auth
  if (!process.env.GOOGLE_CLIENT_ID) {
    const password = process.env.DASHBOARD_PASSWORD;
    if (!password) return next();
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="TDS Engineering Weekly"');
      return res.status(401).send('Authentication required');
    }
    const decoded = Buffer.from(auth.split(' ')[1], 'base64').toString();
    const [, pwd] = decoded.split(':');
    if (pwd === password) return next();
    res.setHeader('WWW-Authenticate', 'Basic realm="TDS Engineering Weekly"');
    return res.status(401).send('Invalid credentials');
  }

  // Google OAuth check
  if (req.isAuthenticated()) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/auth/google');
}

// Auth routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/denied' }),
  (req, res) => res.redirect(req.session.returnTo || '/')
);

app.get('/auth/denied', (req, res) => {
  res.status(403).send(`
    <div style="font-family:system-ui;max-width:400px;margin:100px auto;text-align:center">
      <h2>Access Denied</h2>
      <p>Your email domain is not authorized to view this dashboard.</p>
      <p style="color:#888;font-size:14px">Only @${ALLOWED_DOMAINS.join(', @')} accounts are allowed.</p>
      <a href="/auth/google" style="color:#6366f1">Try a different account</a>
    </div>
  `);
});

app.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

// Protected routes
app.use(requireAuth);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});const express = require('express');
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
