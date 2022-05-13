import { CFDCellParmaters } from "./CFDField";
import { Vector3 } from "nglibs-math";
interface testrecursive {
    [key: number]: testrecursive,
    bodycount: number
}

export interface fieldConstrustPara {
    points: Array<Array<number>>;
    faces: Array<Array<number>>;
    owners: Array<Array<number>>;
    cellsProps?: Array<cellsStepContent>;
    cellPropNames?: {[key:string]:boolean};
}

export interface cellsStepContent {
    timeStep: number,
    timeIndex:number,
    props: CFDCellParmaters[]
    /*speed?: number[][],
    temp?: number[],*/
}
export class CFDOpenFoam {
    // private static _instance: CFDOpenFoam;
    curFacesArray: Array<Array<number>>;
    curPointsArray: Array<Array<number>>;
    curOwnerArray: Array<Array<number>>;
    cellsContentTimeStepArray: Array<cellsStepContent>;
    cellProperties: {[k:string]:boolean};


    fileImportRegList: RegExp[];
    dirExRegList: RegExp[];

    static Instance<T>( this:{ new():T}):T{
        (<any>this)._instance = (<any>this)._instance || new this();
        return (<any>this)._instance;
    }

    public static get instance(): CFDOpenFoam {
        return CFDOpenFoam.Instance();
    }

    constructor() {
        if((<any>this)._instance)
            throw `Singleton object exist. Dont new it.`;
        this.fileImportRegList = [/faces/, /owner/, /points/, /neighbour/, /^U$/, /^T$/, /CO2/];
        this.dirExRegList = [/^0$/];
        this.cellProperties = {};
    }

    public Reset(): void {
        this.cellProperties = {};//length = 0;
    }

     /**
     * Setup CFD filed After Parsed all File needed
     */
      public AssetFor(){
        let { curFacesArray, curPointsArray, curOwnerArray, cellsContentTimeStepArray, cellProperties } = this;
        if (!curFacesArray || !curPointsArray || !curOwnerArray) return null;
        return {
            faces: curFacesArray,
            owners: curOwnerArray,
            points: curPointsArray,
            cellsProps: cellsContentTimeStepArray,
            cellPropNames: cellProperties
        };
    }

    /**
     * On files loaded callback, Sort into categoris and parsing content
     * @param dir  the directory, the time tag
     * @param type the attribut filename
     * @param buf 
     * @returns 
     */
    public onFileLoad(dir: string = ``, type: string, buf: string): boolean {
        //   let { Parser } = CFDOpenFoam.instance;
        CFDOpenFoam.instance.Parser(dir, type, buf);
        return false;
    }

    /**
     * 
     * @param rule 
     * @returns 
     */
    public FilesRulCheck(dir: string, filename: string): boolean {
        let { fileImportRegList, dirExRegList } = CFDOpenFoam.instance;
        for (let reg of dirExRegList) {
            if (reg.test(dir))
                return false;
        }
        for (let reg of fileImportRegList) {
            if (reg.test(filename))
                return true;
        }
        return false;
    }

    public Parser(dir: string, type: string, buf: string): boolean {
        //let {ParseForFaces,ParseForPoints,ParseForOwner} = CFDOpenFoam.instance;
        switch (type) {
            case 'faces':
                return this.ParseForFaces(buf);

            case 'points':
                return this.ParseForPoints(buf);

            case 'owner':
                return this.ParseForOwner(buf);

            case 'neighbour':
                return this.ParseForNeighbour(buf);

            case 'U':
                return this.ParseForVel(dir, buf);

            case 'T':
            case 'CO2':
                if (this.ParseForScalar(dir, type, buf)) {
                    this.cellProperties[type] = true;
                    return true;
                } else
                    return false;

            /*case 'CO2':
                if(this.ParseForScalar(dir, 'CO2', buf)){
                    this.cellPropertiesArray['CO2'] = 'T';
                    return true;
                }else
                    return false;*/

        }
        return true;
    }

