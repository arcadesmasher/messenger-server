import * as express from 'express';
import * as cors from 'cors'; 
import * as cryptojs from 'crypto-js';

import { MsSqlApi } from './mssql/mssqlApi';

export class ExpressApi {

    private app;

    constructor(private msSqlApi: MsSqlApi){
        this.initExpress();
        this.startExpress();
    }

    private initExpress(){
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({extended: true}));

        //#region HTTP requests

        this.app.get('/', (req, res) => {
            res.send('Hello World');
        });
        
        this.app.post('/register', (req, res) => {
            let eMail = req.body.eMail;
            let encPass = req.body.encPass;
            this.msSqlApi.register(eMail, encPass).then((result) => {
                if(result){
                    res.send({"registerDone": true});
                } else {
                    res.send({"registerDone": false});
                } 
            });
        });

        this.app.post('/getEMailExists', (req, res) => {
            let eMail = req.body.eMail;
            this.msSqlApi.selectEMailExists(eMail).then((result) => {
                if(result){
                    res.send({"exists": true});
                } else {
                    res.send({"exists": false});
                } 
            });
        });

        this.app.post('/checkLoginInfoTrue', (req, res) => {
            let eMail = req.body.eMail;
            let encryptedPass = cryptojs.SHA256(req.body.password).toString(cryptojs.enc.Base64);
            this.msSqlApi.checkLoginInfoTrue(eMail, encryptedPass).then((result) => {
                if(result){
                    res.send({"isTrue": true});
                } else {
                    res.send({"isTrue": false});
                } 
            });
        });

        this.app.post('/checkIsUserOnline', (req, res) => {
            let eMail = req.body.eMail;
            this.msSqlApi.checkIsUserOnline(eMail).then((result) => {
                if(result){
                    res.send({"isOnline": true});
                } else {
                    res.send({"isOnline": false});
                } 
            });
        });

        this.app.post('/getPreviousMessages', (req, res) => {
            let room = req.body.room;
            this.msSqlApi.selectMessagesInRoom(room).then((result) => {
                res.send(result);
            });
        });

        this.app.post('/getLastMessage', (req, res) => {
            let room = req.body.room;
            this.msSqlApi.selectLastMessage(room).then((result) => {
                res.send(result);
            });
        });

        //#endregion
    }

    private startExpress() {
        try {
            this.app.listen(3000);
            console.log("Messenger web API running.");
        } catch (err){
            console.log(err);
        }      
    }

}