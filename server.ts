import { CustomWSApi } from './apis/customWsApi';
import { ExpressApi } from './apis/expressApi';
import { MsSqlApi } from './apis/mssql/mssqlApi';

export class Server {

    private expressApi;
    private customWsApi;
    private msSqlApi;

    constructor(){
        this.msSqlApi = new MsSqlApi();
        this.expressApi = new ExpressApi(this.msSqlApi);
        this.customWsApi = new CustomWSApi(this.msSqlApi);
    }

}