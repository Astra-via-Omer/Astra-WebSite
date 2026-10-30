import 'server-only';
import { Storage } from '@google-cloud/storage';
import { investorProgress, type InvestorProgress } from './dispatch';

const object = 'investor-dispatch/current.json';
let cached: { bucket: string; until: number; progress: InvestorProgress | null } | undefined;

export async function readInvestorProgress(canRead: boolean): Promise<InvestorProgress | null> {
  if (!canRead || !process.env.ASTRA_INVESTOR_BUCKET) return null;
  const bucket = process.env.ASTRA_INVESTOR_BUCKET;
  if (cached?.bucket === bucket && cached.until > Date.now()) return cached.progress;
  try {
    const storage = new Storage({ retryOptions: { maxRetries: 1, totalTimeout: 10 } });
    const file = storage.bucket(bucket).file(object);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) > 256 * 1024) throw Error('Dispatch exceeds the size limit.');
    // Pin the metadata generation so a concurrent publisher cannot swap the bytes being validated.
    const [bytes] = await storage.bucket(bucket).file(object, { generation: metadata.generation }).download({ validation: 'crc32c' });
    if (bytes.length > 256 * 1024) throw Error('Dispatch exceeds the size limit.');
    const progress = investorProgress(JSON.parse(bytes.toString('utf8')), true);
    cached = { bucket, until: Date.now() + 60000, progress };
    return progress;
  } catch (error) {
    if ((error as { code?: number }).code === 404) return null;
    // A feed failure must not disable documents or reveal private storage details.
    console.error('Investor progress feed could not be read or validated.');
    return null;
  }
}
