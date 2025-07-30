import { PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Default program ID
const DEFAULT_PROGRAM_ID = 'D5aD6zRq93w46mpqKgY3JY9aF7KEWdEkeUk9E3EThrVH';

// Load program ID from environment variable or use default
export const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || DEFAULT_PROGRAM_ID
); 