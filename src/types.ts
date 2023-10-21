enum RESPONSE_CODE {
    SUCCESS = 1,
    FAILURE = 2
}

enum PACKET_TYPE {
    INFO = 1,
    MASSREPLY = 2,
    MASSBAN = 3,
    MASSSEND = 4
}

enum WORKER_STATUS {
    FREE = "free",
    BUSY = "busy"
}

interface IPacket {
    type: PACKET_TYPE,
    data: any;
}

interface IInfo {
    workerId: number;
    workerToken: string;
    workerDiscordId: string;
    workerStatus?: WORKER_STATUS;
    workerHost?: string;
    workerPort?: number;
}

interface IMassReply {
    guildId: string;
    channelId: string;
    messageId: string;
    content: string;
}

interface IMassBan {
    guildId: string;
    workerCount: number;
    id_whitelist: string[];
    workerPart?: number;
}

interface IMassSend {
    guildId: string;
    channelId: string;
    content: string;
}

interface IResponse {
    code: number,
    data: any
}

interface IMassBanResponse {
    workerId: number,
    totalMembers: number,
    membersBanned: number,
    membersFailed: number
}

export {
    RESPONSE_CODE,
    IResponse,
    IInfo,
    IPacket,
    IMassReply,
    IMassBan,
    IMassBanResponse,
    IMassSend,
    PACKET_TYPE,
    WORKER_STATUS
}