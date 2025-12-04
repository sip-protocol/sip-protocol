/**
 * Proof Generation Web Worker
 *
 * Runs proof generation off the main thread to keep UI responsive.
 * Communicates via postMessage with the main thread.
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/140
 */

import type { ZKProof } from '@sip-protocol/types'
import type {
  FundingProofParams,
  ValidityProofParams,
  FulfillmentProofParams,
  ProofResult,
} from './interface'

// Worker message types
export type WorkerMessageType =
  | 'init'
  | 'generateFundingProof'
  | 'generateValidityProof'
  | 'generateFulfillmentProof'
  | 'destroy'

export interface WorkerRequest {
  id: string
  type: WorkerMessageType
  params?: FundingProofParams | ValidityProofParams | FulfillmentProofParams
  config?: {
    verbose?: boolean
    oraclePublicKey?: { x: number[]; y: number[] }
  }
}

export interface WorkerResponse {
  id: string
  type: 'success' | 'error' | 'progress'
  result?: ProofResult
  error?: string
  progress?: {
    stage: string
    percent: number
    message: string
  }
}

/**
 * Create inline worker code as a blob URL
 * This approach works with most bundlers without special configuration
 */
export function createWorkerBlobURL(): string {
  const workerCode = `
    // Proof Generation Worker
    // This code runs in a separate thread

    let fundingNoir = null;
    let fundingBackend = null;
    let validityNoir = null;
    let validityBackend = null;
    let fulfillmentNoir = null;
    let fulfillmentBackend = null;
    let isReady = false;
    let config = { verbose: false };

    // Helper to send progress updates
    function sendProgress(id, stage, percent, message) {
      self.postMessage({
        id,
        type: 'progress',
        progress: { stage, percent, message }
      });
    }

    // Helper to send error
    function sendError(id, error) {
      self.postMessage({
        id,
        type: 'error',
        error: error.message || String(error)
      });
    }

    // Helper to send success
    function sendSuccess(id, result) {
      self.postMessage({
        id,
        type: 'success',
        result
      });
    }

    // Initialize circuits (called once)
    async function initialize(id, initConfig) {
      try {
        sendProgress(id, 'initializing', 10, 'Loading Noir JS...');

        // Dynamic imports for Noir
        const { Noir } = await import('@noir-lang/noir_js');
        const { UltraHonkBackend } = await import('@aztec/bb.js');

        sendProgress(id, 'initializing', 30, 'Loading circuit artifacts...');

        // Load circuit artifacts
        const [fundingArtifact, validityArtifact, fulfillmentArtifact] = await Promise.all([
          fetch(new URL('./circuits/funding_proof.json', import.meta.url)).then(r => r.json()),
          fetch(new URL('./circuits/validity_proof.json', import.meta.url)).then(r => r.json()),
          fetch(new URL('./circuits/fulfillment_proof.json', import.meta.url)).then(r => r.json()),
        ]);

        sendProgress(id, 'initializing', 50, 'Initializing backends...');

        // Initialize Noir instances
        fundingNoir = new Noir(fundingArtifact);
        fundingBackend = new UltraHonkBackend(fundingArtifact.bytecode);

        sendProgress(id, 'initializing', 70, 'Initializing validity circuit...');
        validityNoir = new Noir(validityArtifact);
        validityBackend = new UltraHonkBackend(validityArtifact.bytecode);

        sendProgress(id, 'initializing', 90, 'Initializing fulfillment circuit...');
        fulfillmentNoir = new Noir(fulfillmentArtifact);
        fulfillmentBackend = new UltraHonkBackend(fulfillmentArtifact.bytecode);

        config = initConfig || { verbose: false };
        isReady = true;

        sendProgress(id, 'complete', 100, 'Worker initialized');
        sendSuccess(id, { initialized: true });
      } catch (error) {
        sendError(id, error);
      }
    }

    // Generate funding proof
    async function generateFundingProof(id, params) {
      if (!isReady) {
        sendError(id, new Error('Worker not initialized'));
        return;
      }

      try {
        sendProgress(id, 'witness', 20, 'Preparing witness...');

        // Convert blinding factor to field
        const blindingField = bytesToField(params.blindingFactor);

        // Circuit uses Field type for unlimited precision
        const witnessInputs = {
          minimum_required: '0x' + params.minimumRequired.toString(16),
          asset_id: '0x' + assetIdToField(params.assetId),
          balance: '0x' + params.balance.toString(16),
          blinding: blindingField,
        };

        sendProgress(id, 'witness', 40, 'Executing circuit...');
        const { witness, returnValue } = await fundingNoir.execute(witnessInputs);

        sendProgress(id, 'proving', 60, 'Generating proof...');
        const proofData = await fundingBackend.generateProof(witness);

        sendProgress(id, 'complete', 100, 'Proof generated');

        // Extract commitment hash from return value
        const commitmentHashHex = bytesToHex(new Uint8Array(returnValue));

        // Field values padded to 64 hex chars (32 bytes)
        const publicInputs = [
          '0x' + params.minimumRequired.toString(16).padStart(64, '0'),
          '0x' + assetIdToField(params.assetId),
          '0x' + commitmentHashHex,
        ];

        const proof = {
          type: 'funding',
          proof: '0x' + bytesToHex(proofData.proof),
          publicInputs,
        };

        sendSuccess(id, { proof, publicInputs });
      } catch (error) {
        sendError(id, error);
      }
    }

    // Generate validity proof
    async function generateValidityProof(id, params) {
      if (!isReady) {
        sendError(id, new Error('Worker not initialized'));
        return;
      }

      try {
        sendProgress(id, 'witness', 20, 'Preparing validity witness...');

        // Import noble crypto for hashing
        const { sha256 } = await import('@noble/hashes/sha256');

        // Convert inputs to field elements
        const intentHashField = hexToField(params.intentHash);
        const senderAddressField = hexToField(params.senderAddress);
        const senderBlindingField = bytesToField(params.senderBlinding);
        const senderSecretField = bytesToField(params.senderSecret);
        const nonceField = bytesToField(params.nonce);

        // Compute sender commitment
        const addressBytes = hexToBytes(senderAddressField);
        const blindingBytes = hexToBytes(senderBlindingField.padStart(64, '0'));
        const commitmentPreimage = new Uint8Array([...addressBytes, ...blindingBytes]);
        const commitmentHash = sha256(commitmentPreimage);
        const commitmentX = bytesToHex(commitmentHash.slice(0, 16)).padStart(64, '0');
        const commitmentY = bytesToHex(commitmentHash.slice(16, 32)).padStart(64, '0');

        // Compute nullifier
        const secretBytes = hexToBytes(senderSecretField.padStart(64, '0'));
        const intentBytes = hexToBytes(intentHashField);
        const nonceBytes = hexToBytes(nonceField.padStart(64, '0'));
        const nullifierPreimage = new Uint8Array([...secretBytes, ...intentBytes, ...nonceBytes]);
        const nullifierHash = sha256(nullifierPreimage);
        const nullifier = bytesToHex(nullifierHash);

        const signature = Array.from(params.authorizationSignature);
        const messageHash = fieldToBytes32(intentHashField);

        // Get public key coordinates
        let pubKeyX, pubKeyY;
        if (params.senderPublicKey) {
          pubKeyX = Array.from(params.senderPublicKey.x);
          pubKeyY = Array.from(params.senderPublicKey.y);
        } else {
          // Derive from secret
          const { secp256k1 } = await import('@noble/curves/secp256k1');
          const uncompressedPubKey = secp256k1.getPublicKey(params.senderSecret, false);
          pubKeyX = Array.from(uncompressedPubKey.slice(1, 33));
          pubKeyY = Array.from(uncompressedPubKey.slice(33, 65));
        }

        const witnessInputs = {
          intent_hash: intentHashField,
          sender_commitment_x: commitmentX,
          sender_commitment_y: commitmentY,
          nullifier: nullifier,
          timestamp: params.timestamp.toString(),
          expiry: params.expiry.toString(),
          sender_address: senderAddressField,
          sender_blinding: senderBlindingField,
          sender_secret: senderSecretField,
          pub_key_x: pubKeyX,
          pub_key_y: pubKeyY,
          signature: signature,
          message_hash: messageHash,
          nonce: nonceField,
        };

        sendProgress(id, 'witness', 40, 'Executing validity circuit...');
        const { witness } = await validityNoir.execute(witnessInputs);

        sendProgress(id, 'proving', 60, 'Generating validity proof...');
        const proofData = await validityBackend.generateProof(witness);

        sendProgress(id, 'complete', 100, 'Validity proof generated');

        const publicInputs = [
          '0x' + intentHashField,
          '0x' + commitmentX,
          '0x' + commitmentY,
          '0x' + nullifier,
          '0x' + params.timestamp.toString(16).padStart(16, '0'),
          '0x' + params.expiry.toString(16).padStart(16, '0'),
        ];

        const proof = {
          type: 'validity',
          proof: '0x' + bytesToHex(proofData.proof),
          publicInputs,
        };

        sendSuccess(id, { proof, publicInputs });
      } catch (error) {
        sendError(id, error);
      }
    }

    // Generate fulfillment proof
    async function generateFulfillmentProof(id, params) {
      if (!isReady) {
        sendError(id, new Error('Worker not initialized'));
        return;
      }

      try {
        sendProgress(id, 'witness', 20, 'Preparing fulfillment witness...');

        // Import noble crypto for hashing
        const { sha256 } = await import('@noble/hashes/sha256');

        const intentHashField = hexToField(params.intentHash);
        const recipientStealthField = hexToField(params.recipientStealth);

        // Compute output commitment
        const amountBytes = bigintToBytes(params.outputAmount, 8);
        const blindingBytes = params.outputBlinding.slice(0, 32);
        const outputPreimage = new Uint8Array([...amountBytes, ...blindingBytes]);
        const outputHash = sha256(outputPreimage);
        const commitmentX = bytesToHex(outputHash.slice(0, 16)).padStart(64, '0');
        const commitmentY = bytesToHex(outputHash.slice(16, 32)).padStart(64, '0');

        const solverSecretField = bytesToField(params.solverSecret);

        // Compute solver ID
        const solverSecretBytes = hexToBytes(solverSecretField.padStart(64, '0'));
        const solverIdHash = sha256(solverSecretBytes);
        const solverId = bytesToHex(solverIdHash);

        const outputBlindingField = bytesToField(params.outputBlinding);

        const attestation = params.oracleAttestation;
        const attestationRecipientField = hexToField(attestation.recipient);
        const attestationTxHashField = hexToField(attestation.txHash);
        const oracleSignature = Array.from(attestation.signature);

        // Compute oracle message hash
        const recipientBytes = hexToBytes(attestationRecipientField);
        const attestationAmountBytes = bigintToBytes(attestation.amount, 8);
        const txHashBytes = hexToBytes(attestationTxHashField);
        const blockBytes = bigintToBytes(attestation.blockNumber, 8);
        const oraclePreimage = new Uint8Array([
          ...recipientBytes,
          ...attestationAmountBytes,
          ...txHashBytes,
          ...blockBytes,
        ]);
        const oracleMessageHash = Array.from(sha256(oraclePreimage));

        const oraclePubKeyX = config.oraclePublicKey?.x ?? new Array(32).fill(0);
        const oraclePubKeyY = config.oraclePublicKey?.y ?? new Array(32).fill(0);

        const witnessInputs = {
          intent_hash: intentHashField,
          output_commitment_x: commitmentX,
          output_commitment_y: commitmentY,
          recipient_stealth: recipientStealthField,
          min_output_amount: params.minOutputAmount.toString(),
          solver_id: solverId,
          fulfillment_time: params.fulfillmentTime.toString(),
          expiry: params.expiry.toString(),
          output_amount: params.outputAmount.toString(),
          output_blinding: outputBlindingField,
          solver_secret: solverSecretField,
          attestation_recipient: attestationRecipientField,
          attestation_amount: attestation.amount.toString(),
          attestation_tx_hash: attestationTxHashField,
          attestation_block: attestation.blockNumber.toString(),
          oracle_signature: oracleSignature,
          oracle_message_hash: oracleMessageHash,
          oracle_pub_key_x: oraclePubKeyX,
          oracle_pub_key_y: oraclePubKeyY,
        };

        sendProgress(id, 'witness', 40, 'Executing fulfillment circuit...');
        const { witness } = await fulfillmentNoir.execute(witnessInputs);

        sendProgress(id, 'proving', 60, 'Generating fulfillment proof...');
        const proofData = await fulfillmentBackend.generateProof(witness);

        sendProgress(id, 'complete', 100, 'Fulfillment proof generated');

        const publicInputs = [
          '0x' + intentHashField,
          '0x' + commitmentX,
          '0x' + commitmentY,
          '0x' + recipientStealthField,
          '0x' + params.minOutputAmount.toString(16).padStart(16, '0'),
          '0x' + solverId,
          '0x' + params.fulfillmentTime.toString(16).padStart(16, '0'),
          '0x' + params.expiry.toString(16).padStart(16, '0'),
        ];

        const proof = {
          type: 'fulfillment',
          proof: '0x' + bytesToHex(proofData.proof),
          publicInputs,
        };

        sendSuccess(id, { proof, publicInputs });
      } catch (error) {
        sendError(id, error);
      }
    }

    // Helper functions
    function bytesToField(bytes) {
      let result = 0n;
      const len = Math.min(bytes.length, 31);
      for (let i = 0; i < len; i++) {
        result = result * 256n + BigInt(bytes[i]);
      }
      return result.toString();
    }

    function assetIdToField(assetId) {
      if (assetId.startsWith('0x')) {
        return assetId.slice(2).padStart(64, '0');
      }
      const encoder = new TextEncoder();
      const bytes = encoder.encode(assetId);
      let result = 0n;
      for (let i = 0; i < bytes.length && i < 31; i++) {
        result = result * 256n + BigInt(bytes[i]);
      }
      return result.toString(16).padStart(64, '0');
    }

    function bytesToHex(bytes) {
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function hexToBytes(hex) {
      const h = hex.startsWith('0x') ? hex.slice(2) : hex;
      const bytes = new Uint8Array(h.length / 2);
      for (let i = 0; i < h.length; i += 2) {
        bytes[i / 2] = parseInt(h.slice(i, i + 2), 16);
      }
      return bytes;
    }

    function hexToField(hex) {
      const h = hex.startsWith('0x') ? hex.slice(2) : hex;
      return h.padStart(64, '0');
    }

    function fieldToBytes32(field) {
      const hex = field.padStart(64, '0');
      const bytes = [];
      for (let i = 0; i < 32; i++) {
        bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
      }
      return bytes;
    }

    function bigintToBytes(value, length) {
      const bytes = new Uint8Array(length);
      let v = value;
      for (let i = length - 1; i >= 0; i--) {
        bytes[i] = Number(v & 0xffn);
        v = v >> 8n;
      }
      return bytes;
    }

    // Message handler
    self.onmessage = async function(event) {
      const { id, type, params, config: initConfig } = event.data;

      switch (type) {
        case 'init':
          await initialize(id, initConfig);
          break;
        case 'generateFundingProof':
          await generateFundingProof(id, params);
          break;
        case 'generateValidityProof':
          await generateValidityProof(id, params);
          break;
        case 'generateFulfillmentProof':
          await generateFulfillmentProof(id, params);
          break;
        case 'destroy':
          // Cleanup
          fundingNoir = null;
          fundingBackend = null;
          validityNoir = null;
          validityBackend = null;
          fulfillmentNoir = null;
          fulfillmentBackend = null;
          isReady = false;
          sendSuccess(id, { destroyed: true });
          break;
        default:
          sendError(id, new Error('Unknown message type: ' + type));
      }
    };
  `

  const blob = new Blob([workerCode], { type: 'application/javascript' })
  return URL.createObjectURL(blob)
}