    public ParserInitJSON(content: object,maxTimeIndex:number,indexSkip:number = 0): Promise<CFDOpenFoam> {
        return new Promise((solv, rej) => {
            if (!content["Attributes"] && !content["TimeStep"]) {
                console.debug(`Missing Paramaters...`);
                rej(this);
                return;
            }
            if (content["Attributes"]) {
                this.cellProperties = {}
                content["Attributes"].map(att => this.cellProperties[att] = false);
            }
            if (content["TimeStep"]) {
                this.cellsContentTimeStepArray = this.cellsContentTimeStepArray || new Array<cellsStepContent>();
                this.cellsContentTimeStepArray.length = 0;
                let indexSkipCount = 0;
                let indexCount = 0;

                content["TimeStep"].every( (timestep) =>{
                    if(this.cellsContentTimeStepArray.length>=maxTimeIndex)
                        return false;
                    indexSkipCount++;
                    if(indexSkipCount>indexSkip){
                        indexSkipCount = 0;
                        this._sortOutCellsStep(+timestep,indexCount);
                    }
                    indexCount++;
                    return true;
                });
                /*map(
                    (timestep) => this._sortOutCellsStep(+timestep)
                );*/
            }
            console.debug(`Atttribtes:${this.cellProperties}  TimeStep:${this.cellsContentTimeStepArray.length}`);
            solv(this);
            //return this;
        });
        //return this;
    }

    public ParserOutPutVelContentJSON(content: Array<string>, attribute: string, cellContainer: cellsStepContent)  {
       // return new Promise((sol, rej) => {
            content.map(velstr => {
                let vallist = []
                velstr.split(' ').map(val => vallist.push(+val));
                let speed = new Vector3().fromArray(vallist);//[0],vallist[1],vallist[2]);
                cellContainer.props.push({ speed: speed })
            })
        //    sol(this);
    //    });
    }
    public ParserOutPutScaleContentJSON(content: Array<string>, attribute: string, cellContainer: cellsStepContent) {
        /*return new Promise((sol, rej) => {*/
            let resList = [];
            for (let i = 0; i < content.length; i++) {
                let val = +content[i];
                resList.push(val);
                cellContainer.props[i][attribute] = val;

                cellContainer.props['max'][attribute] = cellContainer.props['max'][attribute] || val;
                if(cellContainer.props['max'][attribute] < val ) cellContainer.props['max'][attribute] = val;
                cellContainer.props['min'][attribute] = cellContainer.props['min'][attribute] || val;
                if(cellContainer.props['min'][attribute] > val ) cellContainer.props['min'][attribute] = val;                
            }
            if (resList.length) {
                resList.sort();
                let mid = resList[Math.ceil(resList.length / 2)];
                //cellContainer.props['mid'] ? 
                cellContainer.props['mid'][attribute] = mid ;
                //cellContainer.props['mid'] = { [attribute]: mid };
            }    
            this.cellProperties[attribute] = true;                      
        //     sol(this);
        // })
    }

    public ParserConstantJSON(content: object): Promise<CFDOpenFoam> {
        return new Promise((sol, rej) => {
            if (content["faces"]) {
                if (this.curFacesArray)
                    this.curFacesArray.length = 0;
                else {
                    this.curFacesArray = new Array<number[]>();
                }
                let { curFacesArray } = this;
                this.ParseForNumbersArray(content["faces"], curFacesArray);
                console.debug(`Parsing faces Number: ${curFacesArray.length}`);
            };
            if (content["points"]) {
                if (this.curPointsArray)
                    this.curPointsArray.length = 0;
                else {
                    this.curPointsArray = new Array<number[]>();
                }
                let { curPointsArray } = this;
                this.ParseForNumbersArray(content["points"], this.curPointsArray);
                console.debug(`Parsing points Number: ${curPointsArray.length}`);
            };
            if (content["owners"]) {
                this.ParseForOwnerArray(content["owners"]);
                console.debug(`After Parsing Owner: ${this.curOwnerArray.length}`);
            };
            if (content["neighbours"]) {
                this.ParseForOwnerArray(content["neighbours"]);
                console.debug(`After Parsing Neighbour: ${this.curOwnerArray.length}`);
            };
            sol(this);
        });
    }
    public ParseForNumbersArray(contents: Array<string>, resArray: number[][]) {

        contents.map((faceStr) => {
            let face = new Array<number>();
            faceStr.split(' ').map((indexstr) => {
                face.push(+indexstr);
            });
            resArray.push(face);
        });
    }

