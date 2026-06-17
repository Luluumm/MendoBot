import http from 'http';

export async function getNgrokTunnel(): Promise<string | null> {
    return new Promise((resolve) => {
        http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
            let body = '';

            res.on('data', chunk => body += chunk);

            res.on('end', () => {
                try {
                    const json = JSON.parse(body);

                    const tunnel = json.tunnels?.find(
                        (t: any) => t.proto === 'tcp'
                    );

                    resolve(tunnel?.public_url ?? null);
                } catch {
                    resolve(null);
                }
            });
        }).on('error', () => {
            resolve(null);
        });
    });
}