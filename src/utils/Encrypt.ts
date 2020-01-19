import crypto from 'crypto';
export class Encrypt {
	private static ALGORITHM = 'aes-256-ctr';
	static encryptText(text: string, password: string) {
		var cipher = crypto.createCipher(this.ALGORITHM, password);
		var crypted = cipher.update(text, 'utf8', 'hex');
		crypted += cipher.final('hex');
		return crypted;
	}

	static decryptText(text: string, password: string) {
		var decipher = crypto.createDecipher(this.ALGORITHM, password);
		var dec = decipher.update(text, 'hex', 'utf8');
		dec += decipher.final('utf8');
		return dec;
	}

	static encryptBuffer(buffer: Buffer, password: string) {
		var cipher = crypto.createCipher(this.ALGORITHM, password);
		var crypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
		return crypted;
	}

	static decryptBuffer(buffer: Buffer, password: string) {
		var decipher = crypto.createDecipher(this.ALGORITHM, password);
		var dec = Buffer.concat([decipher.update(buffer), decipher.final()]);
		return dec;
	}
}
