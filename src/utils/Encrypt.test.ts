import { Encrypt } from './Encrypt';

describe(Encrypt.name, () => {
	it('encrypt & decrypt text', () => {
		const data = 'top secret data information';
		const password = 'password123';
		const encrypted = Encrypt.encryptText(data, password);
		const decrypted = Encrypt.decryptText(encrypted, password);
		expect(decrypted).toBe(data);
		expect(encrypted).not.toBe(data);
	});
	it('encrypt & decrypt buffer', () => {
		const data = Buffer.from('top secret data information');
		const password = 'password123';
		const encrypted = Encrypt.encryptBuffer(data, password);
		const decrypted = Encrypt.decryptBuffer(encrypted, password);
		expect(decrypted.toString()).toBe(data.toString());
		expect(encrypted.toString()).not.toBe(data.toString());
	});
});
