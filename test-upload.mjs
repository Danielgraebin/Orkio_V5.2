// Test upload with diagnostic mode
import fs from 'fs';

// Set diagnostic ENV vars
process.env.FORCE_STORAGE_LOCAL = 'true';
process.env.DEBUG_UPLOAD_SHORT_CIRCUIT = 'true';
process.env.STORAGE_MODE = 'local';
process.env.UPLOAD_DIR = './uploads';

console.log('🧪 Testing upload with diagnostic mode...');
console.log('ENV:', {
  FORCE_STORAGE_LOCAL: process.env.FORCE_STORAGE_LOCAL,
  DEBUG_UPLOAD_SHORT_CIRCUIT: process.env.DEBUG_UPLOAD_SHORT_CIRCUIT,
  STORAGE_MODE: process.env.STORAGE_MODE,
});

// Create test file
const testContent = 'Hello, this is a test document for Orkio KB upload validation.';
const base64Content = Buffer.from(testContent).toString('base64');

console.log('\n📄 Test file created:');
console.log('- Content:', testContent);
console.log('- Base64 length:', base64Content.length);
console.log('- Size:', Buffer.from(base64Content, 'base64').length, 'bytes');

// Simulate upload payload
const uploadPayload = {
  name: 'test-document.txt',
  content: base64Content,
  mimeType: 'text/plain',
  agentId: 1, // Will create KB agent-1
  orgSlug: 'default',
};

console.log('\n📤 Upload payload:');
console.log(JSON.stringify(uploadPayload, null, 2));

console.log('\n✅ Test setup complete. Ready to call documents.upload via tRPC.');
console.log('\nExpected behavior with short-circuit:');
console.log('1. Creates collection "agent-1" if not exists');
console.log('2. Saves file to ./uploads/orgs/default/uploads/...');
console.log('3. Returns { id, status: "completed", url } immediately');
console.log('4. Logs: documents.upload.started, documents.upload.completed_short_circuit');
