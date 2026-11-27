import { ErrorCodes, QanError } from './errors.js';

export interface XlinkStatus {
  bound: boolean;
  expiresAt: Date | null;
}

/**
 * QAN XLINK is mid-change. Do not call the deprecated xlinkSet RPC and do not
 * pin a contract ABI. Implementations live behind this interface.
 *
 * TODO: swap the default once the public ABI settles.
 * https://docs.qanplatform.com/testnet/setup/qan-xlink/docker
 * https://docs.qanplatform.com/testnet/qan-api-methods/qan_xlinkvalid
 */
export interface XlinkProvider {
  getStatus(address: `0x${string}`): Promise<XlinkStatus>;
}

export class NotImplementedXlinkProvider implements XlinkProvider {
  async getStatus(_address: `0x${string}`): Promise<XlinkStatus> {
    throw new QanError(
      ErrorCodes.XLINK_NOT_IMPLEMENTED,
      'XLINK status is not implemented in this build.',
      'The protocol is still changing, and the contract ABI is not public, so qan-kit does not hardcode it. Docs: https://docs.qanplatform.com/testnet/setup/qan-xlink/docker',
    );
  }
}
