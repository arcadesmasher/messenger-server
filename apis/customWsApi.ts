import * as WebSocket from 'ws';
import * as cryptojs from 'crypto-js';

import { CustomWS, WSClient } from './customws/customws';
import { MsSqlApi } from './mssql/mssqlApi';
import { IRoomMessage } from '../models/roommessage.interface';
import { IWSMessage } from '../models/wsmessage.interface';
import { Constants } from '../shared/constants';
import { Now } from '../shared/now';
import { IUserOnlineMessage } from '../models/useronlinemessage.interface';
import { IChatMessage } from '../models/chatmessage.interface';


export class CustomWSApi {

    private customWS: CustomWS;

    constructor(private msSqlApi: MsSqlApi){
        this.initWS();
        this.startWS();
    }

    //#region Init

    private initWS(){
        if(!this.customWS){
            this.customWS = new CustomWS();
            this.customWS.wsClients = [];
            this.customWS.wss = new WebSocket.Server({ port: 3003 });
        }
    }

    //#endregion

    //#region Start

    private startWS(){
        this.customWS.wss.on('connection', async (wsock, req) => {
            let loggedInEMail = req.url.slice(1);
            this.doInitialConnectionTasks(loggedInEMail, wsock);
            this.handleWSEvents(loggedInEMail, wsock);
        });
    }

    //#region Initial Connection Tasks

    private async doInitialConnectionTasks(mail: string, ws: WebSocket){
        await this.removeClient(mail, ws);
        await this.initClient(mail, ws);
        await this.informOtherUsersAboutUserStatus(mail, true);
    }

    private async removeClient(loggedInEMail: string, ws: WebSocket){
        let index = this.customWS.wsClients.findIndex((client) => client.eMail === loggedInEMail);
        if(index !== -1){
            //online user table delete
            let deleteResult = await this.msSqlApi.deleteOnlineUser(loggedInEMail);
            if(!deleteResult){
                console.log("User not deleted from online users: " + loggedInEMail);
                ws.close();
                return;
            }
            //remove user from memory
            this.customWS.wsClients.splice(index, 1);
        }
    }

    private async initClient(mail: string, ws: WebSocket){
        //online user table insert
        let onlineUserInsertResult = await this.msSqlApi.insertOnlineUser(mail);
        if(!onlineUserInsertResult){
            console.log("User not inserted to online users: " + mail);
            ws.close();
            return;
        }
        //gets users' current rooms
        let roomsOfUserResult = await this.msSqlApi.selectRoomsOfUserWithOtherParticipant(mail);
        if(!roomsOfUserResult){
            console.log("User's rooms were not received: " + mail);
            ws.close();
            return;
        }
        //init user & push to memory
        let wsClient: WSClient = { eMail: mail, wsock: ws, rooms: [] };
        this.customWS.wsClients.push(wsClient);
        //send user's current rooms to client
        if(roomsOfUserResult.length > 0){
            for(const room of roomsOfUserResult){
                this.assignAndPostNewRoomToRelevantClient(mail, room.eMail, room.roomName, room.room);
            }
        }

    }

    private informOtherUsersAboutUserStatus(mail: string, isOnline: boolean){
        for(const client of this.customWS.wsClients){
            if(client.eMail !== mail){
                let userOnlineMsg: IUserOnlineMessage = { eMail: mail, isOnline: isOnline };
                let wsMsg: IWSMessage = { wsMessageType: Constants.typeUserOnline, wsMessageBody: userOnlineMsg, wsMessageDate: Now.getNow() };
                client.wsock.send(JSON.stringify(wsMsg));
            }
        }
    }

    //#endregion

    //#region Handlers

    private handleWSEvents(loggedInEMail: string, ws: WebSocket){
        ws.on('message', (message) => {
            this.handleWSMessages(message.toString(), ws);
        });
        ws.on('close', () => {
            this.removeClient(loggedInEMail, ws);
            this.informOtherUsersAboutUserStatus(loggedInEMail, false);
        });
        ws.on('error', (err) => {
            console.log(err);
        });
    }

    private handleWSMessages(message: string, ws: WebSocket){
        let msg: IWSMessage = JSON.parse(message) as IWSMessage;
        switch(msg.wsMessageType){
            case Constants.typeChat:        this.doChatMessageOperations(msg, ws); break;
            case Constants.typeRoomInit:    this.openRoomForTwoParticipants(msg); break;
            default: break;
        }
    }

    //#region Chat Methods

    private async doChatMessageOperations(msg: IWSMessage, ws: WebSocket){
        await this.writeChatMessageToDB(msg, ws);
        await this.sendChatMessage(msg);
    }

    private async writeChatMessageToDB(msg: IWSMessage, ws: WebSocket){
        let chatMsg: IChatMessage = msg.wsMessageBody as IChatMessage;
        let fromEMail = chatMsg.fromEMail;
        let toRoom = chatMsg.toRoom;
        let messageText = chatMsg.messageText;
        let insertMessageResult = await this.msSqlApi.insertMessage(fromEMail, toRoom, messageText);
        if(!insertMessageResult){
            console.log("Message not inserted to messages: " + fromEMail + ", " + toRoom + ", " + messageText);
            ws.close();
            return;
        }
    }

    private sendChatMessage(msg: IWSMessage){
        let chatMsg: IChatMessage = msg.wsMessageBody as IChatMessage;
        console.log(chatMsg);
        console.log(this.customWS.wsClients)
        let room: string = chatMsg.toRoom;
        for(const client of this.customWS.wsClients){
            let index = client.rooms.findIndex((r) => r === room);
            if(index > -1){
                client.wsock.send(JSON.stringify(msg));
            }
        }
    }

    //#endregion
    
    //#region Room Methods

    private async openRoomForTwoParticipants(msg: any){
        let from = msg.wsMessageBody.fromEMail;
        let to = msg.wsMessageBody.toEMail;
        let name = Constants.opposite;
        let roomKey = this.generateRoomForTwoParticipants(from, to);
        //insert room to rooms table first
        await this.msSqlApi.insertRoom(name, roomKey);
        //then insert the users of the room to usersinrooms table
        await this.msSqlApi.insertUserInRoom(from, roomKey);
        await this.msSqlApi.insertUserInRoom(to, roomKey);
        //post the newly initialized room to both of the clients
        this.assignAndPostNewRoomToRelevantClient(from, to, name, roomKey);
        this.assignAndPostNewRoomToRelevantClient(to, from, name, roomKey);
    }

    private generateRoomForTwoParticipants(from: string, to: string) : string {
        let user1 = "", user2 = "";
        if(from < to){
            user1 = from;
            user2 = to;
        } else {
            user1 = to;
            user2 = from;
        }
        return cryptojs.SHA256(user1.concat(user2)).toString(cryptojs.enc.Base64);
    }

    private assignAndPostNewRoomToRelevantClient(from: string, to: string, roomName: string, roomKey: string){
        let clientIndex = this.customWS.wsClients.findIndex((client) => client.eMail === from);
        if(clientIndex > -1){
            let roomMsg: IRoomMessage = { roomName: roomName, toEMail: to, roomKey: roomKey };
            this.customWS.wsClients[clientIndex].rooms.push(roomMsg.roomKey);
            let wsMsg: IWSMessage = { wsMessageType: Constants.typeRoom, wsMessageBody: roomMsg, wsMessageDate: Now.getNow() };
            this.customWS.wsClients[clientIndex].wsock.send(JSON.stringify(wsMsg));
        }
    }

    //#endregion    

    //#endregion

    //#endregion

}