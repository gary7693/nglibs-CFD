
import { Vector3,Color } from "nglibs-math";
export const _fiedxUpdateTime: number = 30;
export enum CFDParaOption{
    normal,
    simple
}
export interface CFDFieldEmulator {
    Emulate(posIn: Vector3, velout: CFDCellParmaters, option:CFDParaOption,sampleRange:number): boolean;
    ColorPresnt?(property:string,value:number,colorOut?:Color):Color;
    PickParameter?(cellindex: number, velout: CFDCellParmaters): boolean;
    //colorTables?:{[key:string]:ColorTable},
    //colorTable?:ColorTable,
    cells?:CFDCellProps[],
    cellsPropRange?:{[key:string]:{max:number,min:number}}
}

export interface CFDCellParmaters {
    speed: Vector3;
}

export interface CFDCellProps {
    pos: Vector3,
    vol?: number,
}
export class CFDFieldDummy implements CFDFieldEmulator {
    Emulate(pos: Vector3, out: CFDCellParmaters): boolean {
        let ang = Math.PI / 2;
        if (pos.x > 0.001) {
            ang = Math.atan(pos.y / pos.x);
        } else {
            if (pos.x < -0.001) {
                ang = Math.atan(pos.y / pos.x) + Math.PI;
            }
        }
        let len = Math.sqrt(pos.y * pos.y + pos.x * pos.x);
        let zVfactor = Math.min(100, len);
        zVfactor = (10000 - zVfactor * zVfactor) / 10000;
        let velout = out["speed"];
        velout.x = len * zVfactor * Math.cos(ang - Math.PI / 2) + 1;
        velout.y = len * zVfactor * Math.sin(ang - Math.PI / 2) + 1;

        velout.z = (pos.z / 3) * zVfactor + 10;

        if (out["T"] != null) {
            out["T"] = pos.z / 3;
            out["T"] += (pos.x * pos.x + pos.y * pos.y) / 100;
        }
        return true;
    }
}