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
    private _workers: Array<IInfo>;

    constructor() {
        this._workers = new Array<IInfo>();
    }

    public get workers(): Array<IInfo> {
        return this._workers;
    }

    public get workerCount(): number {
        return this._workers.length;
    }

    public async massSend(_masssend: IMassSend) {
        const resp: IResponse = {
            code: RESPONSE_CODE.SUCCESS,
            data: []
        }

        await this.updateWorkers();
        return new Promise((resolve, reject) => {
            try {
                let counter = 0;
                for (const worker of this.workers) {
                    const socket = new ws.WebSocket(`ws://${worker.workerHost}:${worker.workerPort}`);
                    socket.addEventListener('open', (event) => {
                        const request: IPacket = {
                            type: PACKET_TYPE.MASSSEND,
                            data: _masssend
                        }
                        socket.send(JSON.stringify(request));
                    });

                    const timeout = setTimeout(() => {
                        socket.close();
                    }, 5000);

                    socket.addEventListener('error', (event) => {
                        reject(new Error(event.message));
                    });

                    socket.addEventListener('message', (event: ws.MessageEvent) => {
                        clearTimeout(timeout);
                        const request: IPacket = JSON.parse(event.data.toString());
                        if (request.type == PACKET_TYPE.MASSSEND && request.data.workerStatus == WORKER_STATUS.FREE) {
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

    public async massReply(_massreply: IMassReply) {
        const resp: IResponse = {
            code: RESPONSE_CODE.SUCCESS,
            data: []
        }

        await this.updateWorkers();
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

                    socket.addEventListener('error', (event) => {
                        reject(new Error(event.message));
                    });

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

    public async massBan(_massban: IMassBan) {
        const resp: IResponse = {
            code: RESPONSE_CODE.SUCCESS,
            data: []
        }

        await this.updateWorkers();
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

                        const queryPacket: IPacket = {
                            type: PACKET_TYPE.MASSBAN,
                            data: _massban
                        }

                        socket.send(JSON.stringify(queryPacket));
                        _massban.workerPart++;
                    });

                    const timeout = setTimeout(() => {
                        socket.close();
                    }, 5000);

                    socket.addEventListener('error', (event) => {
                        reject(new Error(event.message));
                    });

                    socket.addEventListener('message', (event) => {
                        clearTimeout(timeout);
                        const request: IPacket = JSON.parse(event.data.toString());

                        if (request.type == PACKET_TYPE.MASSBAN && request.data.status == WORKER_STATUS.FREE) {
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
            try {
                const socket = new ws.WebSocket(`ws://${_host}:${_port}`);
                socket.addEventListener('open', (event) => {
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

                socket.addEventListener('error', (event) => {
                    reject(new Error(event.message));
                });

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
            } catch (err) {
                reject(err);
            }

        })
    }

    public async updateWorkers() {
        const workers: Array<IInfo> = this._workers;
        this._workers = null;
        this._workers = new Array<IInfo>();

        for (const worker of workers) {
            await this.connect(worker.workerHost, worker.workerPort);
        }
        return this._workers;
    }
}

export default SlayerConnector;