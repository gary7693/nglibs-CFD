import { CFDOpenFoam } from './CFDOpenFoam'
import axios from 'axios';
//import JSZip from 'jszip';
const DefMaxTimeIndex = 30;
export class CFDOpenFoamLoader {
    url: URL;
    userName: string;
    caseID: string;
    routes: string = `routes/`;
    cmdGetTimesAtt: string = "/timeAndAttributes";
    cmdGetConst: string = "/constData";
    cmdGetContent: string = "/outputData";
    maxTimeIndex: number = DefMaxTimeIndex;
    timeIndexSkip: number = 0;
    constructor(url: URL) {
        this.url = url;
    };

    buildPath(cmd: string): string {
        let { routes, userName, caseID } = this;
        return routes + userName + `/` + caseID + cmd;
    }

    StartLoadAttrbuteCall(attr: string, timeClipCall, timegap: number, prog?: (val) => void): Promise<CFDOpenFoam> {
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
            //let timegap = 30000;
            let timeindex = 0;
            url.searchParams.set(attr, 'true');
            CFDOpenFoam.Instance().cellsContentTimeStepArray.forEach(
                TimeClip => {
                    prolist.push(
                        new Promise((isol) => {
                            setTimeout(() => {
                                let curtmeindex = TimeClip.timeIndex;//timeindex; timeindex++;
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
                return CFDOpenFoam.Instance().ParserInitJSON(result.data, this.maxTimeIndex, this.timeIndexSkip);
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

    StartLoadAttrbute(attr: string, timegap: number = 200, prog?: (val) => void): Promise<CFDOpenFoam> {
        return this.StartLoadAttrbuteCall(attr,
            (res, attrs, tclip) => CFDOpenFoam.Instance().ParserOutPutScaleContentJSON(res, attrs, tclip), timegap
            , prog);
    }

    StartLoadVel(timegap: number = 300, prog?: (val) => void): Promise<CFDOpenFoam> {
        let attr = 'velocity';
        return this.StartLoadAttrbuteCall(attr,
            (res, attrs, tclip) => CFDOpenFoam.Instance().ParserOutPutVelContentJSON(res, attrs, tclip), timegap
            , prog);
    }
}


// export class CFDOpenFoamLoaderZip {
//     path: string;
//     maxTimeIndex: number = DefMaxTimeIndex;
//     timeIndexSkip: number = 0;
//     zip: JSZip;
//     constructor(path?: string) {
//         if (path != undefined)
//             this.path = path;
//         this.zip = new JSZip();
//     };

//     LoadZipAsync(newurl?: string) {
//         let { path, zip } = this;
//         if (newurl)
//             path = newurl;
//         // fetch(url.href).then(res => {
//         //     if (res.status === 200 || res.status === 0) {
//         //         return Promise.resolve(res.blob);
//         //     }
//         // }).then(
//         //     blob => {
//         //         zip.loadAsync(blob);
//         //     }          
//         // );

//         fetch(path)       // 1) fetch the url
//             .then(function (response) {                       // 2) filter on 200 OK
//                 if (response.status === 200 || response.status === 0) {
//                     console.debug("Loading ZIP completed, then...");
//                     return Promise.resolve(response.blob());
//                 } else {
//                     return Promise.reject(new Error(response.statusText));
//                 }
//             })
//             .then(JSZip.loadAsync)                            // 3) chain with the zip promise
//             .then(function (zip) {
//                 return zip.file("Hello.txt").async("string"); // 4) chain with the text content promise
//             })
//             .then(function success(text) {                    // 5) display the result
//                 $("#fetch").append($("<p>", {
//                     "class": "alert alert-success",
//                     text: "loaded, content = " + text
//                 }));
//             }, function error(e) {
//                 $("#fetch").append($("<p>", {
//                     "class": "alert alert-danger",
//                     text: e
//                 }));
//             });
//     }
// }

export class CFDOpenFoamLoaderLocal {
    path: string;
    //userName: string;
    //caseID: string;
    cmdGetTimesAtt: string = "/TimeAttrConfig.json";
    cmdGetConst: string = "/constant/polyMesh"
    maxTimeIndex: number = DefMaxTimeIndex;
    timeIndexSkip: number = 0;
    constructor(path: string = "/asset") {
        this.path = path;
    };

    StartLoadConfig(timeSkip: number = 0, prog?: (val) => void): Promise<CFDOpenFoam> {
        return new Promise<CFDOpenFoam>((sol, rej) => {
            this.StartLoadInitConstInfo(prog).then(config => {
                this.StartLoadConstInfo(prog).then(res => {
                    let prolist = [];
                    prolist.push(this.StartLoadVel(timeSkip, prog));
                    config.Attributes.forEach(attr => {
                        if (attr != 'U') {
                            prolist.push(this.StartLoadAttrbuteCall(attr, timeSkip, prog));
                        }
                    });
                    Promise.all(prolist).then(val => {
                        sol(CFDOpenFoam.Instance());
                    });
                }).catch(err => rej(err));
            });
        });
    }

    StartLoadAttrbuteCall(attr: string, timeSkip: number = 0, prog?: (val) => void): Promise<CFDOpenFoam> {
        try {
            CFDOpenFoam.Instance().cellProperties[attr];
        } catch (err) {
            console.debug(`${attr} not wthin OpenFoam content properties`);
        }
        let { path } = this;
        return new Promise((sol, rej) => {
            console.debug(`Start Download: ${attr}...`);
            let prolist = [];
            let timeout = 0;
            //let timegap = 30000;
            let timeindex = 0;
            CFDOpenFoam.Instance().cellsContentTimeStepArray.forEach(
                TimeClip => {
                    prolist.push(
                        new Promise((isol) => {
                            console.debug(`Start Download ${attr} within timestep ${TimeClip.timeStep}....`);
                            let timeclipfolder = `/${TimeClip.timeStep}`;
                            fetch(path + timeclipfolder + `/${attr}`).then(response => {
                                if (response.status === 200 || response.status === 0) {
                                    console.debug(`Loaded  ${attr} `);
                                    return response.text();
                                } else {
                                    console.debug("Loading Attr in Time Field failed!");
                                    rej(response.statusText);
                                }
                            }).then(textConrtent => {
                                CFDOpenFoam.Instance().ParseForScalar(TimeClip.timeStep.toString(), attr, textConrtent);
                                if (prog)
                                    prog(1);
                                isol(CFDOpenFoam.Instance());
                            });
                            //timeout += timegap;
                        })
                    );
                    timeindex++;
                });
            Promise.all(prolist).then(val => {
                console.debug(`${attr} download complete: ${timeindex}`);
                sol(CFDOpenFoam.Instance());
            });
        })
    }

    StartLoadVel(timeSkip: number = 0, prog?: (val) => void): Promise<CFDOpenFoam> {

        let { path } = this;
        return new Promise((sol, rej) => {
            console.debug(`Start Download Vel...`);
            let prolist = [];
            let timeout = 0;
            //let timegap = 30000;
            let timeindex = 0;
            CFDOpenFoam.Instance().cellsContentTimeStepArray.forEach(
                TimeClip => {
                    prolist.push(
                        new Promise((isol) => {
                            console.debug(`Start Download Vel within timestep ${TimeClip.timeStep}....`);
                            let timeclipfolder = `/${TimeClip.timeStep}`;
                            fetch(path + timeclipfolder + `/U`).then(response => {
                                if (response.status === 200 || response.status === 0) {
                                    console.debug("Loaded Vel.");
                                    return response.text();
                                } else {
                                    console.debug("Loading Vel within Time Field failed!");
                                    rej(response.statusText);
                                }
                            }).then(textConrtent => {
                                CFDOpenFoam.Instance().ParseForVel(TimeClip.timeStep.toString(), textConrtent);
                                if (prog)
                                    prog(1);
                                isol(CFDOpenFoam.Instance());
                            });
                            //timeout += timegap;
                        })
                    );
                    timeindex++;
                });
            Promise.all(prolist).then(val => {
                console.debug(`Vel download complete: ${timeindex}`);
                sol(CFDOpenFoam.Instance());
            });
        })
    }

    StartLoadInitConstInfo(prog?: (val) => void): Promise<any> {
        let defaultConfig = () => {
            return new Promise(sol => {
                sol({
                    "TimeStep": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
                    "Attributes": ["U", "T"],
                    "name": "default"
                });
            });
        }
        let { path, cmdGetTimesAtt } = this;

        return new Promise((sol, rej) => {
            console.debug('Start Download Time And Attributes init filed....');
            fetch(path + cmdGetTimesAtt)
                .then(function (response) {                       // 2) filter on 200 OK
                    if (response.status === 200 || response.status === 0) {
                        console.debug("Loaded Time And Attributes init filed...");
                        return response.json();
                    } else {
                        console.debug("Loading Config Failed, create a default one!");
                        return defaultConfig();
                    }
                }).then(res => {
                    console.debug(res);
                    if (prog)
                        prog(1);
                    CFDOpenFoam.Instance().ParserInitJSON(res, this.maxTimeIndex, this.timeIndexSkip);
                    sol(res)
                }
                );
        });
    }

    StartLoadConstInfo(prog?: (val) => void): Promise<any> {
        let { path, cmdGetConst } = this;

        return new Promise((sol, rej) => {
            console.debug('Start Download Const info....');
            let promislist = [];

            promislist.push(this.StartLoadConstFaces(prog));
            promislist.push(this.StartLoadConstOwner(prog));
            promislist.push(this.StartLoadConstNeighbour(prog));
            promislist.push(this.StartLoadConstPoints(prog));

            Promise.all(promislist).then(val => {
                console.debug("After Loaded All Const....");
                if (prog)
                    prog(4);
                sol(CFDOpenFoam.Instance());
            });
        });
    }

    StartLoadConstFaces(prog?: (val) => void) {
        let { path, cmdGetConst } = this;
        return new Promise((sol, rej) => {
            fetch(path + cmdGetConst + '/faces').then(
                (response) => {                       // 2) filter on 200 OK
                    if (response.status === 200 || response.status === 0) {
                        console.debug("Loaded Faces Buf...");
                        if (prog) prog(1);
                        return response.text();
                    } else {
                        console.debug("Loading Config Faces Failed!");
                        rej(response.statusText);
                    }
                }
            ).then(
                textbuf => {
                    if (CFDOpenFoam.instance.ParseForFaces(textbuf)) {
                        console.debug("Paring Faces Buf Done...");
                        if (prog) prog(1);
                        sol(CFDOpenFoam.Instance());
                    } else {
                        rej("Parsing Faces Cong Failed.");
                    }
                }
            );
        });
    }

    StartLoadConstOwner(prog?: (val) => void) {
        let { path, cmdGetConst } = this;
        return new Promise((sol, rej) => {
            fetch(path + cmdGetConst + '/owner').then(
                (response) => {                       // 2) filter on 200 OK
                    if (response.status === 200 || response.status === 0) {
                        console.debug("Loaded owner Buf...");
                        if (prog) prog(1);
                        return response.text();
                    } else {
                        console.debug("Loading Config Owner Failed!");
                        rej(response.statusText);
                    }
                }
            ).then(
                textbuf => {
                    if (CFDOpenFoam.instance.ParseForOwner(textbuf)) {
                        console.debug("Paring Owner Buf Done...");
                        if (prog) prog(1);
                        sol(CFDOpenFoam.Instance());
                    } else {
                        rej("Parsing Owner Config Failed.");
                    }
                }
            );
        });
    }

    StartLoadConstNeighbour(prog?: (val) => void) {
        let { path, cmdGetConst } = this;
        return new Promise((sol, rej) => {
            fetch(path + cmdGetConst + '/neighbour').then(
                (response) => {                       // 2) filter on 200 OK
                    if (response.status === 200 || response.status === 0) {
                        console.debug("Loaded Neighbour Buf...");
                        if (prog) prog(1);
                        return response.text();
                    } else {
                        console.debug("Loading Config Neighbour Failed!");
                        rej(response.statusText);
                    }
                }
            ).then(
                textbuf => {
                    if (CFDOpenFoam.instance.ParseForNeighbour(textbuf)) {
                        console.debug("Paring Neighbour Buf Done...");
                        if (prog) prog(1);
                        sol(CFDOpenFoam.Instance());
                    } else {
                        rej("Parsing Neighbour Cong Failed.");
                    }
                }
            );
        });
    }

    StartLoadConstPoints(prog?: (val) => void) {
        let { path, cmdGetConst } = this;
        return new Promise((sol, rej) => {
            fetch(path + cmdGetConst + '/points').then(
                (response) => {                       // 2) filter on 200 OK
                    if (response.status === 200 || response.status === 0) {
                        console.debug("Loaded points Buf...");
                        if (prog) prog(1);
                        return response.text();
                    } else {
                        console.debug("Loading Config points Failed!");
                        rej(response.statusText);
                    }
                }
            ).then(
                textbuf => {
                    if (CFDOpenFoam.instance.ParseForPoints(textbuf)) {
                        console.debug("Paring pointsr Buf Done...");
                        if (prog) prog(1);
                        sol(CFDOpenFoam.Instance());
                    } else {
                        rej("Parsing points Cong Failed.");
                    }
                }
            );
        });
    }

    // StartLoadAttrbute(attr: string, timegap: number = 200, prog?: (val) => void): Promise<CFDOpenFoam> {
    //     return this.StartLoadAttrbuteCall(attr,
    //         (res, attrs, tclip) => CFDOpenFoam.Instance().ParserOutPutScaleContentJSON(res, attrs, tclip), timegap
    //         , prog);
    // }

    // StartLoadVel(timegap: number = 300, prog?: (val) => void): Promise<CFDOpenFoam> {
    //     let attr = 'velocity';
    //     return this.StartLoadAttrbuteCall(attr,
    //         (res, attrs, tclip) => CFDOpenFoam.Instance().ParserOutPutVelContentJSON(res, attrs, tclip), timegap
    //         , prog);
    // }
}
