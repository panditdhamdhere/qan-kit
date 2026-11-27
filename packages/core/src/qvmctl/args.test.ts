import { describe, expect, it } from 'vitest';
import { buildQvmctlCallArgs, buildQvmctlDeployArgs } from './args.js';

describe('qvmctl args', () => {
  it('builds a solidity deploy the way qvmctl 0.1.0 documents it', () => {
    const { args, warnings } = buildQvmctlDeployArgs({
      language: 'sol',
      contractName: 'Counter',
      privkeyContainerPath: '/run/secrets/privkey',
      rpcUrl: 'https://rpc-testnet.qanplatform.com',
      sourceContainerPath: '/ws/.qan/Counter.sol',
      registry: 'qanplatform',
      loglevel: 'info',
      constructorArgs: [],
    });
    expect(args).toEqual([
      'deploy',
      '-language',
      'solidity',
      '-privkey',
      '/run/secrets/privkey',
      '-rpc',
      'https://rpc-testnet.qanplatform.com',
      '-loglevel',
      'info',
      '-solidity.name',
      'Counter',
      '/ws/.qan/Counter.sol',
    ]);
    expect(warnings).toEqual([]);
  });

  it('warns that constructor args are unused and passes registry for go', () => {
    const { args, warnings } = buildQvmctlDeployArgs({
      language: 'golang',
      privkeyContainerPath: '/run/secrets/privkey',
      rpcUrl: 'https://rpc-testnet.qanplatform.com',
      sourceContainerPath: '/ws/contracts/main.go',
      registry: 'qanplatform',
      loglevel: 'info',
      pretestTimeout: 8,
      constructorArgs: ['hello'],
    });
    expect(args).toContain('-language');
    expect(args[args.indexOf('-language') + 1]).toBe('go');
    expect(args).toContain('-registry');
    expect(args).toContain('-pretest.timeout');
    expect(args.at(-1)).toBe('hello');
    expect(warnings[0]).toMatch(/unused/);
  });

  it('puts scanned slots on qvm tx, not on a solidity language flag', () => {
    const args = buildQvmctlCallArgs({
      kind: 'tx',
      address: '0x0000000000000000000000000000000000000001',
      method: 'register',
      methodArgs: ['ada'],
      slots: ['COUNTER', 'TOTALUSERS'],
      privkeyContainerPath: '/run/secrets/privkey',
      rpcUrl: 'https://rpc-testnet.qanplatform.com',
      loglevel: 'info',
    });
    expect(args.slice(0, 4)).toEqual(['tx', '-language', 'qvm', '-privkey']);
    expect(args).toContain('-r');
    expect(args[args.indexOf('-r') + 1]).toBe('COUNTER,TOTALUSERS');
    expect(args.slice(-2)).toEqual(['register', 'ada']);
  });
});
