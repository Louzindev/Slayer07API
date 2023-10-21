import lib from 'discord.js';

import {
    IResponse,
    RESPONSE_CODE,
    IInfo,
    IPacket,
    PACKET_TYPE,
    IMassBan,
    IMassReply,
    IMassSend,
    WORKER_STATUS
} from './types';

import ws from 'ws';

class SlayerConnector {
    private workers: Array<IInfo>;

    constructor() {
        this.workers = new Array<IInfo>();
    }

    public get workerCount(): number {
        return this.workers.length;
    }

    private getPacketType(packet): PACKET_TYPE {
        return PACKET_TYPE.INFO;
    }

    public async send<T>(packet: T, onOpen?: (socket: ws.WebSocket, request: T) => void): Promise<IResponse> {
        const resp: IResponse = {
            code: RESPONSE_CODE.SUCCESS,
            data: []
        }

        return new Promise<IResponse>((resolve, reject) => {
            try {
                this.updateWorkers().then((workers) => {
                    let counter = 0;
                    for (const worker of workers) {
                        const socket = new ws.WebSocket(`ws://${worker.workerHost}:${worker.workerPort}`);
                        socket.addEventListener('open', (event) => {
                            onOpen(socket, packet);
                        });

                        const timeout = setTimeout(() => {
                            socket.close();
                        }, 5000);


                        socket.addEventListener('message', (event: ws.MessageEvent) => {
                            clearTimeout(timeout);
                            const request: IPacket = JSON.parse(event.data.toString());
                            if (request.type == PACKET_TYPE.MASSREPLY && request.data.workerStatus == WORKER_STATUS.FREE) {
                                resp.data.push(worker);
                            }
                            counter++;
                            if (counter == this.workers.length) {
                                resolve(resp);
                            }
                            socket.close();
                        });
                    }
                });
            } catch (err) {

            };
        });
    }

    public massReply(_massreply: IMassReply) {
        const resp: IResponse = {
            code: RESPONSE_CODE.SUCCESS,
            data: []
        }

        return new Promise((resolve, reject) => {
            try {
                let counter = 0;
                for (const worker of this.workers) {
                    const socket = new ws.WebSocket(`ws://${worker.workerHost}:${worker.workerPort}`);
                    socket.addEventListener('open', (event) => {
                        const request: IPacket = {
                            type: PACKET_TYPE.MASSREPLY,
                            data: _massreply
                        }
                        socket.send(JSON.stringify(request));
                    });

                    const timeout = setTimeout(() => {
                        socket.close();
                    }, 5000);

                    socket.addEventListener('message', (event: ws.MessageEvent) => {
                        clearTimeout(timeout);
                        const request: IPacket = JSON.parse(event.data.toString());
                        if (request.type == PACKET_TYPE.MASSREPLY && request.data.workerStatus == WORKER_STATUS.FREE) {
                            resp.data.push(worker);
                        }
                        counter++;
                        if (counter == this.workers.length) {
                            resolve(resp);
                        }
                        socket.close();
                    });
                }
            } catch (err) {
                resp.code = RESPONSE_CODE.FAILURE;
                resp.data = err;
                reject(resp);
            }
        });

    }

    public massBan(_massban: IMassBan) {
        const resp: IResponse = {
            code: RESPONSE_CODE.SUCCESS,
            data: []
        }

        return new Promise((resolve, reject) => {
            try {
                for (const worker of this.workers) {
                    _massban.id_whitelist.push(worker.workerDiscordId);
                }

                _massban.workerCount = this.workers.length;
                let counter = 0;
                for (const worker of this.workers) {
                    const socket = new ws.WebSocket(`ws://${worker.workerHost}:${worker.workerPort}`);
                    socket.addEventListener('open', (event) => {
                        if (_massban.workerPart == undefined) {
                            _massban.workerPart = 0;
                        }
                        socket.send(JSON.stringify(_massban));
                        _massban.workerPart++;
                    });

                    const timeout = setTimeout(() => {
                        socket.close();
                    }, 5000);

                    socket.addEventListener('message', (event) => {
                        clearTimeout(timeout);
                        const request: IPacket = JSON.parse(event.data.toString());

                        if (request.type == PACKET_TYPE.MASSREPLY || request.data.status == WORKER_STATUS.FREE) {
                            resp.data.push(worker);
                        }
                        counter++;
                        if (this.workers.length == counter) {
                            resolve(resp);
                        }
                        socket.close();
                    });

                }
            } catch (err) {
                resp.code = RESPONSE_CODE.FAILURE;
                resp.data = err;
                reject(resp);
            }
        });


    }

    public connect(_host: string, _port: number): Promise<IInfo> {
        return new Promise((resolve, reject) => {
            const socket = new ws.WebSocket(`ws://${_host}:${_port}`);
            socket.addEventListener('open', (event) => {
                console.log('stablished connection in %s:%d', _host, _port);

                const request: IPacket = {
                    type: PACKET_TYPE.INFO,
                    data: ""
                }
                socket.send(JSON.stringify(request));
            });
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
                socket.close();
            }, 5000);

            socket.addEventListener('message', (event) => {
                clearTimeout(timeout);
                const received = JSON.parse(event.data.toString());
                const info: IInfo = received.data;

                for (const worker of this.workers) {
                    if (worker.workerId == info.workerId || worker.workerDiscordId == info.workerDiscordId || worker.workerToken == info.workerToken) {
                        reject(new Error('Worker already exists'));
                    }
                }

                info.workerHost = _host;
                info.workerPort = _port;
                this.workers.push(info);
                socket.close();
                resolve(info);
            });
        })
    }

    private async updateWorkers() {
        for (const worker of this.workers) {
            await this.connect(worker.workerHost, worker.workerPort);
        }
        return this.workers;
    }
}

export default SlayerConnector;