/**
 * ProofWorker class for managing Web Worker proof generation
 *
 * Provides a clean API for generating proofs in a Web Worker,
 * with progress callbacks and automatic fallback to main thread.
 *
 * @example
 * ```typescript
 * const worker = new ProofWorker()
 * await worker.initialize()
 *
 * const result = await worker.generateProof('funding', params, (progress) => {
 *   console.log(`${progress.stage}: ${progress.percent}%`)
 * })
 * ```
 */
export class ProofWorker {
  private worker: Worker | null = null
  private pendingRequests: Map<
    string,
    {
      resolve: (result: ProofResult) => void
      reject: (error: Error) => void
      onProgress?: (progress: NonNullable<WorkerResponse['progress']>) => void
    }
  > = new Map()
  private _isReady = false
  private requestCounter = 0

  /**
   * Check if Web Workers are supported
   */
  static isSupported(): boolean {
    return typeof Worker !== 'undefined' && typeof Blob !== 'undefined'
  }

  /**
   * Check if worker is initialized and ready
   */
  get isReady(): boolean {
    return this._isReady
  }

  /**
   * Initialize the worker
   */
  async initialize(config?: {
    verbose?: boolean
    oraclePublicKey?: { x: number[]; y: number[] }
  }): Promise<void> {
    if (this._isReady) {
      return
    }

    if (!ProofWorker.isSupported()) {
      throw new Error('Web Workers not supported in this environment')
    }

    // Create worker from blob URL
    const workerURL = createWorkerBlobURL()
    this.worker = new Worker(workerURL, { type: 'module' })

    // Set up message handler
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleWorkerMessage(event.data)
    }

