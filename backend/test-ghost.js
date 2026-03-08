import Docker from 'dockerode';
const docker = new Docker();

async function run() {
    try {
        console.log('Pulling ghost:5-alpine directly...');
        docker.pull('ghost:5-alpine', (err, stream) => {
            if (err) return console.error('Outer err:', err);

            docker.modem.followProgress(
                stream,
                (err2, output) => {
                    if (err2) console.error('Follow err:', err2);
                    else console.log('Final output JSON:', JSON.stringify(output[output.length - 1]));
                    process.exit(0);
                },
                (event) => {
                    console.log('Stream event:', JSON.stringify(event));
                }
            );
        });
    } catch (err) {
        console.error('Crash:', err);
    }
}
run();
