/*
I chose to use raw queries instead of using a modeller library such as "sequelize".
Just wanted to experience how it would be by using raw queries, no other specific reason.
*/

import * as mssql from 'mssql';
import { IParam } from './param';

export class MsSqlApi {

    private sqlConfig = {
        user: "MessengerApp",
        password: "12345",
        database: "MessengerApp",
        server: 'localhost',
        pool: {
          max: 1000,
          min: 0,
          idleTimeoutMillis: 30000
        },
        options: {
          trustServerCertificate: true // change to true for local dev / self-signed certs
        }
    }

    private conn;

    constructor(){
        this.connectToDB();
    }

    private async connectToDB(){
        try {
            this.conn = await mssql.connect(this.sqlConfig);
        } catch (err) {
            console.log(err);
        }
    }

    private async runSQL(sqlQuery: string, isSP: boolean, params?: IParam[]): Promise<any> {
        let result: any;
        let request = this.conn.request();
        try {
            if(params){
                for(const param of params){
                    request.input(param.paramName, param.paramValue);
                }
            }
            if(isSP){
                result = await request.execute(sqlQuery);
            } else {
                result = await request.query(sqlQuery);                
            }
        } catch (err) {
            console.log(err);
            result = undefined;
        }
        return result;
    }

    //#region Data Control

    async checkLoginInfoTrue(eMail: string, encPass: string) : Promise<boolean> {
        let retVal = true;
        let eMailPar: IParam = { paramName: "UserEMail", paramValue: eMail};
        let passPar: IParam = { paramName: "Password", paramValue: encPass};
        let params: IParam[] = [];
        params.push(eMailPar);
        params.push(passPar);
        let query = "select 1 from Users (nolock) where userEMail = @UserEMail and userPassword = @Password";
        let result = await this.runSQL(query, false, params);
        if(!result || result.rowsAffected[0] === 0){
            retVal = false;
        }
        return retVal;
    }

    async checkIsUserOnline(eMail: string) : Promise<boolean> {
        let retVal = true;
        let eMailPar: IParam = { paramName: "UserEMail", paramValue: eMail};
        let params: IParam[] = [];
        params.push(eMailPar);
        let query = "select 1 from OnlineUsers (nolock) where eMail = @UserEMail";
        let result = await this.runSQL(query, false, params);
        if(!result || result.rowsAffected[0] === 0){
            retVal = false;
        }
        return retVal;
    }

    async selectEMailExists(eMail: string) : Promise<boolean> {
        let retVal = true;
        let param: IParam = { paramName: "UserEMail", paramValue: eMail};
        let params: IParam[] = [];
        params.push(param);
        let query = "select 1 from Users (nolock) where userEMail = @UserEMail";
        let result = await this.runSQL(query, false, params);
        if(result){
            if(result.rowsAffected[0] === 0){
                retVal = false;
            }
        } else {
            retVal = false;
        }
        return retVal;
    }

    //#endregion

    //#region Register

    async register(eMail: string, encPass: string) : Promise<boolean> {
        let retVal = true;
        let eMailPar: IParam = { paramName: "UserEMail", paramValue: eMail};
        let passPar: IParam = { paramName: "Password", paramValue: encPass};
        let params: IParam[] = [];
        params.push(eMailPar);
        params.push(passPar);
        let query = "insert Users (userEmail, userPassword) values (@UserEMail, @Password)";
        let result = await this.runSQL(query, false, params);
        if(!result || result.rowsAffected[0] === 0){
            retVal = false;
        }
        return retVal;
    }

    //#endregion

    //#region Online Users

    async insertOnlineUser(eMail: string) : Promise<boolean> {
        let retVal = true;
        let eMailPar: IParam = { paramName: "UserEMail", paramValue: eMail};
        let params: IParam[] = [];
        params.push(eMailPar);
        let query = "insert OnlineUsers (eMail) values (@UserEMail)";
        let result = await this.runSQL(query, false, params);
        if(!result || result.rowsAffected[0] === 0){
            retVal = false;
        }
        return retVal;
    }

    async deleteOnlineUser(eMail: string) : Promise<boolean> {
        let retVal = true;
        let eMailPar: IParam = { paramName: "UserEMail", paramValue: eMail};
        let params: IParam[] = [];
        params.push(eMailPar);
        let query = "delete OnlineUsers where eMail = (@UserEMail)";
        let result = await this.runSQL(query, false, params);
        if(!result){
            retVal = false;
        }
        return retVal;
    }