    this.worker.onerror = (error) => {
      console.error('[ProofWorker] Worker error:', error)
      // Reject all pending requests
      for (const [id, { reject }] of this.pendingRequests) {
        reject(new Error(`Worker error: ${error.message}`))
        this.pendingRequests.delete(id)
      }
    }

    // Initialize the worker
    await this.sendRequest('init', undefined, config)
    this._isReady = true

    // Cleanup blob URL
    URL.revokeObjectURL(workerURL)
  }

  /**
   * Generate a proof using the worker
   */
  async generateProof(
    type: 'funding' | 'validity' | 'fulfillment',
    params: FundingProofParams | ValidityProofParams | FulfillmentProofParams,
    onProgress?: (progress: NonNullable<WorkerResponse['progress']>) => void
  ): Promise<ProofResult> {
    if (!this._isReady || !this.worker) {
      throw new Error('Worker not initialized. Call initialize() first.')
    }

    const messageType =
      type === 'funding'
        ? 'generateFundingProof'
        : type === 'validity'
          ? 'generateValidityProof'
          : 'generateFulfillmentProof'

    return this.sendRequest(messageType, params, undefined, onProgress)
  }

  /**
   * Destroy the worker and free resources
   */
  async destroy(): Promise<void> {
    if (this.worker) {
      try {
        await this.sendRequest('destroy')
      } catch {
        // Ignore errors during cleanup
      }
      this.worker.terminate()
      this.worker = null
    }
    this._isReady = false
    this.pendingRequests.clear()
  }

  /**
   * Send a request to the worker
   */
  private sendRequest(
    type: WorkerMessageType,
    params?: FundingProofParams | ValidityProofParams | FulfillmentProofParams,
    config?: { verbose?: boolean; oraclePublicKey?: { x: number[]; y: number[] } },
    onProgress?: (progress: NonNullable<WorkerResponse['progress']>) => void
  ): Promise<ProofResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'))
        return
      }

      const id = `req_${++this.requestCounter}_${Date.now()}`
      this.pendingRequests.set(id, { resolve, reject, onProgress })

      const request: WorkerRequest = { id, type, params, config }
      this.worker.postMessage(request)
    })
  }

  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(response: WorkerResponse): void {
    const pending = this.pendingRequests.get(response.id)
    if (!pending) {
      console.warn('[ProofWorker] Received response for unknown request:', response.id)
      return
    }

    switch (response.type) {
      case 'success':
        this.pendingRequests.delete(response.id)
        pending.resolve(response.result as ProofResult)
        break
      case 'error':
        this.pendingRequests.delete(response.id)
        pending.reject(new Error(response.error))
        break
      case 'progress':
        if (pending.onProgress && response.progress) {
          pending.onProgress(response.progress)
        }
        break
    }
  }
}

// Re-export types
export type { ProofResult }
