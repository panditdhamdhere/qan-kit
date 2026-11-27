import fs from 'node:fs/promises';
import path from 'node:path';
import type { Abi } from 'viem';

export interface DeploymentRecord {
  name: string;
  address: `0x${string}`;
  txHash: `0x${string}`;
  abi: Abi;
  args: string[];
  chainId: number;
  timestamp: string;
  language: string;
  sourcePath: string;
}

export async function writeDeployment(
  cwd: string,
  network: string,
  record: DeploymentRecord,
): Promise<string> {
  const dir = path.join(cwd, 'deployments', network);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${record.name}.json`);
  await fs.writeFile(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return file;
}

export async function readDeployment(
  cwd: string,
  network: string,
  name: string,
): Promise<DeploymentRecord> {
  const file = path.join(cwd, 'deployments', network, `${name}.json`);
  const text = await fs.readFile(file, 'utf8');
  return JSON.parse(text) as DeploymentRecord;
}

export async function writeDeployLog(
  cwd: string,
  network: string,
  name: string,
  log: string,
): Promise<string> {
  const dir = path.join(cwd, 'deployments', network);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${name}.log`);
  await fs.writeFile(file, log, 'utf8');
  return file;
}
