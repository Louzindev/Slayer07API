import {
  IInfo,
  IMassBan,
  IMassReply,
  IMassSend,
  IPacket,
  IResponse,
  PACKET_TYPE,
  RESPONSE_CODE,
  WORKER_STATUS,
} from "./types";

import ws from "ws";

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

  public async sendPacket(packet: IPacket, worker: IInfo): Promise<IInfo> {
    return new Promise((resolve, reject) => {
      try {
        const socket: ws.WebSocket = new ws.WebSocket(
          `ws://${worker.workerHost}:${worker.workerPort}`,
        );

        socket.addEventListener("open", (event) => {
          if (packet.type == PACKET_TYPE.MASSBAN) {
            if (packet.data.workerPart == undefined) {
              packet.data.workerPart = 0;
            }
            socket.send(JSON.stringify(packet));
            packet.data.workerPart++;
          } else {
            socket.send(JSON.stringify(packet));
          }
        });
        socket.addEventListener("error", (event) => {
          reject(new Error(event.message));
        });

        const timeout = setTimeout(() => {
          reject(new Error("Connection timed out."));
          socket.close();
        }, 5000);

        socket.addEventListener("message", (event: ws.MessageEvent) => {
          clearTimeout(timeout);
          const request: IPacket = JSON.parse(event.data.toString());
          if (
            request.type == packet.type &&
            request.data.workerStatus == WORKER_STATUS.FREE
          ) {
            resolve(worker);
          }
          socket.close();
        });
      } catch (err) {
        reject(new Error(err));
      }
    });
  }
  public async sendBroadcastPacket(packet: IPacket): Promise<IResponse> {
    const resp: IResponse = {
      code: RESPONSE_CODE.SUCCESS,
      data: new Array<IInfo>(),
    };

    await this.updateWorkers();
    return new Promise((resolve, reject) => {
      try {
        let counter = 0;
        for (const worker of this._workers) {
          this.sendPacket(packet, worker)
            .then((info: IInfo) => {
              resp.data.push(info);
              counter++;
              if (counter == this.workerCount) {
                resolve(resp);
              }
            })
            .catch((err) => {
              console.log(err);
            });
        }
      } catch (err) {
        resp.code = RESPONSE_CODE.FAILURE;
        reject(new Error(err));
      }
    });
  }

  public connect(_host: string, _port: number): Promise<IInfo> {
    return new Promise((resolve, reject) => {
      try {
        const socket = new ws.WebSocket(`ws://${_host}:${_port}`);
        socket.addEventListener("open", (event) => {
          const request: IPacket = {
            type: PACKET_TYPE.INFO,
            data: "",
          };
          socket.send(JSON.stringify(request));
        });
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
          socket.close();
        }, 5000);

        socket.addEventListener("error", (event) => {
          reject(new Error(event.message));
        });

        socket.addEventListener("message", (event) => {
          clearTimeout(timeout);
          const received = JSON.parse(event.data.toString());
          const info: IInfo = received.data;
          if (this._workers.length > 0) {
            for (const worker of this._workers) {
              if (
                worker.workerId == info.workerId ||
                worker.workerDiscordId == info.workerDiscordId ||
                worker.workerToken == info.workerToken
              ) {
                reject(new Error("Worker already exists"));
              } else {
                info.workerHost = _host;
                info.workerPort = _port;
                this._workers.push(info);
                socket.close();
                resolve(info);
              }
            }
          } else {
            info.workerHost = _host;
            info.workerPort = _port;
            this._workers.push(info);
            socket.close();
            resolve(info);
          }



        });
      } catch (err) {
        reject(err);
      }
    });
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
