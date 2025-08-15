import { PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Default program ID
const DEFAULT_PROGRAM_ID = '9ss4vSk1AzZsPHpmZ6fJae6vg4HefhcuGyh1425woFcV';

// Load program ID from environment variable or use default
export const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || DEFAULT_PROGRAM_ID
); 