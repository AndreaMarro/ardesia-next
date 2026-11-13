/** memoryBytes bounds the entire WASM linear memory, including engine overhead.
 * JS messaging/output and the outer Worker lifecycle have separate limits. */
export const PROGRAM_LIMITS = Object.freeze({memoryBytes:16*1024*1024,stackBytes:128*1024,executionMs:100,outputBytes:131072,messageBytes:262144,watchdogMs:2000,initializationMs:15000,queue:16});