    public ParseForOwnerArray(contents: Array<string>) {
        if (!this.curOwnerArray) {
            this.curOwnerArray = Array<number[]>();
        }
        let { curOwnerArray } = this;
        for (let i = 0; i < contents.length; i++) {
            let index = +contents[i];
            curOwnerArray[index] = curOwnerArray[index] || new Array<number>();
            curOwnerArray[index].push(i);
        }
    }

    public ParseForFaces(buf: string): boolean {
        //let { curFacesArray } = this;
        if (this.curFacesArray)
            this.curFacesArray.length = 0;
        else {
            this.curFacesArray = new Array<number[]>();
        }
        let { curFacesArray } = this;
        let regex = /faces/;
        if (!regex.test(buf))
            return false;
        //regex = /.+\n\((\n.+)+/;

        // Find OUT Face array
        regex = /.\(.+\)/g;

        let facesArray = buf.match(regex);
        facesArray.forEach(faceContent => {
            let face = new Array<number>();
            let repReg = /.\(/g;
            faceContent.replace(repReg, "").replace(/\)/, "").split(/\s/).forEach(findex =>
                face.push(+findex)
            );
            curFacesArray.push(face);
        });
        return true;
    }


    public ParseForPoints(buf: string): boolean {

        if (this.curPointsArray)
            this.curPointsArray.length = 0;
        else {
            this.curPointsArray = new Array<number[]>();
        }
        let { curPointsArray } = this;
        let regex = /points/;
        if (!regex.test(buf))
            return false;
        //regex = /.+\n\((\n.+)+/;

        // Find OUT Face array
        regex = /\n\(.+\)/g;

        let facesArray = buf.match(regex);
        facesArray.forEach(faceContent => {
            let point = new Array<number>();
            let repReg = /\n\(/;
            faceContent.replace(repReg, "").replace(/\)/, "").split(/\s/).forEach(findex =>
                point.push(+findex)
            );
            curPointsArray.push(point);
        });
        console.debug(`Created Points : ${curPointsArray.length}`);
        return true;
    }

    private _sortOutCellsStep(timeStep: number,timeindex:number = 0): cellsStepContent {
        if (!this.cellsContentTimeStepArray)
            this.cellsContentTimeStepArray = new Array<cellsStepContent>();

        let { cellsContentTimeStepArray } = this;

        let newCellsStepContent: cellsStepContent;
        let insertindex: number = 0;
        for (let cells of cellsContentTimeStepArray) {
            if (cells.timeStep === timeStep) {
                newCellsStepContent = cells;
                break;
            }
            if (cells.timeStep < timeStep)
                insertindex++;
        }
        if (!newCellsStepContent) {
            newCellsStepContent = {
                timeStep: timeStep,
                timeIndex: timeindex,
                props: [],
            }
            // need sorting here......
            cellsContentTimeStepArray.splice(insertindex, 0, newCellsStepContent);
            newCellsStepContent.props['max'] = {};
            newCellsStepContent.props['min'] = {};
            newCellsStepContent.props['mid'] = {};
        }
        return newCellsStepContent;
    }

    /*public ParseForT(timeStep: string, buf: string): boolean {
        console.debug(`Parsing Temp:${timeStep}`)
        let regex = /volScalarField/;
        if (!regex.test(buf))
            return false;

        //get the time cells
        let newCellsStepContent = this._sortOutCellsStep(Number(timeStep));

        // Find OUT Temp
        regex = /\((\n.+)+/;
        let tempsArray = buf.match(regex);
        if (tempsArray == null) return false;
        let tempslist = new Array<number>();
        //newCellsStepContent.temp = tempslist;
        let repReg = /\(/;
        let tempindex = 0;
        tempsArray[0].replace(repReg, "").replace(/\)/, "").split(/\n/).forEach(res => {
            if (res) {
                let cellPorp = newCellsStepContent.props[tempindex];
                if (!cellPorp) {
                    let type = "T";// why???
                    newCellsStepContent.props[tempindex] = { speed: new Vector3(), [type]: +res };
                } else {
                    //let type = "T";// why???
                    cellPorp['T'] = +res;
                }
                // tempslist.push(+res);
                tempindex++;
                ;
            }
        }
        );
        return true;
    }*/

