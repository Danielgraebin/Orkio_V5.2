/**
 * Temporary test endpoint to validate upload with diagnostic mode
 * DELETE THIS FILE after validation
 */

import { storagePut } from "./_core/storage";
import * as db from "./db";
import { logger } from "./_core/logger";

export async function testUpload() {
  try {
    // Force diagnostic mode for this test
    const originalForce = process.env.FORCE_STORAGE_LOCAL;
    const originalShortCircuit = process.env.DEBUG_UPLOAD_SHORT_CIRCUIT;
    
    process.env.FORCE_STORAGE_LOCAL = "true";
    process.env.DEBUG_UPLOAD_SHORT_CIRCUIT = "true";

    const testContent = "Hello, this is a test document for Orkio KB upload validation.";
    const base64Content = Buffer.from(testContent).toString('base64');
    const buf = Buffer.from(base64Content, 'base64');
    const mimeType = "text/plain";
    const orgSlug = "default";
    const agentId = 1;

    logger.info("test-upload.started", { size: buf.length, agentId, orgSlug });

    // 1. Ensure KB collection agent-1
    const collectionName = `agent-${agentId}`;
    const cols = await db.getCollectionsByOrg(orgSlug);
    let collection = cols.find((c) => c.name === collectionName);
    
    if (!collection) {
      const collectionId = await db.createCollection({
        name: collectionName,
        description: `Default KB for agent ${agentId}`,
        orgSlug,
      });
      collection = await db.getCollectionById(collectionId);
      logger.info("test-upload.collection_created", { collectionId, name: collectionName });
    }

    // 2. Save to storage (forced local)
    const key = `orgs/${orgSlug}/uploads/${Date.now()}-test-document.txt`;
    const { url } = await storagePut(key, buf, mimeType);
    logger.info("test-upload.storage_success", { key, url });

    // 3. Create document (short-circuit = completed)
    const documentId = await db.createDocument({
      name: "test-document.txt",
      mimeType,
      contentUrl: url,
      status: "completed", // Short-circuit
      collectionId: collection!.id,
      orgSlug,
    });

    logger.info("test-upload.completed_short_circuit", { documentId, url });

    // Restore original ENV
    if (originalForce) process.env.FORCE_STORAGE_LOCAL = originalForce;
    else delete process.env.FORCE_STORAGE_LOCAL;
    if (originalShortCircuit) process.env.DEBUG_UPLOAD_SHORT_CIRCUIT = originalShortCircuit;
    else delete process.env.DEBUG_UPLOAD_SHORT_CIRCUIT;

    return {
      success: true,
      documentId,
      url,
      collectionId: collection!.id,
      collectionName,
      message: "Upload completed with diagnostic mode (short-circuit)",
    };
  } catch (error: any) {
    logger.error("test-upload.failed", { error: error?.message || String(error) });
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}
