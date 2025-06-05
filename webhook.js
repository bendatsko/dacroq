#!/usr/bin/env node

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');

// Configuration
const PORT = 9000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'dacroq-deployment-secret-2024';
const DEPLOY_SCRIPT = '/var/www/dacroq/deploy.sh';

// Function to log messages
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Function to verify GitHub webhook signature
function verifySignature(payload, signature) {
  if (!signature) {
    return false;
  }

  // GitHub sends signature as "sha256=<hash>"
  const sigBuffer = Buffer.from(signature.replace('sha256=', ''), 'hex');
  const expectedSig = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload, 'utf8')
    .digest();

  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(sigBuffer, expectedSig);
  } catch (error) {
    log(`❌ Signature verification error: ${error.message}`);
    return false;
  }
}

// Function to handle webhook payload
function handleWebhook(payload) {
  try {
    const event = JSON.parse(payload);
    const { ref, repository } = event;
    
    log(`📨 Received push event for ${repository.full_name}`);
    log(`🌿 Branch: ${ref}`);
    
    // Only deploy on push to main branch
    if (ref === 'refs/heads/main' || ref === 'refs/heads/master') {
      log('🎯 Push to main branch detected, starting deployment...');
      
      // Execute deployment script
      exec(DEPLOY_SCRIPT, (error, stdout, stderr) => {
        if (error) {
          log(`❌ Deployment failed: ${error.message}`);
          log(`stderr: ${stderr}`);
        } else {
          log('✅ Deployment completed successfully');
          log(`stdout: ${stdout}`);
        }
      });
    } else {
      log(`ℹ️  Push to ${ref} ignored (not main branch)`);
    }
  } catch (error) {
    log(`❌ Error parsing webhook payload: ${error.message}`);
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: 'modern-github-webhook'
    }));
    return;
  }

  // Handle webhook POST requests
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      const signature = req.headers['x-hub-signature-256'];
      const eventType = req.headers['x-github-event'];
      const deliveryId = req.headers['x-github-delivery'];

      log(`📦 Received webhook: Event=${eventType}, Delivery=${deliveryId}`);
      log(`🔐 Signature present: ${signature ? 'Yes' : 'No'}`);

      // Verify signature
      if (!verifySignature(body, signature)) {
        log(`❌ Invalid signature - webhook rejected`);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      log(`✅ Signature verified successfully`);

      // Handle ping events (GitHub sends this when webhook is first created)
      if (eventType === 'ping') {
        log(`🏓 Ping event received - webhook is working!`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'pong' }));
        return;
      }

      // Handle push events
      if (eventType === 'push') {
        handleWebhook(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Webhook processed' }));
        return;
      }

      // Other events
      log(`ℹ️  Event type '${eventType}' not handled`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Event received but not processed' }));
    });

    return;
  }

  // 404 for other requests
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  log(`🚀 Modern GitHub webhook server running on port ${PORT}`);
  log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
  log(`🏥 Health check: http://localhost:${PORT}/health`);
  log(`🔐 Using secret: ${WEBHOOK_SECRET ? 'Set' : 'NOT SET'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('👋 Shutting down webhook server...');
  server.close(() => {
    log('✅ Webhook server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  log('👋 Received SIGTERM, shutting down webhook server...');
  server.close(() => {
    log('✅ Webhook server stopped');
    process.exit(0);
  });
}); 