import { IChatMessage } from "./chatmessage.interface";
import { IRoomInitMessage } from "./roominitmessage.interface";
import { IRoomMessage } from "./roommessage.interface";
import { IUserOnlineMessage } from "./useronlinemessage.interface";

export interface IWSMessage {
    wsMessageType: string;
    wsMessageBody: IChatMessage | IRoomMessage | IRoomInitMessage | IUserOnlineMessage;
    wsMessageDate: string;
}