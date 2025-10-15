import { db, type PendingOperation, type OfflineImage } from "@/lib/indexedDB";
import { uploadImageToStorage, generateFileName } from "@/services/images";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { getFirestoreClient } from "@/firebase/clientApp";

type PendingType = PendingOperation["type"];

function uuid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function queueOperation(
  op: Omit<
    PendingOperation,
    "id" | "status" | "retries" | "maxRetries" | "createdAt" | "updatedAt"
  >
) {
  const now = Date.now();
  const record: PendingOperation = {
    id: uuid("op"),
    type: op.type,
    payload: op.payload,
    dependencies: op.dependencies || [],
    status: "pending",
    retries: 0,
    maxRetries: 5,
    lastError: undefined,
    idempotencyKey: op.idempotencyKey || uuid("idem"),
    createdAt: now,
    updatedAt: now,
    draftId: op.draftId,
  } as PendingOperation;
  await db.pendingOps.put(record);
  return record.id;
}

export async function queueUploadImage(params: {
  draftId: string;
  fieldKey: string;
  base64: string;
  storagePath: string;
}) {
  const { draftId, fieldKey, base64, storagePath } = params;
  return queueOperation({
    type: "uploadImage",
    payload: { draftId, fieldKey, base64, storagePath },
    dependencies: [],
    draftId,
    idempotencyKey: `${draftId}:${fieldKey}`,
  });
}

export async function queueCreateVisita(params: {
  draftId: string;
  collection: string;
  data: any;
}) {
  const { draftId, collection: coll, data } = params;
  return queueOperation({
    type: "createVisita",
    payload: { coll, data },
    dependencies: [],
    draftId,
    idempotencyKey: `${draftId}:createVisita`,
  });
}

export async function queueWebhookN8N(params: {
  draftId: string;
  url: string;
  body: any;
}) {
  const { draftId, url, body } = params;
  return queueOperation({
    type: "webhook",
    payload: { url, body },
    dependencies: [],
    draftId,
    idempotencyKey: `${draftId}:webhook`,
  });
}

export async function processQueue(): Promise<{
  processed: number;
  errors: number;
}> {
  const pending = await db.pendingOps
    .where("status")
    .equals("pending")
    .sortBy("createdAt");
  let processed = 0;
  let errors = 0;

  for (const op of pending) {
    try {
      await db.pendingOps.update(op.id, {
        status: "processing",
        updatedAt: Date.now(),
      });
      switch (op.type as PendingType) {
        case "uploadImage": {
          const { draftId, fieldKey, base64, storagePath } = op.payload || {};
          const fileName = generateFileName(`${draftId}_${fieldKey}`);
          const url = await uploadImageToStorage(base64, storagePath, fileName);
          // Guardar URL vinculada al draft (en tabla images)
          await db.images.put({
            id: uuid("img"),
            draftId,
            fieldKey,
            blob: new Blob(),
            base64,
            filename: fileName,
            size: base64?.length || 0,
            type: "image/jpeg",
            compressed: true,
            uploadedUrl: url,
            createdAt: Date.now(),
          } as unknown as OfflineImage);
          await db.pendingOps.update(op.id, {
            status: "completed",
            updatedAt: Date.now(),
          });
          processed++;
          break;
        }
        case "createVisita": {
          const { coll, data } = op.payload || {};
          const fs = getFirestoreClient();
          const ref = await addDoc(collection(fs, coll), data);
          await db.pendingOps.update(op.id, {
            status: "completed",
            updatedAt: Date.now(),
          });
          processed++;
          break;
        }
        case "updateCliente": {
          const { path, data } = op.payload || {};
          const fs = getFirestoreClient();
          await updateDoc(doc(fs, path), data);
          await db.pendingOps.update(op.id, {
            status: "completed",
            updatedAt: Date.now(),
          });
          processed++;
          break;
        }
        case "updateRoute": {
          const { path, data } = op.payload || {};
          const fs = getFirestoreClient();
          await updateDoc(doc(fs, path), data);
          await db.pendingOps.update(op.id, {
            status: "completed",
            updatedAt: Date.now(),
          });
          processed++;
          break;
        }
        case "webhook": {
          const { url, body } = op.payload || {};
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          await db.pendingOps.update(op.id, {
            status: "completed",
            updatedAt: Date.now(),
          });
          processed++;
          break;
        }
        default: {
          await db.pendingOps.update(op.id, {
            status: "failed",
            updatedAt: Date.now(),
            lastError: "Tipo no soportado",
          });
          errors++;
        }
      }
    } catch (e: any) {
      const retries = (op.retries || 0) + 1;
      const failed = retries >= (op.maxRetries || 5);
      await db.pendingOps.update(op.id, {
        status: failed ? "failed" : "pending",
        retries,
        lastError: e?.message || String(e),
        updatedAt: Date.now(),
      });
      if (failed) errors++;
    }
  }

  return { processed, errors };
}

export const offlineQueue = {
  queueOperation,
  queueUploadImage,
  queueCreateVisita,
  queueWebhookN8N,
  processQueue,
};
