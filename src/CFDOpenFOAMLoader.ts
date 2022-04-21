import { CFDOpenFoam } from './CFDOpenFoam'
import axios from 'axios';

export default class CFDOpenFoamLoader {
    url: URL;
    userName:string;
    caseID:string;
    routes:string = `routes/`;
    cmdGetTimesAtt: string = "/timeAndAttributes";;
    cmdGetConst: string = "/constData";
    cmdGetContent: string = "/outputData";
    constructor(url: URL) {
        this.url = url;
    };

    buildPath(cmd:string):string{
        let {routes,userName,caseID} = this;
        return routes+userName+`/`+ caseID+cmd;
    }

    StartLoadAttrbuteCall(attr: string,timeClipCall, prog?: (val) => void): Promise<CFDOpenFoam> {
        try {
            CFDOpenFoam.Instance().cellProperties[attr];
        } catch (err) {
            console.debug(`${attr} not wthin OpenFoam content properties`);
        }
        let { url, cmdGetContent } = this;
        url.pathname = this.buildPath(cmdGetContent);
        return new Promise((sol, rej) => {
            console.debug(`Start Download: ${attr}...`);
            let prolist = [];
            let timeout = 0;
            let timegap = 300;
            let timeindex = 0;
            url.searchParams.set(attr, 'true');
            CFDOpenFoam.Instance().cellsContentTimeStepArray.forEach(
                TimeClip => {
                    prolist.push(
                        new Promise((isol) => {
                            setTimeout(() => {
                                let curtmeindex = timeindex; timeindex++;
                                url.searchParams.set('timeIndex', curtmeindex.toString());
                                console.debug(`Start ${attr} download...., timeindex: ${curtmeindex}`);
                                axios.get(url.href).then(result => {
                                    console.debug(`${attr} done! timeindex: ${curtmeindex}`);
                                    timeClipCall(result.data[attr], attr, TimeClip);
                                    if (prog)
                                            prog(1);
                                    isol(result);
                                })
                            }, timeout);
                            timeout += timegap;
                        })
                    )               
                });
            Promise.all(prolist).then(val => {
                url.searchParams.set(attr, 'false');
                console.debug(`${attr} download complete: ${timeindex}`);
                sol(CFDOpenFoam.Instance());               
            });
        })
    }

    StartLoadInitConstInfo(prog?: (val) => void): Promise<CFDOpenFoam> {
        let { url, cmdGetTimesAtt, cmdGetConst } = this;
        return new Promise((sol, rej) => {
            console.debug('Start Download TimesAtts/Const....');
            let prosList = [];
            url.pathname = this.buildPath(cmdGetTimesAtt);
            prosList.push(axios.get(url.href, {
                // onDownloadProgress: p => {
                //     let percent = (p.loaded / p.total);
                //     progressbar.value = percent * 50;
                //     console.debug(`loading vel: ${percent}`);
                // }
            }).then(result => {
                console.debug('download Time Attributd completed!');
                console.debug(result.data, toString);
                prog!(1);
                return CFDOpenFoam.Instance().ParserInitJSON(result.data);
            }));
            url.pathname = this.buildPath(cmdGetConst);
            prosList.push(axios.get(url.href).then(result => {
                console.debug('download Const completed!');
                console.debug(result.data, toString);
                prog!(1);
                return CFDOpenFoam.Instance().ParserConstantJSON(result.data);
            }));
            Promise.all(prosList).then(val => { sol(CFDOpenFoam.Instance()) });
        });
    }

    StartLoadAttrbute(attr: string, prog?: (val) => void): Promise<CFDOpenFoam> {        
        return this.StartLoadAttrbuteCall(attr,
            (res,attrs,tclip)=>CFDOpenFoam.Instance().ParserOutPutScaleContentJSON(res,attrs,tclip)            
            ,prog);
    }

    StartLoadVel(prog?: (val) => void): Promise<CFDOpenFoam> {
        let attr = 'velocity';
        return this.StartLoadAttrbuteCall(attr,
            (res,attrs,tclip)=>CFDOpenFoam.Instance().ParserOutPutVelContentJSON(res,attrs,tclip)            
            ,prog);        
    }
}