const { createServer } = require('http');
require('dotenv').config();
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

// Self-healing .htaccess: Patch it on startup if Hostinger reset it
try {
    const htaccessPath = path.join(__dirname, '.htaccess');
    if (fs.existsSync(htaccessPath)) {
        let content = fs.readFileSync(htaccessPath, 'utf8');
        // Check for our specific marker or rule
        if (!content.includes('RewriteRule ^_next/(.*)$ server.js')) {
            console.log('⚠️ .htaccess missing routing rules. Patching now...');
            const patch = `
# --- START AUTO-PATCHED BY server.js ---
<IfModule mod_rewrite.c>
  RewriteEngine On
  Options -MultiViews
  
  # Disable ModSecurity to prevent 400 errors
  <IfModule mod_security.c>
    SecFilterEngine Off
    SecFilterScanPOST Off
  </IfModule>

  # Force _next static files to be handled by server.js (Node.js)
  RewriteRule ^_next/(.*)$ server.js [QSA,L]

  # Fallback for other routes
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ server.js [QSA,L]
</IfModule>
# --- END AUTO-PATCHED BY server.js ---
`;
            fs.appendFileSync(htaccessPath, patch);
            console.log('✅ .htaccess patched successfully.');
        } else {
            console.log('ℹ️ .htaccess already patched.');
        }
    }
} catch (error) {
    console.error('❌ Failed to patch .htaccess:', error);
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            const { pathname } = parsedUrl;

            // SPECIAL HANDLING: Manually serve static files to bypass LiteSpeed/Passenger issues
            if (pathname.startsWith('/_next/static/')) {
                // Remove /_next/static/ prefix to get relative path
                const relativePath = pathname.replace('/_next/static/', '');

                // Construct absolute path to the file in .next/static directory
                const filePath = require('path').join(__dirname, '.next', 'static', relativePath);

                // Security check to prevent directory traversal
                if (!filePath.startsWith(require('path').join(__dirname, '.next', 'static'))) {
                    res.statusCode = 403;
                    res.end('Forbidden');
                    return;
                }

                const fs = require('fs');
                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                    // Set correct MIME types
                    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
                    else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
                    else if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
                    else if (filePath.endsWith('.jpg')) res.setHeader('Content-Type', 'image/jpeg');
                    else if (filePath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
                    else if (filePath.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
                    else if (filePath.endsWith('.woff2')) res.setHeader('Content-Type', 'font/woff2');

                    // Serve the file directly
                    fs.createReadStream(filePath).pipe(res);
                    return;
                }
                // If file not found, fall through to Next.js handler (might be 404)
            }

            // Let Next.js handle all other requests
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('Internal server error');
        }
    })
        .once('error', (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
