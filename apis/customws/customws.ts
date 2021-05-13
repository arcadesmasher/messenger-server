import * as Websocket from 'ws';

export class CustomWS {
    wss: Websocket.Server;
    wsClients: WSClient[];
}

export interface WSClient {
    eMail: string;
    wsock: Websocket;
    rooms: string[];
}