    //#endregion

    //#region Rooms

    async insertRoom(roomName: string, roomKey: string) : Promise<boolean> {
        let retVal = true;
        let namePar: IParam = { paramName: "RoomName", paramValue: roomName };
        let keyPar: IParam = { paramName: "RoomKey", paramValue: roomKey };
        let params: IParam[] = [];
        params.push(namePar);
        params.push(keyPar);
        let query = "insert Rooms (roomName, roomKey) values (@RoomName, @RoomKey)";
        let result = await this.runSQL(query, false, params);
        if(!result || result.rowsAffected[0] === 0){
            retVal = false;
        }
        return retVal;
    }

    async selectRoomsOfUserWithOtherParticipant(eMail: string) : Promise<any[]> {
        let retVal = [];
        let param: IParam = { paramName: "EMail", paramValue: eMail };
        let params: IParam[] = [];
        params.push(param);
        //
        let query = "select rtrim(B.eMail) 'eMail', rtrim(B.room) 'room', rTrim(C.roomName) 'roomName' ";
        query = query.concat("from UsersInRooms (nolock) A ");
        query = query.concat("inner join UsersInRooms (nolock) B on A.room = B.room and A.email <> B.email ");
        query = query.concat("inner join Rooms (nolock) C on B.room = C.roomKey ");
        query = query.concat("where A.email = @EMail");
        //
        let result = await this.runSQL(query, false, params);
        if(result){
            if(result.rowsAffected[0] !== 0){
                for(const record of result.recordset){
                    retVal.push(record);
                }
            }
        }
        return retVal;
    }

    async insertUserInRoom(email: string, room: string) : Promise<boolean> {
        let retVal = true;
        let emailPar: IParam = { paramName: "EMail", paramValue: email };
        let roomPar: IParam = { paramName: "Room", paramValue: room };
        let params: IParam[] = [];
        params.push(emailPar);
        params.push(roomPar);
        let query = "insert UsersInRooms (email, room) values (@EMail, @Room)";
        let result = await this.runSQL(query, false, params);
        if(!result || result.rowsAffected[0] === 0){
            retVal = false;
        }
        return retVal;
    }

    //#endregion

    //#region Messages

    //these date-time conversions should be applied
    //at the client side, though.
    async selectMessagesInRoom(room: string){
        let retVal = [];
        let eMailPar: IParam = { paramName: "Room", paramValue: room};
        let params: IParam[] = [];
        params.push(eMailPar);
        let query = "select rtrim(email) 'email', rtrim(message) 'message', ";
        query = query.concat("convert(char(19), createdAt, 120) 'createdAt' ");
        query = query.concat("from Messages (nolock) ");
        query = query.concat("where room = @Room ");
        query = query.concat("order by createdAt asc");
        let result = await this.runSQL(query, false, params);
        if(result){
            if(result.rowsAffected[0] !== 0){
                for(const record of result.recordset){
                    retVal.push(record);
                }
            }
        }
        return retVal;
    }

    //these date-time conversions should be applied
    //at the client side, though.
    async selectLastMessage(room: string){
        let retVal = {};
        let eMailPar: IParam = { paramName: "Room", paramValue: room};
        let params: IParam[] = [];
        params.push(eMailPar);
        let query = "select top 1 ";
        query = query.concat("rtrim(email) 'email', rtrim(message) 'message', ");
        query = query.concat("convert(char(19), createdAt, 120) 'createdAt' ");
        query = query.concat("from Messages (nolock) ");
        query = query.concat("where room = @Room ");
        query = query.concat("order by createdAt desc");
        let result = await this.runSQL(query, false, params);
        if(result){
            if(result.rowsAffected[0] !== 0){
                for(const record of result.recordset){
                    retVal = record;
                }
            }
        }
        return retVal;
    }

    async insertMessage(email: string, room: string, message: string) : Promise<boolean> {
        let retVal = true;
        let eMailPar: IParam = { paramName: "EMail", paramValue: email };
        let roomPar: IParam = { paramName: "Room", paramValue: room };
        let messagePar: IParam = { paramName: "Message", paramValue: message };
        let params: IParam[] = [];
        params.push(eMailPar);
        params.push(roomPar);
        params.push(messagePar);
        let query = "insert Messages (email, room, message) values (@EMail, @Room, @Message)";
        let result = await this.runSQL(query, false, params);
        if(!result || result.rowsAffected[0] === 0){
            retVal = false;
        }
        return retVal;
    }

    //#endregion

}