    public ParseForScalar(timeStep: string, typename: string, buf: string): boolean {
        console.debug(`Parsing Scalar:${typename}`)
        let regex = /volScalarField/;
        if (!regex.test(buf))
            return false;

        //get the time cells
        let newCellsStepContent = this._sortOutCellsStep(Number(timeStep));

        // Find OUT Temp
        regex = /\((\n.+)+/;
        let scalarsArray = buf.match(regex);
        if (scalarsArray == null) return false;
        //let tempslist = new Array<number>();
        //newCellsStepContent.temp = tempslist;
        let repReg = /\(/;
        let tempindex = 0;
        let resList: number[] = [];
        scalarsArray[0].replace(repReg, "").replace(/\)/, "").split(/\n/).forEach(res => {
            if (res) {
                let cellPorp = newCellsStepContent.props[tempindex];
                let val = +res;
                resList.push(val);
                if (!cellPorp) {
                    newCellsStepContent.props[tempindex] = { speed: new Vector3(), [typename]: val };
                } else {
                    cellPorp[typename] = val;
                }
                // tempslist.push(+res);
                tempindex++;
                // check max min...
                if (!newCellsStepContent.props['max'][typename] || newCellsStepContent.props['max'][typename] < val)
                    newCellsStepContent.props['max'][typename] = val;
                if (!newCellsStepContent.props['min'][typename] || newCellsStepContent.props['min'][typename] > val)
                    newCellsStepContent.props['min'][typename] = val;
                ;
            }
        }
        );
        if (resList.length) {
            resList.sort();
            let mid = resList[Math.ceil(resList.length / 2)];
            newCellsStepContent.props['mid'] ? newCellsStepContent.props['mid'][typename] = mid :
                newCellsStepContent.props['mid'] = { [typename]: mid };
        }

        return true;
    }

    public ParseForVel(timeStep: string, buf: string): boolean {
        console.debug(`Parsing Vel:${timeStep}`);
        let regex = /volVectorField/;
        if (!regex.test(buf))
            return false;

        let newCellsStepContent = this._sortOutCellsStep(Number(timeStep),0); // wait to fixe 0....

        //newCellsStepContent.speed = new Array<Array<number>>();
        // let newCellsStepContent: cellsStepContent = {
        //     timeStep: Number(timeStep),
        //     speed: new Array<Array<number>>()
        // }

        //regex = /.+\n\((\n.+)+/;

        // Find OUT Face array
        regex = /\n\(.+\)/g;
        let facesArray = buf.match(regex);
        let cellindex = 0;
        facesArray.forEach(faceContent => {
            let point = new Array<number>();
            let repReg = /\n\(/;
            faceContent.replace(repReg, "").replace(/\)/, "").split(/\s/).forEach(findex =>
                point.push(+findex)
            );
            let cellPorp = newCellsStepContent.props[cellindex];
            if (!cellPorp) {
                newCellsStepContent.props[cellindex] = { speed: new Vector3().fromArray(point, 0) };
            } else {
                cellPorp.speed.fromArray(point, 0);
            }
            // tempslist.push(+res);
            cellindex++;
            //newCellsStepContent.speed.push(point);
        });
        return true;
    }

    public ParseForOwner(buf: string, fileCheckRegExp: RegExp = /./): boolean {
        if (!this.curOwnerArray) {
            this.curOwnerArray = Array<number[]>();
        }
        let { curOwnerArray } = this;
        //let regex = /owner/;
        if (!fileCheckRegExp.test(buf))
            return false;
        // Find OUT Owner array
        let regex = /\((\n.+)+/;

        let fownerArray = buf.match(regex);
        if (fownerArray == null) return false;
        let fownerlist = new Array<number>();
        let repReg = /\(/;
        fownerArray[0].replace(repReg, "").replace(/\)/, "").split(/\n/).forEach(res => {
            if (res) {
                let celindex: number = +res;
                if (curOwnerArray[celindex] == undefined)
                    curOwnerArray[celindex] = new Array<number>();
                curOwnerArray[celindex].push(fownerlist.length);
                fownerlist.push(celindex);
            }
        }
        );
        console.debug(`Created Owner : ${fownerlist.length}`);
        return true;
    }
    public ParseForNeighbour(buf: string): boolean {
        return this.ParseForOwner(buf, /neighbour/);
    }
}


