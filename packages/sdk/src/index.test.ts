import { describe, expect, it } from 'vitest';
import {
  NotImplementedXlinkProvider,
  explorerAddress,
  explorerTx,
  getPublicClient,
} from './index.js';

describe('sdk', () => {
  it('builds explorer links and a public client for chain 1121', () => {
    expect(explorerTx('0xabc')).toBe('https://testnet.qanscan.com/tx/0xabc');
    expect(explorerAddress('0xdef')).toBe('https://testnet.qanscan.com/address/0xdef');
    expect(getPublicClient().chain?.id).toBe(1121);
  });

  it('does not invent an XLINK binding', async () => {
    const provider = new NotImplementedXlinkProvider();
    await expect(
      provider.getStatus('0x0000000000000000000000000000000000000001'),
    ).rejects.toMatchObject({
      code: 'XLINK_NOT_IMPLEMENTED',
    });
  });
});
