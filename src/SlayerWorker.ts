import lib from 'discord.js';
import {
    IResponse,
    RESPONSE_CODE,
    IInfo,
    IPacket,
    PACKET_TYPE,
    IMassReply,
    IMassBan,
    IMassBanResponse,
    WORKER_STATUS
} from './types';

import ws from 'ws';

class SlayerWorker extends lib.Client {
    private workerId: number;
    private workerToken: string;
    private workerDiscordId: string;
    private workerStatus: WORKER_STATUS;

    constructor(_workerId: number, _workerToken: string, _workerDiscordId: string) {
        const options: lib.ClientOptions = {
            intents: [lib.GatewayIntentBits.Guilds,
            lib.GatewayIntentBits.GuildMembers,
            lib.GatewayIntentBits.GuildMessages,
            lib.GatewayIntentBits.DirectMessages,
            lib.GatewayIntentBits.MessageContent
            ]
        };

        super(options);

        this.workerId = _workerId;
        this.workerToken = _workerToken;
        this.workerDiscordId = _workerDiscordId;
        this.workerStatus = WORKER_STATUS.FREE;

    }

    public get worker_id(): number {
        return this.workerId;
    }

    public get worker_token(): string {
        return this.workerToken;
    }

    public get worker_discord_id(): string {
        return this.workerDiscordId;
    }

    public listen(_port: number) {
        const wss: ws.Server = new ws.Server({ port: _port });
        wss.on('connection', (ws: ws.WebSocket) => {

            ws.on('message', (message: string) => {
                const jobj = JSON.parse(message);
                const packet: IPacket = {
                    type: jobj.type,
                    data: jobj.data
                }

                const info: IInfo = {
                    workerId: this.workerId,
                    workerToken: this.workerToken,
                    workerDiscordId: this.workerDiscordId,
                    workerStatus: this.workerStatus
                }

                if (packet.type == PACKET_TYPE.INFO) {
                    console.log("Received info request");
                    const response: IPacket = {
                        type: PACKET_TYPE.INFO,
                        data: info
                    }
                    ws.send(JSON.stringify(response));

                } else if (packet.type == PACKET_TYPE.MASSREPLY) {
                    console.log("Received mass reply request");
                    const reply: IMassReply = packet.data;

                    ws.send(JSON.stringify({
                        type: PACKET_TYPE.MASSREPLY,
                        data: info
                    }));

                    this.msgReply(reply.guildId, reply.channelId, reply.messageId, reply.content);

                } else if (packet.type == PACKET_TYPE.MASSBAN) {
                    console.log("Received mass ban request");
                    const massban: IMassBan = packet.data;

                    ws.send(JSON.stringify({
                        type: PACKET_TYPE.MASSBAN,
                        data: info
                    }));

                    this.massban(massban.id_whitelist, massban.guildId, massban.workerCount, massban.workerPart);
                }
            });
        });
    }

    public async sendMsg(guildId: string | undefined, channelId: string | undefined, message: string) {
        try {
            if (guildId === undefined || channelId === undefined) {
                return;
            }
            const guild = await this.guilds.fetch(guildId);
            const channel = await guild.channels.fetch(channelId);
            (channel as lib.TextChannel).send(message);
        } catch (err) {
            console.error(err);
        }

    }

    public async msgReply(guildId: string | undefined, channelId: string | undefined, msgId: string | undefined, content: string) {
        try {
            if (guildId === undefined || channelId === undefined || msgId === undefined) {
                return;
            }

            const guild = await this.guilds.fetch(guildId);
            const channel = await guild.channels.fetch(channelId);
            const message = (await channel as lib.TextChannel).messages.fetch(msgId);
            (await message).reply(content);
        } catch (err) {
            console.error(err);
        }

    }

    public async massban(id_whitelist: string[], guildId: string, workersCount: number, workerPart: number | undefined) {
        try {
            // Indepent guild information
            const guild = await this.guilds.fetch(guildId);
            const membersFetch = await guild.members.fetch();
            const memberArray = Array.from(membersFetch);
            const group = memberArray.filter((_, index) => index % workersCount === workerPart);
            const members = group;

            if (members === undefined) {
                return {
                    "code": RESPONSE_CODE.FAILURE,
                    "data": "members undefined value"
                };
            }
            let membersBanned = 0;
            let membersFailed = 0;
            const totalMembersToBan = members.length;
            console.log(`Massban Worker Id: ${this.workerId} has started\nWorker Part: ${workerPart}`);

            if (!id_whitelist.includes(this.workerDiscordId)) {
                id_whitelist.push(this.workerDiscordId);
            }

            for (const [name, member] of members) {
                if (id_whitelist.includes(member.id)) {
                    console.log(`[${this.workerId}]Ignoring user id: ${member.id} : ${member.user.username}`);
                    continue;
                }
                try {
                    await member.ban();
                    membersBanned++;
                    const membersLeft = totalMembersToBan - membersBanned;
                    console.log(`[${this.workerId}]Banned ${member.user.username}, Members left to ban: ${membersLeft}`);
                } catch (err) {
                    console.error(`[${this.workerId}]Something went wrong while trying to ban ${member.user.username}, Missing Permissions`);
                    membersFailed++;
                }
            }

            const massbanResponse: IMassBanResponse = {
                workerId: this.workerId,
                totalMembers: totalMembersToBan,
                membersBanned: membersBanned,
                membersFailed: membersFailed
            }

            console.log(`${JSON.stringify(massbanResponse, null, 2)}`);
        } catch (err) {
            console.error(err);
        }
    }
}

export default SlayerWorker;
