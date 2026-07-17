import { createWorker, type Worker } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';

type Logger = (message: {
  status?: string;
  progress?: number;
  [key: string]: unknown;
}) => void;

/**
 * Create a Tesseract worker using the app-bundled worker script (same-origin)
 * so CSP does not need to allow CDN script loads for the worker bootstrap.
 * Core + language data still come from jsDelivr (script-src / connect-src).
 */
export async function createOcrWorker(
  langs: string,
  options?: { logger?: Logger; errorHandler?: (err: unknown) => void },
): Promise<Worker> {
  return createWorker(langs, 1, {
    workerPath,
    // Direct Worker(url) avoids blob:// workers that re-importScripts CDN URLs.
    workerBlobURL: false,
    logger: options?.logger,
    errorHandler: options?.errorHandler,
  });
}
