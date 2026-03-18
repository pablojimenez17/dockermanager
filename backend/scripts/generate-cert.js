import selfsigned from 'selfsigned';
import fs from 'fs';
import path from 'path';

async function generate() {
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = await selfsigned.generate(attrs, { days: 365, keySize: 2048 });

    const certsDir = path.join(process.cwd(), 'certs');
    if (!fs.existsSync(certsDir)) {
        fs.mkdirSync(certsDir);
    }

    fs.writeFileSync(path.join(certsDir, 'key.pem'), pems.private);
    fs.writeFileSync(path.join(certsDir, 'cert.pem'), pems.cert);

    console.log('Certificates created successfully in /certs');
}
generate();
