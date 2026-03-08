import Docker from 'dockerode';
const docker = new Docker();

// This is the EXACT same pattern as the fix
const pullImageSync = (image) => {
    return new Promise((resolve, reject) => {
        const onStream = (err, stream) => {
            if (err) return reject(err);
            docker.modem.followProgress(
                stream,
                (err2, output) => err2 ? reject(err2) : resolve(output),
                () => { }
            );
        };
        docker.pull(image, onStream); // No empty opts {}
    });
};

async function run() {
    try {
        console.log('Pulling wordpress:latest...');
        await pullImageSync('wordpress:latest');
        console.log('Pull complete!');
    } catch (err) {
        console.error('Pull failed:', err.message);
    }
}
run();
