//import { Singleton } from "../NS3D/Singleton";
import { CFDFieldEmulator } from "./CFDField";

export class CFDFieldsHandler {
   // private static _instance: CFDFieldsHandler;
    private _CFDField: CFDFieldEmulator;

    // static Instance(): CFDFieldsHandler {
    //     CFDFieldsHandler._instance = CFDFieldsHandler._instance ?? new CFDFieldsHandler();
    //     return CFDFieldsHandler._instance;
    // }

    constructor(){
        if((<any>this)._instance)
            throw `Singleton object exist. Dont new it.`;
    }
    
    static Instance<T>( this:{ new():T}):T{
        (<any>this)._instance = (<any>this)._instance || new this();
        return (<any>this)._instance;
    }

    static get instance(): CFDFieldsHandler {
        return CFDFieldsHandler.Instance();
    }

    getCFDField(): CFDFieldEmulator | null {
        let { _CFDField } = this;
        if (_CFDField)
            return _CFDField;
        else
            return null;
    }

    setCFDField(filed:CFDFieldEmulator|null): CFDFieldEmulator|null {
        this._CFDField = filed ;
        return  this._CFDField;
    }
}