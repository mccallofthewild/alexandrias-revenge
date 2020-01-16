import crypto from 'crypto';
import { Env } from '../constants/Env';
import fs from 'fs';
export class WalletService {
	private static ALGORITHM = 'aes-256-ctr';
	static encryptFile(inputFilePath: string, outputFilePath?: string) {
		const buffer = fs.readFileSync(inputFilePath);
		const encryptedBuffer = this.encrypt(buffer);
		if (outputFilePath) fs.writeFileSync(outputFilePath, encryptedBuffer);
		return encryptedBuffer;
	}

	static decryptFile(filePath: string) {
		const buffer = fs.readFileSync(filePath);
		const decryptedBuffer = this.decrypt(buffer);
		return decryptedBuffer.toString();
	}
	static createKey() {
		return crypto
			.createHash('sha256')
			.update(Env.WALLET_FILE_SECRET)
			.digest('base64')
			.substr(0, 32);
	}
	static encrypt(buffer: Buffer) {
		// Create an initialization vector
		const iv = crypto.randomBytes(16);
		// Create a new cipher using the algorithm, key, and iv
		const cipher = crypto.createCipheriv(this.ALGORITHM, this.createKey(), iv);
		// Create the new (encrypted) buffer
		const result = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
		return result;
	}

	static decrypt(encrypted: Buffer) {
		// Get the iv: the first 16 bytes
		const iv = encrypted.slice(0, 16);
		// Get the rest
		encrypted = encrypted.slice(16);
		// Create a decipher
		const decipher = crypto.createDecipheriv(
			this.ALGORITHM,
			this.createKey(),
			iv
		);
		// Actually decrypt it
		const result = Buffer.concat([
			decipher.update(encrypted),
			decipher.final()
		]);
		return result;
	}
}
