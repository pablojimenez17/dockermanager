const http = require('http');

const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    flow_id: Date.now(),
    in_iface: "eth0",
    event_type: "alert",
    src_ip: "185.15.54.12",
    src_port: 54321,
    dest_ip: "10.0.0.5",
    dest_port: 80,
    proto: "TCP",
    alert: {
        action: "allowed",
        gid: 1,
        signature_id: 2100498,
        rev: 7,
        signature: "GPL ATTACK_RESPONSE id check returned root",
        category: "Potentially Bad Traffic",
        severity: 1
    },
    http: {
        hostname: "testmyids.com",
        url: "/",
        http_user_agent: "curl/7.81.0",
        http_method: "GET",
        protocol: "HTTP/1.1",
        status: 200,
        length: 39
    },
    app_proto: "http",
    flow: {
        pkts_toserver: 4,
        pkts_toclient: 4,
        bytes_toserver: 342,
        bytes_toclient: 449,
        start: new Date(Date.now() - 1000).toISOString()
    }
});

const req = http.request({
    hostname: 'localhost',
    port: 5636,
    path: '/api/1/event',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
}, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(payload);
req.end();
